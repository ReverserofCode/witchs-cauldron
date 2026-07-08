"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
}

export default function ScrollReveal({ children, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect prefers-reduced-motion
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      setRevealed(true);
      return;
    }

    setAnimationReady(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);

    const fallback = window.setTimeout(() => {
      setRevealed(true);
      observer.disconnect();
    }, 1800);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  const revealClass = revealed ? " revealed" : animationReady ? " pending" : "";

  return (
    <div
      ref={ref}
      className={`scroll-reveal${revealClass}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
