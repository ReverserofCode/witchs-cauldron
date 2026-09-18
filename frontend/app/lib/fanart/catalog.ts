import { normalizeSourceUrl, type FanArtImage } from "./model";
import type { FanArtDisplayImage } from "./display";

const EMPTY: FanArtImage[] = [];
export function parseCatalog(value: unknown): FanArtImage[] {
  if (!value || typeof value !== "object" || !("images" in value) || !Array.isArray(value.images) || value.images.length > 24) throw new Error("Invalid catalog");
  return value.images.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid image");
    const v = item as Record<string, unknown>;
    if (typeof v.id !== "string" || !/^[0-9a-f-]{36}$/i.test(v.id) || v.src !== `/media/fanart/${v.id}` || typeof v.alt !== "string" || typeof v.credit !== "string" || typeof v.sourceUrl !== "string" || typeof v.publishedAt !== "string" || !Number.isFinite(Date.parse(v.publishedAt))) throw new Error("Invalid image");
    normalizeSourceUrl(v.sourceUrl);
    return { id: v.id, src: v.src as string, alt: v.alt, credit: v.credit, sourceUrl: v.sourceUrl, publishedAt: v.publishedAt };
  });
}

export function mergeGalleryImages(published: FanArtImage[], legacy: FanArtDisplayImage[]): FanArtDisplayImage[] {
  return [...published, ...legacy];
}

export function createFanArtCatalog(fetcher: typeof fetch) {
  let snapshot = EMPTY;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  function refresh() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher("/api/fanart", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Catalog unavailable");
        snapshot = parseCatalog(await response.json());
        listeners.forEach(listener => listener());
      } catch {
        // Keep the last successful catalog. Media independently checks withdrawal.
      } finally { pending = null; }
    })();
    return pending;
  }
  function visibleRefresh() { if (document.visibilityState !== "hidden") void refresh(); }
  function visibilityChanged() {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (document.visibilityState !== "hidden") {
      void refresh();
      timer = setInterval(visibleRefresh, 60000);
    }
  }
  return {
    refresh,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== "undefined") {
        window.addEventListener("focus", visibleRefresh);
        document.addEventListener("visibilitychange", visibilityChanged);
        visibilityChanged();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size && typeof window !== "undefined") {
          window.removeEventListener("focus", visibleRefresh);
          document.removeEventListener("visibilitychange", visibilityChanged);
          if (timer) clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}
