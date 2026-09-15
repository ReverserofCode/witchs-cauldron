import Link from 'next/link';

/** Keep this entry independent of the game client and its rules bundle. */
export default function GameEntryCard() {
  return (
    <section aria-labelledby="potion-entry-title" className="relative overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <svg viewBox="0 0 48 48" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 20h24l3 10c0 7-7 11-15 11S9 37 9 30l3-10Z" />
              <path d="M10 20h28M15 40l-2 4m20-4 2 4M20 14c-5-4 5-6 0-10m10 11c-4-3 4-5 0-8" strokeLinecap="round" />
              <path d="M15 26c6 3 12-3 18 0" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-violet-600">공방 미니게임 · 베타</p>
            <h2 id="potion-entry-title" className="mt-1 text-xl font-bold text-slate-900">포션 불조절</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">딱 좋은 온도에서 불을 꺼 주세요. 다섯 번의 배합으로 내 기록에 도전!</p>
            <p className="mt-2 text-xs text-slate-500">약 30–60초 · 로그인 없이 · 느린 연습 제공</p>
          </div>
        </div>
        <Link href="/games/potion-timing" prefetch={false}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600"
          data-analytics-menu="true" data-analytics-id="/games/potion-timing" data-analytics-label="포션 불조절" data-analytics-location="home">
          포션 불조절 해보기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
