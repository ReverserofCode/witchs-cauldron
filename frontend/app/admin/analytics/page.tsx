"use client";

import { useEffect, useMemo, useState } from "react";

type AnalyticsTotals = {
  uniqueVisitors: number;
  returningVisitors: number;
  pageviews: number;
  menuClicks: number;
};

type DailyPoint = {
  day: string;
  pageviews: number;
  menuClicks: number;
};

type MenuClick = {
  elementId: string;
  label: string;
  clicks: number;
};

type AnalyticsResponse = {
  range: { from: string; to: string };
  totals: AnalyticsTotals;
  daily: DailyPoint[];
  topMenuClicks: MenuClick[];
};

function startOfDayUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

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

  const maxDaily = Math.max(
    1,
    ...(data?.daily?.map((entry) => Math.max(entry.pageviews, entry.menuClicks)) ?? [1])
  );

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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">일별 트래픽/메뉴 클릭</h2>
            <span className="text-xs text-[#7b6bb0]">pageview vs menu click</span>
          </div>
          <div className="mt-6 grid gap-3">
            {data?.daily?.length ? (
              data.daily.map((entry) => (
                <div key={entry.day} className="grid items-center gap-3 md:grid-cols-[120px_1fr_80px]">
                  <p className="text-xs font-semibold text-[#5a4a90]">
                    {new Date(entry.day).toISOString().slice(0, 10)}
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="h-3 rounded-full bg-[#efe7ff]">
                      <div
                        className="h-3 rounded-full bg-[#7c5cff]"
                        style={{ width: `${(entry.pageviews / maxDaily) * 100}%` }}
                      />
                    </div>
                    <div className="h-3 rounded-full bg-[#f8f0ff]">
                      <div
                        className="h-3 rounded-full bg-[#ff9ad5]"
                        style={{ width: `${(entry.menuClicks / maxDaily) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-[#4b4b4b]">
                    PV {entry.pageviews} / Click {entry.menuClicks}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#7b6bb0]">선택한 기간에 데이터가 없습니다.</p>
            )}
          </div>
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
