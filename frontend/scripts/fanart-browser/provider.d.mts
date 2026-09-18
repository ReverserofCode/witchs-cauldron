import type { Page } from "playwright";

export interface CafeSelectors {
  frame?: string;
  article: string; title: string; authorLink: string; boardLink: string; image: string;
  commentsReady: string; commentsMore: string; commentRow: string;
  commentIdAttribute: string; commentParentIdAttribute: string;
  commentAuthorLink: string; commentText: string; signedInMemberLink: string;
  commentInput: string; commentSubmit: string; blockers: readonly string[];
}
export interface CafeSnapshot {
  sourceUrl: string; title: string; authorId: string; boardId: string;
  images: { id: string; url: string }[];
  comments: { id: string; parentId: string | null; authorId: string; text: string }[];
  fingerprint: string;
}
export interface CafeProvider {
  inspect(sourceUrl: string): Promise<CafeSnapshot>;
  sendRequest(sourceUrl: string, text: string, marker: string): Promise<{ commentId: string }>;
}
export class UncertainSendError extends Error {
  readonly code: "UNCERTAIN_SEND";
  constructor(message?: string, options?: ErrorOptions);
}
export function validateCafeSelectors(value: unknown): CafeSelectors;
export function createCafeBrowserProvider(options: {
  page: Page; selectors: CafeSelectors; operatorMemberKey: string; timeoutMs?: number;
}): CafeProvider;
