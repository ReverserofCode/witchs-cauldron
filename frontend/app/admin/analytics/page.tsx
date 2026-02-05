"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type AnalyticsTotals = {
  uniqueVisitors: number;
  returningVisitors: number;
  pageviews: number;
  menuClicks: number;
};

type DailyPoint = {
  day: string;
  uniqueVisitors: number;
  pageviews: number;
  menuClicks: number;
};

type MenuClick = {
  elementId: string;
  label: string;
  clicks: number;
};

type SectionView = {
  sectionId: string;
  label: string;
  views: number;
};

type AnalyticsResponse = {
  range: { from: string; to: string };
  totals: AnalyticsTotals;
  daily: DailyPoint[];
  topMenuClicks: MenuClick[];
  sectionViews: SectionView[];
};

function startOfDayUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
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
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - 6);
    return formatDateInput(d);
  });
  const [to, setTo] = useState(() => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + 1);
    return formatDateInput(d);
  });
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

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
      });

    return () => controller.abort();
  }, [from, to]);

  const chartData = useMemo(() => {
    return (
      data?.daily?.map((entry) => ({
        date: new Date(entry.day).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
        uniqueVisitors: entry.uniqueVisitors,
        pageviews: entry.pageviews,
        menuClicks: entry.menuClicks,
      })) ?? []
    );
  }, [data?.daily]);

  const sectionData = useMemo(() => {
    return (
      data?.sectionViews?.map((entry) => ({
        name: SECTION_LABELS[entry.sectionId] || entry.label || entry.sectionId,
        views: entry.views,
      })) ?? []
    );
  }, [data?.sectionViews]);

  return (
    <div className="min-h-screen bg-[#f6f0ff] text-[#1a1a1a] px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6b4de6]">Admin Analytics</p>
          <h1 className="text-3xl font-extrabold">방문자/이용자 통계</h1>
          <p className="text-sm text-[#4b4b4b]">메뉴 클릭과 방문 흐름을 30일 재방문 기준으로 집계합니다.</p>
        </header>

        <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-[#e6dcff] bg-white p-5 shadow-[0_15px_35px_rgba(70,45,140,0.1)]">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#5a4a90]">From (UTC)</label>
            <input
              type="date"
              className="rounded-lg border border-[#d9c8ff] px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#5a4a90]">To (UTC)</label>
            <input
              type="date"
              className="rounded-lg border border-[#d9c8ff] px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {error && (
            <div className="ml-auto rounded-lg border border-[#f2b3b3] bg-[#fff5f5] px-4 py-2 text-sm text-[#b00020]">
              {error}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "순 방문자", value: data?.totals.uniqueVisitors ?? 0 },
            { label: "재방문", value: data?.totals.returningVisitors ?? 0 },
            { label: "페이지뷰", value: data?.totals.pageviews ?? 0 },
            { label: "메뉴 클릭", value: data?.totals.menuClicks ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#ece2ff] bg-white p-4 shadow-[0_10px_25px_rgba(71,47,136,0.08)]">
              <p className="text-xs font-semibold uppercase text-[#7b6bb0]">{stat.label}</p>
              <p className="mt-3 text-2xl font-extrabold text-[#2a1b59]">{stat.value.toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">일별 트래픽 추이</h2>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#7c5cff]" />
                순 방문자
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#36b5ff]" />
                페이지뷰
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff9ad5]" />
                메뉴 클릭
              </span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dcff" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#7b6bb0" />
                <YAxis tick={{ fontSize: 12 }} stroke="#7b6bb0" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e6dcff",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="uniqueVisitors"
                  name="순 방문자"
                  stroke="#7c5cff"
                  strokeWidth={2}
                  dot={{ fill: "#7c5cff", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="pageviews"
                  name="페이지뷰"
                  stroke="#36b5ff"
                  strokeWidth={2}
                  dot={{ fill: "#36b5ff", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="menuClicks"
                  name="메뉴 클릭"
                  stroke="#ff9ad5"
                  strokeWidth={2}
                  dot={{ fill: "#ff9ad5", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#7b6bb0] py-8 text-center">선택한 기간에 데이터가 없습니다.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
          <h2 className="text-lg font-bold mb-6">섹션별 조회 수</h2>
          {sectionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, sectionData.length * 50)}>
              <BarChart data={sectionData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dcff" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#7b6bb0" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#7b6bb0" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e6dcff",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="views" name="조회 수" fill="#7c5cff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#7b6bb0] py-8 text-center">섹션 조회 데이터가 없습니다.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[#ece2ff] bg-white p-6 shadow-[0_15px_35px_rgba(71,47,136,0.1)]">
          <h2 className="text-lg font-bold">메뉴 클릭 TOP 10</h2>
          <div className="mt-4 grid gap-3">
            {data?.topMenuClicks?.length ? (
              data.topMenuClicks.map((entry, index) => (
                <div key={`${entry.elementId}-${index}`} className="flex items-center justify-between rounded-xl border border-[#f1e7ff] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#2a1b59]">{entry.label || entry.elementId}</p>
                    <p className="text-xs text-[#7b6bb0]">{entry.elementId}</p>
                  </div>
                  <span className="text-sm font-bold text-[#6b4de6]">{entry.clicks.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#7b6bb0]">메뉴 클릭 데이터가 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
