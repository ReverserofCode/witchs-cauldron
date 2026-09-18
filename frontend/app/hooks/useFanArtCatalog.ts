"use client";
import { useMemo, useSyncExternalStore } from "react";
import { createFanArtCatalog, mergeGalleryImages } from "../lib/fanart/catalog";
import type { FanArtDisplayImage } from "../lib/fanart/display";

const catalog = createFanArtCatalog((...args) => fetch(...args));
export function useFanArtCatalog(legacy: FanArtDisplayImage[]) {
  const published = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getServerSnapshot);
  return useMemo(() => mergeGalleryImages(published, legacy), [published, legacy]);
}
