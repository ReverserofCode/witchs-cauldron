"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipCatalogSnapshot } from "@/app/lib/clips/catalog";
import ClipsViewer from "./ClipsViewer";
import YouTubeShortsViewer from "./YouTubeShortsViewer";

type ClipsCatalogClientProps = {
  initialCatalog: ClipCatalogSnapshot;
};

const CLIP_CATALOG_ENDPOINT = "/api/clips/catalog";
const CLIP_CATALOG_REFRESH_MS = 60_000;

export default function ClipsCatalogClient({ initialCatalog }: ClipsCatalogClientProps) {
  const [clips, setClips] = useState(initialCatalog.clips);
  const currentVersionRef = useRef(initialCatalog.version);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const refreshCatalog = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const request = fetch(CLIP_CATALOG_ENDPOINT, {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`clip catalog request failed: ${response.status}`);
        const catalog = (await response.json()) as ClipCatalogSnapshot;

        if (catalog.version !== currentVersionRef.current) {
          currentVersionRef.current = catalog.version;
          setClips(catalog.clips);
        }
      })
      .catch(() => {
        // Keep the initial or last usable catalog when a refresh fails.
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    void refreshCatalog();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshCatalog();
    };
    const intervalId = window.setInterval(refreshWhenVisible, CLIP_CATALOG_REFRESH_MS);

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshCatalog]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="rounded-[20px] border border-purple-200/60 bg-white/60 p-3">
        <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-purple-200/60 pb-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
              Chzzk
            </p>
            <p className="mt-1 text-sm font-semibold text-purple-950">치지직 클립</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1.5">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-xs font-bold text-white">치지직</span>
          </div>
        </div>
        <ClipsViewer clips={clips} />
      </div>

      <div className="rounded-[20px] border border-purple-200/60 bg-white/60 p-3">
        <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-purple-200/60 pb-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
              YouTube
            </p>
            <p className="mt-1 text-sm font-semibold text-purple-950">공식 Shorts</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 px-3 py-1.5">
            <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
              <path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span className="text-xs font-bold text-white">YouTube</span>
          </div>
        </div>
        <YouTubeShortsViewer />
      </div>
    </div>
  );
}
