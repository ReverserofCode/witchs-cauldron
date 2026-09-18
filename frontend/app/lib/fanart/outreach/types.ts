export interface CafeImage { id: string; url: string }
export interface CafeComment { id: string; parentId: string | null; authorId: string; text: string }
export interface CafeSnapshot { sourceUrl: string; title: string; authorId: string; boardId: string; images: CafeImage[]; comments: CafeComment[]; fingerprint: string }
export interface CafeProvider {
  inspect(sourceUrl: string): Promise<CafeSnapshot>;
  sendRequest(sourceUrl: string, text: string, marker: string): Promise<{ commentId: string }>;
}
export type OutreachStatus = "queued" | "sending" | "uncertain" | "awaiting_reply" | "preparation_queued" | "prepared" | "publication_queued" | "needs_review" | "cancelled" | "rejected" | "published";
export interface OutreachConfirmation {
  replyId: string; replyDigest: string; imageId: string; imageUrl: string; fingerprint: string; authorId: string;
  // Optional only for reading legacy records; missing bindings require re-review.
  authorReplySetDigest?: string;
}
export interface OutreachState {
  status: OutreachStatus; queuedAt: string; marker: string; attemptedAt?: string; commentId?: string;
  snapshot?: CafeSnapshot; inspectedAt?: string; confirmation?: OutreachConfirmation; approvedPreparedHash?: string;
}
export interface ConfirmOutreachInput {
  replyId: string; imageId: string; display: boolean; resize: boolean; credit: boolean; nonAi: boolean;
}
