import { createHash } from "node:crypto";
import { applyReview, attachAsset, FanArtError, normalizeSourceUrl, permissionRequest, publishWork, rejectWork, type FanArtWork } from "./model";
import type { FanArtRepository } from "./repository";
import type { FanArtAssetStore } from "./assets";
import type { CafeProvider, CafeSnapshot, ConfirmOutreachInput, OutreachState } from "./outreach/types";
export type { CafeProvider, CafeSnapshot, ConfirmOutreachInput, OutreachState } from "./outreach/types";

export interface OutreachDependencies {
  repository: FanArtRepository;
  assets: FanArtAssetStore;
  provider?: CafeProvider;
  downloadImage?: (url: string) => Promise<Uint8Array>;
  now?: () => string;
}
function fail(code: string, message: string): never { throw new FanArtError(code, message, 409); }
function editable(work: FanArtWork) {
  if (["published", "withdrawn", "rejected"].includes(work.status)) fail("terminal_work", "최종 처리된 작품입니다.");
}
function state(work: FanArtWork): OutreachState {
  if (!work.outreach) fail("not_queued", "요청 작업이 없습니다.");
  return work.outreach;
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function digest(value: unknown) { return createHash("sha256").update(stableJson(value)).digest("hex"); }
function authorReplySetDigest(snapshot: CafeSnapshot, commentId: string) {
  return digest(snapshot.comments
    .filter(comment => comment.authorId === snapshot.authorId && comment.parentId === commentId)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function eligible(work: FanArtWork, snapshot: CafeSnapshot) {
  if (normalizeSourceUrl(snapshot.sourceUrl).sourceKey !== work.sourceKey || snapshot.boardId !== "38" || !snapshot.authorId?.trim() || !snapshot.fingerprint?.trim() || snapshot.images.length === 0 || /(?:\bAI\b|생성형|인공지능)/i.test(snapshot.title)) fail("ineligible_source", "해당 게시판·작가·제작방식 조건을 확인할 수 없습니다.");
}
function matchingConfirmation(work: FanArtWork, snapshot: CafeSnapshot) {
  const outreach = state(work), confirmation = outreach.confirmation;
  if (!confirmation?.authorReplySetDigest || !outreach.commentId || confirmation.authorReplySetDigest !== authorReplySetDigest(snapshot, outreach.commentId)) return false;
  const reply = snapshot.comments.find(comment => comment.id === confirmation.replyId && comment.authorId === snapshot.authorId && comment.parentId === outreach.commentId);
  const image = snapshot.images.find(image => image.id === confirmation.imageId);
  return !!reply && digest(reply) === confirmation.replyDigest && image?.url === confirmation.imageUrl && snapshot.fingerprint === confirmation.fingerprint && snapshot.authorId === confirmation.authorId;
}
function invalidate(work: FanArtWork, snapshot: CafeSnapshot, now: string): FanArtWork {
  return { ...work, status: work.requestedAt ? "requested" : "candidate", updatedAt: now, approvedHash: null,
    permission: { display: false, resize: false, credit: false, confirmedAt: null, evidence: "" },
    review: { status: "pending", creatorConfirmedAt: null, confirmedAt: null, note: "" },
    outreach: { ...state(work), status: "needs_review", snapshot, inspectedAt: now, confirmation: undefined, approvedPreparedHash: undefined } };
}

export function createOutreachService({ repository, assets, provider, downloadImage, now = () => new Date().toISOString() }: OutreachDependencies) {
  async function get(id: string) {
    const work = await repository.get(id);
    if (!work) throw new FanArtError("not_found", "작품을 찾을 수 없습니다.", 404);
    return work;
  }
  function update(id: string, version: number, operation: (work: FanArtWork) => FanArtWork) {
    return repository.update(id, version, work => {
      // Claims must not inherit the repository's idempotent-stale-update success.
      if (work.version !== version) fail("version_conflict", "작품이 변경되었습니다. 새로고침해 주세요.");
      editable(work); return operation(work);
    });
  }
  return {
    enqueue(id: string, version: number) {
      return update(id, version, work => {
        if (work.outreach || work.requestedAt) fail("already_queued", "이미 요청된 작품입니다. 재요청하지 않습니다.");
        return { ...work, updatedAt: now(), outreach: { status: "queued", queuedAt: now(), marker: `[moingfans:${id}]` } };
      });
    },
    cancel(id: string, version: number) {
      return update(id, version, work => {
        if (state(work).status !== "queued") fail("send_already_claimed", "이미 전송을 시작했습니다. 거절로 후속 작업을 중단해 주세요.");
        return { ...work, updatedAt: now(), outreach: { ...state(work), status: "cancelled" } };
      });
    },
    reject(id: string, version: number) {
      return update(id, version, work => ({ ...rejectWork(work, now()), outreach: { ...state(work), status: "rejected" } }));
    },
    confirm(id: string, version: number, input: ConfirmOutreachInput) {
      return update(id, version, work => {
        const outreach = state(work), snapshot = outreach.snapshot;
        if (!["awaiting_reply", "needs_review"].includes(outreach.status) || !snapshot) fail("invalid_reply", "수집된 작가 답변을 먼저 확인해 주세요.");
        eligible(work, snapshot);
        const reply = snapshot.comments.find(comment => comment.id === input.replyId && comment.authorId === snapshot.authorId && comment.parentId === outreach.commentId);
        const image = snapshot.images.find(image => image.id === input.imageId);
        if (!reply || !image || !outreach.commentId) fail("invalid_reply", "요청 댓글에 달린 원작자 답변과 이미지를 선택해 주세요.");
        if (input.display !== true || input.resize !== true || input.credit !== true || input.nonAi !== true) fail("approval_required", "사용 범위와 비생성형 제작 여부를 직접 확인해 주세요.");
        const timestamp = now();
        const reviewed = applyReview(work, { requested: true,
          permission: { display: true, resize: true, credit: true, confirmedAt: timestamp, evidence: `reply:${reply.id}; sha256:${digest(reply)}` },
          review: { status: "confirmed_non_generative", creatorConfirmedAt: timestamp, confirmedAt: timestamp, note: "원작자 답변·선택 이미지를 운영자가 직접 검토함" },
        }, timestamp);
        return { ...reviewed, asset: null, status: "requested", outreach: { ...outreach, status: "preparation_queued", approvedPreparedHash: undefined,
          confirmation: { replyId: reply.id, replyDigest: digest(reply), authorReplySetDigest: authorReplySetDigest(snapshot, outreach.commentId), imageId: image.id, imageUrl: image.url, fingerprint: snapshot.fingerprint, authorId: snapshot.authorId } } };
      });
    },
    async approve(id: string, version: number, preparedHash: string) {
      const current = await get(id);
      if (current.version !== version) fail("version_conflict", "작품이 변경되었습니다. 새로고침해 주세요.");
      if (!current.asset || current.asset.sha256 !== preparedHash || !await assets.readVerified(current.asset)) fail("invalid_asset", "준비된 이미지의 해시 또는 파일이 일치하지 않습니다.");
      return update(id, version, work => {
        const outreach = state(work);
        if (!outreach.snapshot || !matchingConfirmation(work, outreach.snapshot)) fail("not_ready", "원작자 답변 집합을 다시 검토해 주세요.");
        if (outreach.status === "publication_queued" && outreach.approvedPreparedHash === preparedHash) return work;
        if (outreach.status !== "prepared" || !outreach.confirmation || work.asset?.sha256 !== preparedHash) fail("not_ready", "이미지 준비와 검토를 완료해 주세요.");
        return { ...work, updatedAt: now(), outreach: { ...outreach, status: "publication_queued", approvedPreparedHash: preparedHash } };
      });
    },
    async tick(id: string, options: { allowComments: boolean; beforeSend?: () => Promise<void>; beforeExternalWrite?: () => Promise<void>; beforePublish?: () => Promise<void> }) {
      const work = await get(id), outreach = work.outreach;
      if (["published", "withdrawn", "rejected"].includes(work.status) || !outreach || ["cancelled", "rejected", "uncertain", "sending", "published"].includes(outreach.status)) return work;
      if (outreach.status === "queued" && !options.allowComments) return work;
      if (!provider) fail("provider_unavailable", "독립 작업자를 실행해 주세요.");
      const snapshot = await provider.inspect(work.sourceUrl);
      eligible(work, snapshot);
      if (outreach.status === "queued") {
        await options.beforeSend?.();
        const claimed = await update(id, work.version, locked => ({ ...locked, updatedAt: now(), outreach: { ...state(locked), status: "sending", attemptedAt: now(), snapshot, inspectedAt: now() } }));
        let commentId: string;
        try {
          const latest = await get(id);
          if (latest.version !== claimed.version || latest.status === "rejected" || latest.outreach?.status !== "sending") fail("version_conflict", "전송 전에 작업이 변경되었습니다.");
          await options.beforeExternalWrite?.();
          const result = await provider.sendRequest(work.sourceUrl, permissionRequest(work), outreach.marker);
          if (!result.commentId) throw new Error("Unconfirmed send");
          commentId = result.commentId;
        } catch {
          return update(id, claimed.version, locked => ({ ...locked, updatedAt: now(), outreach: { ...state(locked), status: "uncertain" } }));
        }
        return update(id, claimed.version, locked => ({ ...locked, status: "requested", requestedAt: now(), updatedAt: now(), outreach: { ...state(locked), status: "awaiting_reply", commentId } }));
      }
      if (outreach.confirmation && !matchingConfirmation(work, snapshot)) return update(id, work.version, locked => invalidate(locked, snapshot, now()));
      if (outreach.status === "preparation_queued") {
        if (!downloadImage || !outreach.confirmation) fail("downloader_unavailable", "이미지 다운로드 설정을 확인해 주세요.");
        const saved = await assets.save(await downloadImage(outreach.confirmation.imageUrl));
        try {
          const fresh = await provider.inspect(work.sourceUrl);
          eligible(work, fresh);
          if (!matchingConfirmation(work, fresh)) {
            await assets.removeCreated(saved.key);
            return update(id, work.version, locked => invalidate(locked, fresh, now()));
          }
          return await update(id, work.version, locked => ({ ...attachAsset(locked, saved, now()), outreach: { ...state(locked), status: "prepared", snapshot: fresh, inspectedAt: now() } }));
        } catch (error) { await assets.removeCreated(saved.key).catch(() => undefined); throw error; }
      }
      if (outreach.status === "publication_queued") {
        if (!work.asset || outreach.approvedPreparedHash !== work.asset.sha256 || !await assets.readVerified(work.asset)) fail("invalid_asset", "승인된 이미지 파일을 확인할 수 없습니다.");
        await options.beforePublish?.();
        return update(id, work.version, locked => publishWork({ ...locked, outreach: { ...state(locked), status: "published", snapshot, inspectedAt: now() } }, now()));
      }
      if (digest(snapshot) === digest(outreach.snapshot)) return work;
      return update(id, work.version, locked => ({ ...locked, updatedAt: now(), outreach: { ...state(locked), snapshot, inspectedAt: now() } }));
    },
  };
}
