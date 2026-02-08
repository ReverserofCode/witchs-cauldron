"use client";

import { useEffect, useMemo, useState } from "react";

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

type ChartBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mapToChartY(value: number, maxValue: number, bounds: ChartBounds) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const ratio = maxValue > 0 ? safeValue / maxValue : 0;
  const y = bounds.bottom - ratio * (bounds.bottom - bounds.top);
  return clamp(y, bounds.top, bounds.bottom);
}

function buildPolyline(values: number[], maxValue: number, bounds: ChartBounds) {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const x = (bounds.left + bounds.right) / 2;
    const y = mapToChartY(values[0], maxValue, bounds);
    return `${x},${y}`;
  }
  return values
    .map((value, index) => {
      const x = bounds.left + (index / (values.length - 1)) * (bounds.right - bounds.left);
      const y = mapToChartY(value, maxValue, bounds);
      return `${x},${y}`;
    })
    .join(" ");
}

function buildYAxisTicks(maxValue: number) {
  const half = Math.ceil(maxValue / 2);
  const quarter = Math.ceil(maxValue / 4);
  const values = Array.from(new Set([maxValue, half, quarter, 0])).sort((a, b) => b - a);
  return values;
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
  return ellipsis(toHostname(referrer), 30);
}

const SECTION_LABELS: Record<string, string> = {
  "featured-latest": "최신 영상",
  "featured-top": "인기 영상",
  "clips-section": "숏폼 하이라이트",
  "schedule-section": "방송 일정",
  "youtube-official": "공식 유튜브",
  "youtube-full": "다시보기",
  "youtube-fan": "팬 영상",
};

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
  const maxDaily = Math.max(1, ...daily.map((entry) => Math.max(entry.pageviews, entry.menuClicks, entry.uniqueVisitors)));
  const sectionViews = data?.sectionViews ?? [];
  const maxSectionViews = Math.max(1, ...sectionViews.map((item) => item.views));
  const topMenuClicks = data?.topMenuClicks ?? [];
  const topPaths = data?.topPaths ?? [];
  const topReferrers = data?.topReferrers ?? [];
  const chartBounds: ChartBounds = { left: 12, right: 98, top: 8, bottom: 92 };
  const yAxisTicks = buildYAxisTicks(maxDaily);

  const sectionViewTotal = sectionViews.reduce((sum, item) => sum + item.views, 0);
  const compositionSlices = [
    { label: "페이지뷰", value: data?.totals.pageviews ?? 0, color: "#5B4BFF" },
    { label: "메뉴 클릭", value: data?.totals.menuClicks ?? 0, color: "#FF4FA3" },
    { label: "섹션 조회", value: sectionViewTotal, color: "#0EA5E9" },
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
    : "conic-gradient(#d8d5e8 0% 100%)";

  const pageviewLine = buildPolyline(daily.map((entry) => entry.pageviews), maxDaily, chartBounds);
  const visitorsLine = buildPolyline(daily.map((entry) => entry.uniqueVisitors), maxDaily, chartBounds);
  const menuLine = buildPolyline(daily.map((entry) => entry.menuClicks), maxDaily, chartBounds);
  const ctr = ratioToPercent(data?.totals.menuClicks ?? 0, data?.totals.pageviews ?? 0);

  const fromLabel = data?.range?.from ? formatDateInput(new Date(data.range.from)) : from;
  const toLabel = data?.range?.to ? formatDateInput(new Date(data.range.to)) : to;

  const handlePreset = (days: number) => {
    const nextTo = formatDateInput(today);
    const nextFrom = formatDateInput(shiftUTCDate(today, -(days - 1)));
    setFrom(nextFrom);
    setTo(nextTo);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7f4ff_0%,#eef7ff_45%,#f9fafb_100%)] px-6 py-10 text-[#1a1a1a]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
        <header className="rounded-3xl border border-[#ddd5ff] bg-white/80 p-6 shadow-[0_24px_44px_rgba(88,66,190,0.12)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6855d8]">Admin Analytics</p>
          <h1 className="mt-2 text-3xl font-black text-[#26145f]">방문자/이용자 분석 대시보드</h1>
          <p className="mt-2 text-sm text-[#4a4670]">
            범위: {fromLabel} ~ {toLabel} (UTC, To 포함)
          </p>
        </header>

        <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-[#e4ddff] bg-white p-5 shadow-[0_18px_36px_rgba(88,66,190,0.1)]">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#5a4a90]">From (UTC)</label>
            <input
              type="date"
              className="rounded-lg border border-[#d9c8ff] px-3 py-2 text-sm"
              value={from}
              onChange={(e) => {
                const value = e.target.value;
                setFrom(value);
                if (value > to) setTo(value);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#5a4a90]">To (UTC, 포함)</label>
            <input
              type="date"
              className="rounded-lg border border-[#d9c8ff] px-3 py-2 text-sm"
              value={to}
              onChange={(e) => {
                const value = e.target.value;
                setTo(value);
                if (value < from) setFrom(value);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "오늘", days: 1 },
              { label: "7일", days: 7 },
              { label: "30일", days: 30 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset.days)}
                className="rounded-lg border border-[#d7ceff] bg-[#f5f2ff] px-3 py-2 text-xs font-semibold text-[#5b49c4] transition hover:bg-[#ece6ff]"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="ml-auto rounded-lg bg-[#5f4de7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4f3fd0]"
          >
            새로고침
          </button>
          {error && (
            <div className="w-full rounded-lg border border-[#f2b3b3] bg-[#fff5f5] px-4 py-2 text-sm text-[#b00020]">
              {error}
              <button
                type="button"
                onClick={() => setReloadToken((prev) => prev + 1)}
                className="ml-3 rounded-md border border-[#f2b3b3] px-2 py-1 text-xs font-semibold"
              >
                다시 시도
              </button>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          {[
            { label: "방문자(고유)", value: data?.totals.visitors ?? 0 },
            { label: "재방문", value: data?.totals.returningVisitors ?? 0 },
            { label: "페이지뷰", value: data?.totals.pageviews ?? 0 },
            { label: "메뉴 클릭", value: data?.totals.menuClicks ?? 0 },
            { label: "CTR", value: `${ctr}%` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#ece2ff] bg-white p-4 shadow-[0_10px_25px_rgba(71,47,136,0.08)]">
              <p className="text-xs font-semibold uppercase text-[#7b6bb0]">{stat.label}</p>
              <p className="mt-3 text-2xl font-extrabold text-[#2a1b59]">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">일별 트렌드</h2>
            <span className="text-xs text-[#7b6bb0]">고유 방문자 / 페이지뷰 / 메뉴 클릭</span>
          </div>
          <div className="mt-5">
            {daily.length ? (
              <>
                <div className="h-64 rounded-2xl border border-[#efe9ff] bg-[#fcfbff] p-4">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    <defs>
                      <clipPath id="daily-trend-plot">
                        <rect
                          x={chartBounds.left}
                          y={chartBounds.top}
                          width={chartBounds.right - chartBounds.left}
                          height={chartBounds.bottom - chartBounds.top}
                        />
                      </clipPath>
                    </defs>
                    {yAxisTicks.map((tick) => {
                      const y = mapToChartY(tick, maxDaily, chartBounds);
                      return (
                        <g key={tick}>
                          <line x1={chartBounds.left} y1={y} x2={chartBounds.right} y2={y} stroke="#ebe5ff" strokeWidth="0.4" />
                          <text x={chartBounds.left - 1.2} y={y + 1} textAnchor="end" fontSize="3" fill="#7b6bb0">
                            {tick.toLocaleString()}
                          </text>
                        </g>
                      );
                    })}
                    <line x1={chartBounds.left} y1={chartBounds.top} x2={chartBounds.left} y2={chartBounds.bottom} stroke="#dcd3ff" strokeWidth="0.6" />
                    <line x1={chartBounds.left} y1={chartBounds.bottom} x2={chartBounds.right} y2={chartBounds.bottom} stroke="#dcd3ff" strokeWidth="0.6" />
                    <g clipPath="url(#daily-trend-plot)">
                      <polyline points={visitorsLine} fill="none" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />
                      <polyline points={pageviewLine} fill="none" stroke="#5b4bff" strokeWidth="1.8" strokeLinecap="round" />
                      <polyline points={menuLine} fill="none" stroke="#ff4fa3" strokeWidth="1.6" strokeLinecap="round" />
                    </g>
                  </svg>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#4e4772]">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0ea5e9]" /> 고유 방문자</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#5b4bff]" /> 페이지뷰</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ff4fa3]" /> 메뉴 클릭</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-[#7b6bb0]">
                  <span>{formatDayLabel(daily[0]?.day)}</span>
                  <span>{formatDayLabel(daily[Math.floor(daily.length / 2)]?.day)}</span>
                  <span>{formatDayLabel(daily[daily.length - 1]?.day)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#7b6bb0]">선택한 기간에 데이터가 없습니다.</p>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
            <h2 className="text-lg font-bold">이벤트 구성</h2>
            <div className="mt-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-[180px_1fr]">
              <div className="relative mx-auto h-40 w-40 rounded-full" style={{ background: donutBackground }}>
                <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-xs font-semibold text-[#7b6bb0]">TOTAL</p>
                    <p className="text-xl font-black text-[#26145f]">{compositionTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {compositionSlices.map((slice) => (
                  <div key={slice.label} className="rounded-lg border border-[#f0ebff] px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-semibold text-[#36256b]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                        {slice.label}
                      </span>
                      <span className="font-bold">{slice.value.toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#7b6bb0]">{ratioToPercent(slice.value, compositionTotal)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
            <h2 className="text-lg font-bold">섹션별 조회</h2>
            <div className="mt-4 grid gap-3">
              {sectionViews.length ? (
                sectionViews.slice(0, 10).map((entry) => {
                  const width = (entry.views / maxSectionViews) * 100;
                  const label = SECTION_LABELS[entry.sectionId] || entry.label || entry.sectionId;
                  return (
                    <div key={entry.sectionId} className="grid gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#2a1b59]">{label}</span>
                        <span className="text-xs font-bold text-[#6b4de6]">{entry.views.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#ecf6ff]">
                        <div className="h-2 rounded-full bg-[#0ea5e9]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[#7b6bb0]">섹션 조회 데이터가 없습니다.</p>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
            <h2 className="text-lg font-bold">메뉴 클릭 TOP 10</h2>
            <div className="mt-4 grid gap-3">
              {topMenuClicks.length ? (
                topMenuClicks.map((entry, index) => (
                  <div key={`${entry.elementId}-${index}`} className="rounded-xl border border-[#f1e7ff] p-3">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-[#2a1b59]">{formatMenuLabel(entry)}</p>
                      <span className="text-sm font-bold text-[#6b4de6]">{entry.clicks.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#7b6bb0]">메뉴 클릭 데이터가 없습니다.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
            <h2 className="text-lg font-bold">페이지 경로 TOP 10</h2>
            <div className="mt-4 grid gap-3">
              {topPaths.length ? (
                topPaths.map((entry) => (
                  <div key={entry.path} className="rounded-xl border border-[#f1e7ff] p-3">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-[#2a1b59]">{formatPathLabel(entry.path)}</p>
                      <span className="text-sm font-bold text-[#5b4bff]">{entry.views.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#7b6bb0]">페이지 경로 데이터가 없습니다.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
            <h2 className="text-lg font-bold">유입 Referrer TOP 10</h2>
            <div className="mt-4 grid gap-3">
              {topReferrers.length ? (
                topReferrers.map((entry) => (
                  <div key={entry.referrer} className="rounded-xl border border-[#f1e7ff] p-3">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-[#2a1b59]">{formatReferrerLabel(entry.referrer)}</p>
                      <span className="text-sm font-bold text-[#0ea5e9]">{entry.visits.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#7b6bb0]">referrer 데이터가 없습니다.</p>
              )}
            </div>
          </article>
        </section>

        {isLoading && (
          <div className="rounded-xl border border-[#d9d0ff] bg-white px-4 py-3 text-sm font-semibold text-[#5b49c4]">
            통계 데이터를 불러오는 중입니다...
          </div>
        )}
      </div>
    </div>
  );
}
