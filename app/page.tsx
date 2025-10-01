import { ReactElement } from 'react'
import GlobalNav from './components/globalNav'


export default function Page(): ReactElement {
  return (
    <main className="container max-w-6xl px-6 py-10 mx-auto">
      <GlobalNav />
      {/* HERO */}
      <section className="grid items-center grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-chip/40 text-violet-400 ring-1 ring-violet-400/30">
            KR V-tuber • Moing
          </span>
          <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
            The witch of the potion store
          </h1>
          <p className="text-muted max-w-prose">
            보랏빛 포션과 마법이 흐르는 공간. 이 레포는 테마 기반 UI 스켈레톤으로, 향후 콘텐츠와 기능을 얹기 쉽도록 구성되어 있습니다.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {[
              { label: 'Dangerous', color: 'from-fuchsia-500 to-violet-600' },
              { label: 'Love', color: 'from-pink-400 to-rose-500' },
              { label: 'Healing', color: 'from-amber-300 to-yellow-500' },
            ].map((p) => (
              <span
                key={p.label}
                className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${p.color} px-3 py-1 text-xs font-semibold text-white shadow/20 shadow-violet-900/20 ring-1 ring-white/10`}
              >
                ● {p.label}
              </span>
            ))}
          </div>
        </div>
        <div className="md:justify-self-end">
          {/* Placeholder avatar frame; image can be added later */}
          <div className="avatar-frame" aria-hidden>
            <div className="glow" />
            <div className="inner" />
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="grid gap-6 mt-16 md:grid-cols-3">
      </section>

      {/* FOOTER */}
      <footer className="mt-16 text-xs text-center text-muted">
        © {new Date().getFullYear()} Witch's Cauldron. Inspired by Moing.
      </footer>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
    </div>
  )
}
