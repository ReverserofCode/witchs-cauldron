/** Public gallery shape shared by legacy static and newly approved works. */
export interface FanArtDisplayImage {
  src: string;
  alt: string;
  credit?: string;
  download?: string;
  id?: string;
  sourceUrl?: string;
  publishedAt?: string;
}
export function isManagedImage(image: FanArtDisplayImage) {
  return Boolean(image.id && image.sourceUrl && image.publishedAt && image.src === `/media/fanart/${image.id}`);
}
export function introductionDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(value));
}
