import Image from "next/image";
import Link from "next/link";

const COMMUNITY_LINKS = [
  { label: "치지직", href: "https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e" },
  { label: "유튜브", href: "https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ" },
  { label: "유튜브 다시보기", href: "https://www.youtube.com/@fullmoing" },
  { label: "팬카페", href: "https://cafe.naver.com/moinge" },
];

const SITE_LINKS = [
  { label: "홈", href: "/" },
  { label: "방송 일정", href: "/#schedule-section" },
  { label: "숏폼 하이라이트", href: "/#clips-section" },
];

export default function Footer() {
  return (
    <footer className="w-full border-t border-[rgba(var(--moing-accent),0.4)] surface">
      <div className="w-full max-w-screen-xl px-4 py-10 mx-auto sm:px-6 lg:px-8">
        {/* Main grid: stack on mobile, 3 columns on md+ */}
        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link href="/" className="text-lg font-extrabold text-ink transition-colors duration-200 hover:text-[rgb(var(--moing-primary))]">
              마녀의 포션 공방
            </Link>
            <p className="text-xs leading-relaxed text-purple-800/60">
              패러블 엔터테인먼트 소속 버튜버 모잉(Moing)을 응원하는<br />
              비공식 팬페이지입니다.
            </p>
            <div className="inline-flex items-center rounded-md bg-white/80 px-2 py-1 ring-1 ring-black/10 w-fit">
              <Image
                src="/logos/parable-ent.svg"
                alt="패러블 엔터테인먼트 로고"
                width={122}
                height={20}
                className="h-5 w-auto"
                loading="lazy"
                unoptimized
              />
            </div>
          </div>

          {/* Community links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-purple-700/60">커뮤니티</h3>
            <ul className="flex flex-col gap-2">
              {COMMUNITY_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline text-sm text-purple-900/80 transition-colors hover:text-purple-700"
                    data-analytics-menu="true"
                    data-analytics-id={link.href}
                    data-analytics-label={link.label}
                    data-analytics-location="footer_community"
                    data-analytics-type="footer_link"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Site links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-purple-700/60">사이트</h3>
            <ul className="flex flex-col gap-2">
              {SITE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="link-underline text-sm text-purple-900/80 transition-colors hover:text-purple-700"
                    data-analytics-menu="true"
                    data-analytics-id={link.href}
                    data-analytics-label={link.label}
                    data-analytics-location="footer_site"
                    data-analytics-type="footer_link"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-2 pt-8 mt-8 text-xs border-t border-purple-200/40 text-purple-700/50 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Witch&apos;s Cauldron</p>
          <p>비공식 팬페이지 &middot; 모잉 팬 커뮤니티</p>
        </div>
      </div>
    </footer>
  );
}
