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
  switch (name) {
    case "유튜브":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
          <polygon points="10,9 16,12 10,15" fill="#fff" />
        </svg>
      );
    case "유튜브 다시보기":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="12" cy="12" r="10" fill="#FF0000" />
          <polygon points="11,9 16,12 11,15" fill="#fff" />
          <circle cx="12" cy="12" r="7" stroke="#fff" strokeWidth="1.5" fill="none" />
          <rect
            x="11.7"
            y="8"
            width="1.6"
            height="5"
            rx="0.8"
            fill="#fff"
            transform="rotate(30 12.5 10.5)"
          />
        </svg>
      );
    case "팬카페":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <ellipse cx="12" cy="12" rx="8" ry="6" fill="#21C531" />
          <path d="M12 18c-2-2-2-6 0-8 2 2 2 6 0 8z" fill="#fff" />
        </svg>
      );
    case "치지직":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <polygon points="13,2 3,14 11,14 9,22 21,8 13,8" fill="#FFD600" stroke="#FFD600" strokeWidth="1.2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
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
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
            <li className="mr-1 text-xs font-semibold tracking-wide text-purple-700/60 uppercase">커뮤니티</li>
            {items.map((item) => (
              <li key={item.href}>
                <a
                  className="rounded-md px-3 py-2 text-ink hover:bg-[rgba(var(--moing-accent),0.35)] hover:text-[rgb(var(--moing-deep))] md:px-4 md:py-3"
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
            className="flex items-center justify-center w-10 h-10 rounded-lg text-ink hover:bg-[rgba(var(--moing-accent),0.35)] transition-colors"
            aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMenuOpen}
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
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-purple-200/60 bg-white/95 p-3 shadow-xl shadow-purple-900/15 backdrop-blur-lg animate-slide-down">
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
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-900 transition-colors hover:bg-purple-100/80"
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
