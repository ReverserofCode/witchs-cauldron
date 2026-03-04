"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";

type AnalyticsTotals = {
  visitors: number;
  returningVisitors: number;
  pageviews: number;
  menuClicks: number;
};

type DailyPoint = {
  day: string;
  pageviews: number;
  uniqueVisitors: number;
  menuClicks: number;
};

type MenuClick = {
  elementId: string;
  label: string | null;
  clicks: number;
};

type SectionView = {
  sectionId: string;
  label: string | null;
  views: number;
};

type TopPath = {
  path: string;
  views: number;
};

type TopReferrer = {
  referrer: string;
  visits: number;
};

type AnalyticsResponse = {
  range: { from: string; to: string; toExclusive?: string };
  totals: AnalyticsTotals;
  daily: DailyPoint[];
  topMenuClicks: MenuClick[];
  sectionViews: SectionView[];
  topPaths: TopPath[];
  topReferrers: TopReferrer[];
};

function startOfDayUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftUTCDate(date: Date, dayOffset: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + dayOffset);
  return next;
}

function formatDayLabel(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function ratioToPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function ellipsis(value: string, maxLength: number) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
}

function toHostname(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname || value;
  } catch {
    return value;
  }
}

function toPathname(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.pathname || "/";
  } catch {
    return value;
  }
}

function formatMenuLabel(entry: MenuClick) {
  if (entry.label?.trim()) {
    return ellipsis(entry.label.trim(), 26);
  }
  if (entry.elementId?.startsWith("http")) {
    return ellipsis(toHostname(entry.elementId), 26);
  }
  if (entry.elementId?.startsWith("/")) {
    return ellipsis(entry.elementId, 26);
  }
  return "메뉴 항목";
}

function formatPathLabel(path: string) {
  if (!path || path === "(unknown)") return "미확인 경로";
  const clean = toPathname(path).split("?")[0] || "/";
  return ellipsis(clean, 30);
}

function formatReferrerLabel(referrer: string) {
  if (!referrer || referrer === "(direct)") return "직접 유입";
  if (REFERRER_LABELS[referrer]) return REFERRER_LABELS[referrer];
  const hostname = toHostname(referrer);
  if (REFERRER_LABELS[hostname]) return REFERRER_LABELS[hostname];
  return ellipsis(hostname, 30);
}

const SECTION_LABELS: Record<string, string> = {
  "featured-videos": "주요 영상",
  "youtube-hub": "YouTube 허브",
  "clips-section": "숏폼 하이라이트",
  "schedule-section": "방송 일정",
  // Legacy IDs (backward compatibility with historical data)
  "featured-latest": "최신 영상",
  "featured-top": "인기 영상",
  "featured-latest-moing": "공식 최신 영상",
  "featured-top-moing": "공식 인기 영상",
  "featured-latest-fullmoing": "다시보기 최신 영상",
  "featured-top-fullmoing": "다시보기 인기 영상",
  "youtube-official": "공식 유튜브",
  "youtube-full": "다시보기",
  "youtube-fan": "팬 영상",
};

const REFERRER_LABELS: Record<string, string> = {
  "(direct)": "직접 유입",
  "cafe.naver.com": "네이버 카페",
  "m.cafe.naver.com": "네이버 카페 (모바일)",
  "www.google.com": "Google",
  "google.com": "Google",
  "android-app://com.google.android.googlequicksearchbox": "Google (Android)",
  "www.bing.com": "Bing",
  "bing.com": "Bing",
};

// Nice round number for axis
function getNiceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let nice = 10;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  return nice * magnitude;
}

// TrendChart Component
function TrendChart({ daily }: { daily: DailyPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const [tooltipSize, setTooltipSize] = useState({ width: 140, height: 80 });
  const isCompact = dimensions.width < 640;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: width || 800, height: height || 320 });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setTooltipSize({ width: rect.width, height: rect.height });
  }, [activeIndex, isCompact]);

  const padding = useMemo(
    () => (isCompact ? { top: 16, right: 12, bottom: 34, left: 38 } : { top: 28, right: 16, bottom: 44, left: 52 }),
    [isCompact]
  );
  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  const maxValue = useMemo(() => {
    const raw = Math.max(1, ...daily.map((d) => Math.max(d.pageviews, d.uniqueVisitors, d.menuClicks)));
    return getNiceMax(raw);
  }, [daily]);

  const yTicks = useMemo(() => {
    const steps = isCompact ? 4 : 5;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      ticks.push((maxValue / steps) * i);
    }
    return ticks.reverse();
  }, [maxValue, isCompact]);

  const xLabels = useMemo(() => {
    if (daily.length === 0) return [];
    const maxLabels = isCompact ? 4 : 7;
    if (daily.length <= maxLabels) return daily.map((d, i) => ({ index: i, label: formatDayLabel(d.day) }));

    const labels = [];
    const step = Math.max(1, Math.ceil((daily.length - 1) / (maxLabels - 1)));
    for (let i = 0; i < daily.length; i += step) {
      labels.push({ index: i, label: formatDayLabel(daily[i].day) });
    }

    if (labels[labels.length - 1].index !== daily.length - 1) {
      labels.push({ index: daily.length - 1, label: formatDayLabel(daily[daily.length - 1].day) });
    }

    return labels;
  }, [daily, isCompact]);

  const paths = useMemo(() => {
    if (daily.length === 0) return { visitors: "", pageviews: "", menuClicks: "" };
    const toX = (i: number) => padding.left + (i / Math.max(1, daily.length - 1)) * chartWidth;
    const toY = (val: number) => padding.top + chartHeight - (val / maxValue) * chartHeight;

    const visitorsPoints = daily.map((d, i) => ({ x: toX(i), y: toY(d.uniqueVisitors) }));
    const pageviewsPoints = daily.map((d, i) => ({ x: toX(i), y: toY(d.pageviews) }));
    const menuClicksPoints = daily.map((d, i) => ({ x: toX(i), y: toY(d.menuClicks) }));

    return {
      visitors: visitorsPoints.map((p) => `${p.x},${p.y}`).join(" "),
      pageviews: pageviewsPoints.map((p) => `${p.x},${p.y}`).join(" "),
      menuClicks: menuClicksPoints.map((p) => `${p.x},${p.y}`).join(" "),
    };
  }, [daily, chartWidth, chartHeight, maxValue, padding]);

  const updatePointer = useCallback(
    (clientX: number, clientY: number, rect: DOMRect, clearWhenOut: boolean) => {
      if (daily.length === 0) return;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const chartX = x - padding.left;

      if (chartX < 0 || chartX > chartWidth) {
        if (clearWhenOut) setActiveIndex(null);
        return;
      }

      const index = Math.round((chartX / chartWidth) * (daily.length - 1));
      setActiveIndex(Math.max(0, Math.min(daily.length - 1, index)));
      setPointerPosition({ x, y });
    },
    [daily, chartWidth, padding]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    updatePointer(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), true);
  }, [updatePointer]);

  const handlePointerLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    updatePointer(touch.clientX, touch.clientY, e.currentTarget.getBoundingClientRect(), false);
  }, [updatePointer]);

  const handleChartKeyDown = useCallback((e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!daily.length) return;

    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
    }

    setActiveIndex((prev) => {
      const current = prev ?? daily.length - 1;
      if (e.key === "ArrowLeft") return Math.max(0, current - 1);
      if (e.key === "ArrowRight") return Math.min(daily.length - 1, current + 1);
      if (e.key === "Home") return 0;
      if (e.key === "End") return daily.length - 1;
      return prev;
    });
  }, [daily]);

  const ready = dimensions.width > 0 && dimensions.height > 0;
  const hasData = daily.length > 0;

  const selectedIndex = hasData ? (activeIndex ?? daily.length - 1) : 0;
  const selectedData = hasData ? daily[selectedIndex] : null;
  const hoverX =
    activeIndex !== null ? padding.left + (activeIndex / Math.max(1, daily.length - 1)) * chartWidth : 0;

  const tooltipLeft = Math.min(
    Math.max(8, pointerPosition.x + 12),
    Math.max(8, dimensions.width - tooltipSize.width - 8)
  );
  const preferredTop = pointerPosition.y - tooltipSize.height - 10;
  const fallbackTop = pointerPosition.y + 10;
  const tooltipTop =
    preferredTop >= 8 ? preferredTop : Math.min(Math.max(8, fallbackTop), Math.max(8, dimensions.height - tooltipSize.height - 8));

  return (
    <div>
      <p id="trend-chart-help" className="sr-only">좌우 화살표로 날짜를 이동하고 Home/End로 처음/마지막 날짜로 이동할 수 있습니다.</p>
      <div ref={containerRef} className="relative h-72 w-full overflow-hidden rounded-xl focus-within:ring-2 focus-within:ring-purple-500/70 focus-within:ring-offset-2 focus-within:ring-offset-white sm:h-80">
        {!hasData && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-500">선택한 기간에 데이터가 없습니다.</p>
          </div>
        )}
        {ready && hasData && <svg
          width={dimensions.width}
          height={dimensions.height}
          role="img"
          tabIndex={0}
          aria-describedby="trend-chart-help"
          aria-label={`일별 트렌드 차트. ${daily.length}일간 방문자, 페이지뷰, 메뉴 클릭 추이`}
          onKeyDown={handleChartKeyDown}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onTouchStart={handleTouchMove}
          onTouchMove={handleTouchMove}
          className="block max-w-full touch-pan-y cursor-crosshair outline-none"
        >
          <title>일별 트렌드 차트</title>
          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = padding.top + chartHeight - (tick / maxValue) * chartHeight;
            return (
              <g key={tick}>
                <line x1={padding.left} y1={y} x2={padding.left + chartWidth} y2={y} stroke="#E5E7EB" strokeWidth="1" />
                <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize={isCompact ? "10" : "11"} fill="#9CA3AF">
                  {Math.round(tick).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#D1D5DB" strokeWidth="1.5" />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight}
            stroke="#D1D5DB"
            strokeWidth="1.5"
          />

          {/* Area fills */}
          <defs>
            <linearGradient id="grad-visitors" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="grad-pageviews" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="grad-menuClicks" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0" />
            </linearGradient>
          </defs>

          {paths.visitors && (
            <polygon
              points={`${padding.left},${padding.top + chartHeight} ${paths.visitors} ${padding.left + chartWidth},${padding.top + chartHeight}`}
              fill="url(#grad-visitors)"
            />
          )}
          {paths.pageviews && (
            <polygon
              points={`${padding.left},${padding.top + chartHeight} ${paths.pageviews} ${padding.left + chartWidth},${padding.top + chartHeight}`}
              fill="url(#grad-pageviews)"
            />
          )}
          {paths.menuClicks && (
            <polygon
              points={`${padding.left},${padding.top + chartHeight} ${paths.menuClicks} ${padding.left + chartWidth},${padding.top + chartHeight}`}
              fill="url(#grad-menuClicks)"
            />
          )}

          {/* Lines */}
          {paths.visitors && <polyline points={paths.visitors} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round" />}
          {paths.pageviews && <polyline points={paths.pageviews} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinejoin="round" />}
          {paths.menuClicks && <polyline points={paths.menuClicks} fill="none" stroke="#F43F5E" strokeWidth="2" strokeLinejoin="round" />}

          {/* Data points */}
          {daily.map((d, i) => {
            const x = padding.left + (i / Math.max(1, daily.length - 1)) * chartWidth;
            const yVisitors = padding.top + chartHeight - (d.uniqueVisitors / maxValue) * chartHeight;
            const yPageviews = padding.top + chartHeight - (d.pageviews / maxValue) * chartHeight;
            const yMenuClicks = padding.top + chartHeight - (d.menuClicks / maxValue) * chartHeight;
            const isActive = activeIndex === i;
            const r = isActive ? 4 : isCompact ? 1.8 : 2.5;
            return (
              <g key={i}>
                <circle cx={x} cy={yVisitors} r={r} fill="#3B82F6" />
                <circle cx={x} cy={yPageviews} r={r} fill="#8B5CF6" />
                <circle cx={x} cy={yMenuClicks} r={r} fill="#F43F5E" />
              </g>
            );
          })}

          {/* Hover line */}
          {activeIndex !== null && (
            <line x1={hoverX} y1={padding.top} x2={hoverX} y2={padding.top + chartHeight} stroke="#6B7280" strokeWidth="1" strokeDasharray="4 2" />
          )}

          {/* X-axis labels */}
          {xLabels.map(({ index, label }) => {
            const x = padding.left + (index / Math.max(1, daily.length - 1)) * chartWidth;
            return (
              <text key={index} x={x} y={padding.top + chartHeight + 18} textAnchor="middle" fontSize={isCompact ? "10" : "11"} fill="#9CA3AF">
                {label}
              </text>
            );
          })}
        </svg>}

        {/* Tooltip */}
        {ready && hasData && activeIndex !== null && selectedData && (
          <div
            ref={tooltipRef}
            role="tooltip"
            className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{
              left: tooltipLeft,
              top: tooltipTop,
            }}
          >
            <div className="mb-1 font-semibold text-gray-700">{formatDayLabel(selectedData.day)}</div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-gray-600">방문자: {selectedData.uniqueVisitors.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
              <span className="text-gray-600">페이지뷰: {selectedData.pageviews.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-gray-600">메뉴 클릭: {selectedData.menuClicks.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {selectedData && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-purple-100 bg-purple-50/60 p-3 text-xs text-gray-700 sm:grid-cols-4">
          <span className="font-semibold text-gray-900">{formatDayLabel(selectedData.day)}</span>
          <span>방문자 {selectedData.uniqueVisitors.toLocaleString()}</span>
          <span>페이지뷰 {selectedData.pageviews.toLocaleString()}</span>
          <span>메뉴 클릭 {selectedData.menuClicks.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// Period Summary Sidebar
function PeriodSummary({ daily, totals, ctr }: { daily: DailyPoint[]; totals: AnalyticsTotals | null; ctr: number }) {
  const days = daily.length || 1;
  const avgVisitors = Math.round((totals?.visitors ?? 0) / days);
  const avgPageviews = Math.round((totals?.pageviews ?? 0) / days);
  const avgClicks = Math.round((totals?.menuClicks ?? 0) / days);
  const peakDay = daily.length
    ? daily.reduce((best, d) => (d.pageviews > best.pageviews ? d : best), daily[0])
    : null;
  const lowDay = daily.length
    ? daily.reduce((worst, d) => (d.pageviews < worst.pageviews ? d : worst), daily[0])
    : null;

  const items = [
    { label: "일평균 방문자", value: avgVisitors.toLocaleString(), color: "#3B82F6" },
    { label: "일평균 페이지뷰", value: avgPageviews.toLocaleString(), color: "#8B5CF6" },
    { label: "일평균 클릭", value: avgClicks.toLocaleString(), color: "#F43F5E" },
    {
      label: "최고 트래픽",
      value: peakDay ? peakDay.pageviews.toLocaleString() : "-",
      sub: peakDay ? formatDayLabel(peakDay.day) : undefined,
      color: "#10B981",
    },
    {
      label: "최저 트래픽",
      value: lowDay ? lowDay.pageviews.toLocaleString() : "-",
      sub: lowDay ? formatDayLabel(lowDay.day) : undefined,
      color: "#F59E0B",
    },
    { label: "CTR", value: `${ctr}%`, color: "#6366F1" },
  ];

  return (
    <article className="min-w-0 rounded-2xl border border-purple-200/70 bg-white/85 p-4 shadow-md shadow-purple-900/10 backdrop-blur sm:p-5">
      <h2 className="text-sm font-bold text-purple-950">기간 요약</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-purple-100/80 bg-purple-50/70 px-2.5 py-2 sm:px-3 sm:py-2.5">
            <p className="text-[11px] font-medium text-gray-600 sm:text-xs">{item.label}</p>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-base font-bold sm:text-lg" style={{ color: item.color }}>{item.value}</span>
              {item.sub && (
                <span className="text-[10px] text-purple-500/80 sm:text-xs">{item.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function AnalyticsPage() {
  const today = useMemo(() => startOfDayUTC(new Date()), []);
  const [from, setFrom] = useState(() => {
    const d = shiftUTCDate(today, -6);
    return formatDateInput(d);
  });
  const [to, setTo] = useState(() => formatDateInput(today));
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [activePreset, setActivePreset] = useState<number | null>(7);

  useEffect(() => {
    if (from > to) {
      setError("From 날짜는 To 날짜보다 클 수 없습니다.");
      setData(null);
      return;
    }

    const controller = new AbortController();
    setError(null);
    setIsLoading(true);

    fetch(`/api/analytics/stats?from=${from}&to=${to}`, {
      credentials: "include",
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.reason || "통계 데이터를 불러오지 못했습니다.");
        }
        return res.json();
      })
      .then((payload: AnalyticsResponse) => setData(payload))
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [from, to, reloadToken]);

  const daily = data?.daily ?? [];
  const sectionViews = data?.sectionViews ?? [];
  const maxSectionViews = Math.max(1, ...sectionViews.map((item) => item.views));
  const topMenuClicks = data?.topMenuClicks ?? [];
  const topPaths = data?.topPaths ?? [];
  const topReferrers = data?.topReferrers ?? [];

  const totalMenuClicksBase = (data?.totals.menuClicks ?? 0) || topMenuClicks.reduce((sum, item) => sum + item.clicks, 0);
  const totalPathViewsBase = (data?.totals.pageviews ?? 0) || topPaths.reduce((sum, item) => sum + item.views, 0);
  const totalReferrerBase = topReferrers.reduce((sum, item) => sum + item.visits, 0);

  const sectionViewTotal = sectionViews.reduce((sum, item) => sum + item.views, 0);
  const compositionSlices = [
    { label: "페이지뷰", value: data?.totals.pageviews ?? 0, color: "#8B5CF6" },
    { label: "메뉴 클릭", value: data?.totals.menuClicks ?? 0, color: "#F43F5E" },
    { label: "섹션 조회", value: sectionViewTotal, color: "#3B82F6" },
  ];
  const compositionTotal = compositionSlices.reduce((sum, item) => sum + item.value, 0);
  const donutBackground = compositionTotal
    ? `conic-gradient(${compositionSlices
        .map((item, index) => {
          const before = compositionSlices.slice(0, index).reduce((sum, slice) => sum + slice.value, 0);
          const start = (before / compositionTotal) * 100;
          const end = ((before + item.value) / compositionTotal) * 100;
          return `${item.color} ${start}% ${end}%`;
        })
        .join(", ")})`
    : "conic-gradient(#E5E7EB 0% 100%)";

  const ctr = ratioToPercent(data?.totals.menuClicks ?? 0, data?.totals.pageviews ?? 0);

  const fromLabel = data?.range?.from ? formatDateInput(new Date(data.range.from)) : from;
  const toLabel = data?.range?.to ? formatDateInput(new Date(data.range.to)) : to;

  const handlePreset = (days: number) => {
    const nextTo = formatDateInput(today);
    const nextFrom = formatDateInput(shiftUTCDate(today, -(days - 1)));
    setFrom(nextFrom);
    setTo(nextTo);
    setActivePreset(days);
  };

  const stats = [
    {
      label: "방문자",
      value: data?.totals.visitors ?? 0,
      color: "#3B82F6",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      ),
    },
    {
      label: "재방문",
      value: data?.totals.returningVisitors ?? 0,
      color: "#10B981",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      ),
    },
    {
      label: "페이지뷰",
      value: data?.totals.pageviews ?? 0,
      color: "#8B5CF6",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      ),
    },
    {
      label: "메뉴 클릭",
      value: data?.totals.menuClicks ?? 0,
      color: "#F43F5E",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5"
        />
      ),
    },
    {
      label: "CTR",
      value: `${ctr}%`,
      color: "#F59E0B",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-purple-950 sm:text-3xl">Analytics Dashboard</h1>
            <div className="text-xs text-purple-700/80 sm:text-sm">
              {fromLabel} ~ {toLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((prev) => prev + 1)}
            disabled={isLoading}
            className="self-start rounded-xl bg-[rgb(var(--moing-primary))] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-900/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 sm:self-auto"
          >
            {isLoading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>


        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </div>
            <button
              type="button"
              onClick={() => setReloadToken((prev) => prev + 1)}
              className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold transition hover:bg-red-100"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Date picker */}
        <section className="rounded-2xl border border-purple-200/70 bg-white/85 p-5 shadow-md shadow-purple-900/10 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">시작일</label>
              <input
                type="date"
                className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm sm:w-auto"
                value={from}
                onChange={(e) => {
                  const value = e.target.value;
                  setFrom(value);
                  setActivePreset(null);
                  if (value > to) setTo(value);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">종료일</label>
              <input
                type="date"
                className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm sm:w-auto"
                value={to}
                onChange={(e) => {
                  const value = e.target.value;
                  setTo(value);
                  setActivePreset(null);
                  if (value < from) setFrom(value);
                }}
              />
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              {[
                { label: "오늘", days: 1 },
                { label: "7일", days: 7 },
                { label: "14일", days: 14 },
                { label: "30일", days: 30 },
                { label: "90일", days: 90 },
              ].map((preset) => {
                const active = activePreset === preset.days;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePreset(preset.days)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      active
                        ? "border-purple-500 bg-purple-600 text-white"
                        : "border-purple-200 bg-white text-purple-800 hover:bg-purple-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stats cards */}
        <section className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-purple-200/70 bg-white/85 p-4 shadow-md shadow-purple-900/10 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2" style={{ backgroundColor: `${stat.color}15` }}>
                  <svg className="h-5 w-5" style={{ color: stat.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    {stat.icon}
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: stat.color }}>
                    {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Trend chart + Period summary */}
        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <article className="min-w-0 overflow-hidden rounded-2xl border border-purple-200/70 bg-white/85 p-4 shadow-md shadow-purple-900/10 backdrop-blur sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-purple-950">일별 트렌드</h2>
            </div>
            <TrendChart daily={daily} />
            {daily.length > 0 && (
              <table className="sr-only" aria-label="일별 트렌드 데이터">
                <thead>
                  <tr><th>날짜</th><th>방문자</th><th>페이지뷰</th><th>메뉴 클릭</th></tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.day}>
                      <td>{formatDayLabel(d.day)}</td>
                      <td>{d.uniqueVisitors}</td>
                      <td>{d.pageviews}</td>
                      <td>{d.menuClicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-gray-600">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" aria-hidden="true" />
                방문자
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-violet-500" aria-hidden="true" />
                페이지뷰
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" aria-hidden="true" />
                메뉴 클릭
              </span>
            </div>
          </article>

          <PeriodSummary daily={daily} totals={data?.totals ?? null} ctr={ctr} />
        </section>

        {/* Composition & Section Views */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Event composition donut */}
          <article className="rounded-2xl border border-purple-200/70 bg-white/85 p-6 shadow-md shadow-purple-900/10 backdrop-blur">
            <h2 className="text-lg font-bold text-purple-950">이벤트 구성</h2>
            <div className="mt-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-[180px_1fr]">
              <div className="relative mx-auto h-40 w-40 rounded-full" style={{ background: donutBackground }}>
                <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-xs font-semibold text-gray-500">TOTAL</p>
                    <p className="text-xl font-black text-gray-900">{compositionTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {compositionSlices.map((slice) => (
                  <div key={slice.label} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                      {slice.label}
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{slice.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{ratioToPercent(slice.value, compositionTotal)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* Section views */}
          <article className="rounded-2xl border border-purple-200/70 bg-white/85 p-6 shadow-md shadow-purple-900/10 backdrop-blur">
            <h2 className="text-lg font-bold text-purple-950">섹션별 조회</h2>
            <div className="mt-4 space-y-3">
              {sectionViews.length ? (
                sectionViews.slice(0, 10).map((entry) => {
                  const width = (entry.views / maxSectionViews) * 100;
                  const label = SECTION_LABELS[entry.sectionId] || entry.label || entry.sectionId;
                  return (
                    <div key={entry.sectionId}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-700">{label}</span>
                        <span className="font-bold text-blue-500">{entry.views.toLocaleString()}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">섹션 조회 데이터가 없습니다.</p>
              )}
            </div>
          </article>
        </section>

        {/* Bottom 3 lists */}
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Menu Clicks */}
          <article className="rounded-2xl border border-purple-200/70 bg-white/85 p-6 shadow-md shadow-purple-900/10 backdrop-blur">
            <h2 className="mb-1 text-lg font-bold text-purple-950">메뉴 클릭 TOP 10</h2>
            <p className="mb-4 text-xs text-purple-700/70">전체 메뉴 클릭 대비 비중</p>
            {topMenuClicks.length ? (
              <div className="divide-y divide-gray-100">
                {(() => { const maxClicks = Math.max(1, ...topMenuClicks.map(e => e.clicks)); return topMenuClicks.map((entry, index) => (
                  <div key={`${entry.elementId}-${index}`} className="group relative flex items-center gap-3 rounded-lg py-3 transition-colors hover:bg-rose-50/50">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-rose-50 transition-all group-hover:bg-rose-100/60"
                      style={{ width: `${(entry.clicks / maxClicks) * 100}%` }}
                      aria-hidden="true"
                    />
                    <div className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                      {index + 1}
                    </div>
                    <p className="relative min-w-0 flex-1 truncate text-sm font-medium text-gray-700" title={entry.label?.trim() || entry.elementId}>{formatMenuLabel(entry)}</p>
                    <span className="relative text-sm font-bold tabular-nums text-rose-500">
                      {entry.clicks.toLocaleString()} · {ratioToPercent(entry.clicks, totalMenuClicksBase)}%
                    </span>
                  </div>
                )); })()}
              </div>
            ) : (
              <p className="text-sm text-gray-500">메뉴 클릭 데이터가 없습니다.</p>
            )}
          </article>

          {/* Top Paths */}
          <article className="rounded-2xl border border-purple-200/70 bg-white/85 p-6 shadow-md shadow-purple-900/10 backdrop-blur">
            <h2 className="mb-1 text-lg font-bold text-purple-950">페이지 경로 TOP 10</h2>
            <p className="mb-4 text-xs text-purple-700/70">전체 페이지뷰 대비 비중</p>
            {topPaths.length ? (
              <div className="divide-y divide-gray-100">
                {(() => { const maxViews = Math.max(1, ...topPaths.map(e => e.views)); return topPaths.map((entry, index) => (
                  <div key={entry.path} className="group relative flex items-center gap-3 rounded-lg py-3 transition-colors hover:bg-violet-50/50">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-violet-50 transition-all group-hover:bg-violet-100/60"
                      style={{ width: `${(entry.views / maxViews) * 100}%` }}
                      aria-hidden="true"
                    />
                    <div className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                      {index + 1}
                    </div>
                    <p className="relative min-w-0 flex-1 truncate text-sm font-medium text-gray-700" title={entry.path}>{formatPathLabel(entry.path)}</p>
                    <span className="relative text-sm font-bold tabular-nums text-violet-500">
                      {entry.views.toLocaleString()} · {ratioToPercent(entry.views, totalPathViewsBase)}%
                    </span>
                  </div>
                )); })()}
              </div>
            ) : (
              <p className="text-sm text-gray-500">페이지 경로 데이터가 없습니다.</p>
            )}
          </article>

          {/* Top Referrers */}
          <article className="rounded-2xl border border-purple-200/70 bg-white/85 p-6 shadow-md shadow-purple-900/10 backdrop-blur">
            <h2 className="mb-1 text-lg font-bold text-purple-950">유입 Referrer TOP 10</h2>
            <p className="mb-4 text-xs text-purple-700/70">Referrer TOP 합계 대비 비중</p>
            {topReferrers.length ? (
              <div className="divide-y divide-gray-100">
                {(() => { const maxVisits = Math.max(1, ...topReferrers.map(e => e.visits)); return topReferrers.map((entry, index) => (
                  <div key={entry.referrer} className="group relative flex items-center gap-3 rounded-lg py-3 transition-colors hover:bg-blue-50/50">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-blue-50 transition-all group-hover:bg-blue-100/60"
                      style={{ width: `${(entry.visits / maxVisits) * 100}%` }}
                      aria-hidden="true"
                    />
                    <div className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      {index + 1}
                    </div>
                    <p className="relative min-w-0 flex-1 truncate text-sm font-medium text-gray-700" title={entry.referrer}>{formatReferrerLabel(entry.referrer)}</p>
                    <span className="relative text-sm font-bold tabular-nums text-blue-500">
                      {entry.visits.toLocaleString()} · {ratioToPercent(entry.visits, totalReferrerBase)}%
                    </span>
                  </div>
                )); })()}
              </div>
            ) : (
              <p className="text-sm text-gray-500">referrer 데이터가 없습니다.</p>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}
