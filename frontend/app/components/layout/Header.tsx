"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type HeaderItem = { label: string; href: string; external?: boolean };

export interface HeaderProps {
  brand?: ReactNode;
  items?: HeaderItem[];
}

const defaultItems: HeaderItem[] = [
  { label: "방송 모아보기", href: "/broadcasts", external: false },
  { label: "치지직", href: "https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e" },
  { label: "유튜브", href: "https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ" },
  { label: "유튜브 다시보기", href: "https://www.youtube.com/@fullmoing" },
  { label: "팬카페", href: "https://cafe.naver.com/moinge" },
];

function HeaderIcon({ name, className }: { name: string; className?: string }) {
  if (name === "방송 모아보기") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 3.75v3M17 3.75v3M4.5 9h15" strokeLinecap="round" />
        <rect x="3.5" y="5.25" width="17" height="15" rx="3" />
        <path d="m10.25 12 4 2.25-4 2.25z" fill="currentColor" stroke="none" />
      </svg>
    );
  }

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
          <ul className="flex items-center gap-2 md:gap-2 lg:gap-3">
            <li className="mr-1 text-xs font-semibold tracking-wide text-purple-700/60 uppercase">바로가기</li>
            {items.map((item) => {
              const isExternal = item.external ?? item.href.startsWith("http");
              return (
              <li key={item.href}>
                <Link
                  className="nav-indicator inline-flex items-center gap-2 rounded-md px-3 py-2 text-ink transition-all duration-200 hover:bg-[rgba(var(--moing-accent),0.35)] hover:text-[rgb(var(--moing-deep))] md:px-3 md:py-3 lg:px-4"
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  prefetch={isExternal ? false : undefined}
                  data-analytics-menu="true"
                  data-analytics-id={item.href}
                  data-analytics-label={item.label}
                  data-analytics-location="header"
                  data-analytics-type="header_menu"
                >
                  <HeaderIcon name={item.label} className="w-5 h-5 md:h-6 md:w-6" />
                  <span className="sr-only lg:not-sr-only lg:text-xs lg:font-semibold lg:leading-none">
                    {item.label}
                  </span>
                </Link>
              </li>
              );
            })}
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
            <>
              <button
                type="button"
                aria-label="메뉴 닫기"
                className="fixed inset-0 top-[4.5rem] z-40 bg-purple-950/35"
                onClick={closeMenu}
              />
              <div
                id="mobile-community-menu"
                className="fixed left-4 right-4 top-[5rem] z-50 rounded-2xl border border-purple-200 bg-white p-4 shadow-2xl shadow-purple-950/25 ring-1 ring-purple-950/10 animate-slide-down"
              >
              <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-widest text-purple-700">
                사이트 바로가기
              </p>
              <ul className="flex flex-col gap-1.5">
                {items.map((item) => {
                  const isExternal = item.external ?? item.href.startsWith("http");
                  return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      prefetch={isExternal ? false : undefined}
                      className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-purple-950 transition-colors hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
                    </Link>
                  </li>
                  );
                })}
              </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
