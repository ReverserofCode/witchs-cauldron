"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type HeaderItem = { label: string; href: string };

export interface HeaderProps {
  brand?: ReactNode;
  items?: HeaderItem[];
}

const defaultItems: HeaderItem[] = [
  { label: "치지직", href: "https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e" },
  { label: "유튜브", href: "https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ" },
  { label: "유튜브 다시보기", href: "https://www.youtube.com/@fullmoing" },
  { label: "팬카페", href: "https://cafe.naver.com/moinge" },
];

function HeaderIcon({ name, className }: { name: string; className?: string }) {
  const srcByName: Record<string, string> = {
    "유튜브": "/gnbIcon/YouTube.svg",
    "유튜브 다시보기": "/gnbIcon/YouTube.svg",
    "팬카페": "/gnbIcon/NaverCafe.png",
    "치지직": "/gnbIcon/chzzk Icon.png",
  };

  const src = srcByName[name];
  if (src) {
    return (
      <span className={`relative inline-block ${className ?? "w-5 h-5"}`}>
        <Image src={src} alt="" fill className="object-contain" sizes="24px" />
      </span>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export default function Header({ brand, items = defaultItems }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  // Close on Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen, closeMenu]);

  // Close on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClick = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [isMenuOpen, closeMenu]);

  return (
    <header className="sticky top-0 z-50 flex justify-center w-full surface">
      <div className="flex items-center justify-between w-full max-w-screen-xl gap-4 px-4 py-3 md:px-6 md:py-2">
        <Link
          href="/"
          aria-label="홈으로 이동"
          className="flex items-center gap-3 rounded-md p-1 text-xl font-extrabold text-ink hover:bg-[rgba(var(--moing-accent),0.35)] md:gap-4 md:text-2xl"
        >
          <span className="inline-block w-10 h-10 overflow-hidden rounded-full">
            <Image src="/mainPage/favicon_moing.png" alt="Moing" width={40} height={40} className="object-cover w-full h-full" />
          </span>
          {brand ?? <span>마녀의 포션 공방</span>}
        </Link>

        {/* Desktop nav */}
        <nav aria-label="헤더 내비게이션" className="hidden md:block">
          <ul className="flex items-center gap-2 md:gap-3">
            <li>
              <Link
                href="/admin/analytics"
                className="nav-indicator inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-ink transition-all duration-200 hover:bg-[rgba(var(--moing-accent),0.35)] hover:text-[rgb(var(--moing-deep))] md:px-4 md:py-3"
                aria-label="분석 대시보드"
                title="분석 대시보드"
                data-analytics-menu="true"
                data-analytics-id="/admin/analytics"
                data-analytics-label="분석 대시보드"
                data-analytics-location="header"
                data-analytics-type="admin_link"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 md:h-6 md:w-6" aria-hidden="true">
                  <path d="M3 3v18h18" />
                  <path d="M7 16l4-8 4 4 4-6" />
                </svg>
                <span className="text-xs font-semibold tracking-tight md:text-sm">통계</span>
              </Link>
            </li>
            <li className="mx-1 h-5 w-px bg-purple-300/40" role="separator" aria-hidden="true" />
            <li className="mr-1 text-xs font-semibold tracking-wide text-purple-700/60 uppercase">커뮤니티</li>
            {items.map((item) => (
              <li key={item.href}>
                <a
                  className="nav-indicator rounded-md px-3 py-2 text-ink transition-all duration-200 hover:bg-[rgba(var(--moing-accent),0.35)] hover:text-[rgb(var(--moing-deep))] md:px-4 md:py-3"
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-analytics-menu="true"
                  data-analytics-id={item.href}
                  data-analytics-label={item.label}
                  data-analytics-location="header"
                  data-analytics-type="header_menu"
                >
                  <HeaderIcon name={item.label} className="w-5 h-5 md:h-6 md:w-6" />
                  <span className="sr-only">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile hamburger button */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex min-h-11 min-w-11 items-center justify-center w-11 h-11 rounded-lg text-ink hover:bg-[rgba(var(--moing-accent),0.35)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-community-menu"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Mobile dropdown menu */}
          {isMenuOpen && (
            <div id="mobile-community-menu" className="absolute right-0 top-full mt-2 w-[min(92vw,20rem)] rounded-2xl border border-purple-200/60 bg-white/95 p-3 shadow-xl shadow-purple-900/15 backdrop-blur-lg animate-slide-down">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-purple-600/70">
                커뮤니티 바로가기
              </p>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-900 transition-colors hover:bg-purple-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      data-analytics-menu="true"
                      data-analytics-id={item.href}
                      data-analytics-label={item.label}
                      data-analytics-location="header_mobile"
                      data-analytics-type="header_menu"
                      onClick={() => {
                        closeMenu();
                      }}
                    >
                      <HeaderIcon name={item.label} className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-2 border-t border-purple-200/40 pt-2">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-purple-600/70">
                  관리
                </p>
                <Link
                  href="/admin/analytics"
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-900 transition-colors hover:bg-purple-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  onClick={() => { closeMenu(); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
                    <path d="M3 3v18h18" />
                    <path d="M7 16l4-8 4 4 4-6" />
                  </svg>
                  <span>분석 대시보드</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
