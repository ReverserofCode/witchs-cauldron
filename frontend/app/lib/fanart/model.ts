import type { OutreachState } from "./outreach/types";

export type FanArtStatus = "candidate" | "requested" | "ready" | "published" | "withdrawn" | "rejected";
export type FanArtReviewStatus = "pending" | "confirmed_non_generative" | "unclear" | "excluded_generative";

export interface FanArtAsset {
  key: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
}

export interface FanArtWork {
  id: string;
  sourceUrl: string;
  sourceKey: string;
  title: string;
  credit: string;
  status: FanArtStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  withdrawnAt: string | null;
  requestedAt: string | null;
  permission: {
    display: boolean;
    resize: boolean;
    credit: boolean;
    confirmedAt: string | null;
    evidence: string;
  };
  review: {
    status: FanArtReviewStatus;
    creatorConfirmedAt: string | null;
    confirmedAt: string | null;
    note: string;
  };
  asset: FanArtAsset | null;
  approvedHash: string | null;
  outreach?: OutreachState;
}

export interface ReviewInput {
  requested: boolean;
  permission: FanArtWork["permission"];
  review: FanArtWork["review"];
}

export interface FanArtImage {
  id: string;
  src: string;
  alt: string;
  credit: string;
  sourceUrl: string;
  publishedAt: string;
}

export class FanArtError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "FanArtError";
  }
}

const CAFE_ID = "30182989";
const TERMINAL: ReadonlySet<FanArtStatus> = new Set(["withdrawn", "rejected"]);

function fail(code: string, message: string, status = 400): never {
  throw new FanArtError(code, message, status);
}

function validTimestamp(value: string | null): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function requireTimestamp(value: string, field = "시간") {
  if (!validTimestamp(value)) fail("invalid_input", `${field} 형식이 올바르지 않습니다.`);
}

function requireText(value: string, field: string, max: number) {
  if (typeof value !== "string") fail("invalid_input", `${field} 형식이 올바르지 않습니다.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) fail("invalid_input", `${field} 길이가 올바르지 않습니다.`);
  return trimmed;
}

function hasApproval(work: FanArtWork) {
  return work.permission.display
    && work.permission.resize
    && work.permission.credit
    && validTimestamp(work.permission.confirmedAt)
    && work.permission.evidence.trim().length > 0
    && work.review.status === "confirmed_non_generative"
    && validTimestamp(work.review.creatorConfirmedAt)
    && validTimestamp(work.review.confirmedAt);
}

function editable(work: FanArtWork) {
  if (work.status === "published" || TERMINAL.has(work.status)) {
    fail("terminal_work", "최종 처리된 작품은 변경할 수 없습니다.", 409);
  }
}

function nextDraftStatus(work: FanArtWork): FanArtStatus {
  if (work.asset && hasApproval(work)) return "ready";
  if (work.requestedAt) return "requested";
  return "candidate";
}

export function normalizeSourceUrl(raw: string): { sourceUrl: string; sourceKey: string } {
  if (typeof raw !== "string" || raw.length > 2048) {
    return fail("invalid_source_url", "지원하지 않는 팬카페 원문 URL입니다.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail("invalid_source_url", "지원하지 않는 팬카페 원문 URL입니다.");
  }

  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "cafe.naver.com"
    || parsed.port
    || parsed.username
    || parsed.password
  ) {
    return fail("invalid_source_url", "지원하지 않는 팬카페 원문 URL입니다.");
  }

  const legacy = parsed.pathname.match(/^\/moinge\/([1-9]\d*)\/?$/);
  const modern = parsed.pathname.match(new RegExp(`^/f-e/cafes/${CAFE_ID}/articles/([1-9]\\d*)/?$`));
  const articleId = legacy?.[1] ?? modern?.[1];
  if (!articleId) return fail("invalid_source_url", "지원하지 않는 팬카페 원문 URL입니다.");

  return {
    sourceUrl: `https://cafe.naver.com/f-e/cafes/${CAFE_ID}/articles/${articleId}`,
    sourceKey: `${CAFE_ID}:${articleId}`,
  };
}

export function createCandidate(
  input: { sourceUrl: string; title: string; credit: string },
  now: string,
): FanArtWork {
  requireTimestamp(now);
  const source = normalizeSourceUrl(input.sourceUrl);
  const title = requireText(input.title, "작품 제목", 200);
  const credit = requireText(input.credit, "작가명", 100);

  return {
    id: crypto.randomUUID(),
    ...source,
    title,
    credit,
    status: "candidate",
    version: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    withdrawnAt: null,
    requestedAt: null,
    permission: {
      display: false,
      resize: false,
      credit: false,
      confirmedAt: null,
      evidence: "",
    },
    review: {
      status: "pending",
      creatorConfirmedAt: null,
      confirmedAt: null,
      note: "",
    },
    asset: null,
    approvedHash: null,
  };
}

export function applyReview(work: FanArtWork, input: ReviewInput, now: string): FanArtWork {
  editable(work);
  requireTimestamp(now);
  if (!input || typeof input !== "object" || typeof input.requested !== "boolean") {
    return fail("invalid_review", "허락 및 검수 기록 형식이 올바르지 않습니다.");
  }
  if (!input.permission || typeof input.permission !== "object" || !input.review || typeof input.review !== "object") {
    return fail("invalid_review", "허락 및 검수 기록 형식이 올바르지 않습니다.");
  }

  const { permission, review } = input;
  if (
    typeof permission.display !== "boolean"
    || typeof permission.resize !== "boolean"
    || typeof permission.credit !== "boolean"
    || typeof permission.evidence !== "string"
    || permission.evidence.length > 2000
    || (permission.confirmedAt !== null && !validTimestamp(permission.confirmedAt))
  ) {
    return fail("invalid_review", "허락 기록 형식이 올바르지 않습니다.");
  }
  if (
    !(["pending", "confirmed_non_generative", "unclear", "excluded_generative"] as const).includes(review.status)
    || typeof review.note !== "string"
    || review.note.length > 2000
    || (review.creatorConfirmedAt !== null && !validTimestamp(review.creatorConfirmedAt))
    || (review.confirmedAt !== null && !validTimestamp(review.confirmedAt))
  ) {
    return fail("invalid_review", "제작 방식 검수 기록 형식이 올바르지 않습니다.");
  }

  const changed: FanArtWork = {
    ...work,
    updatedAt: now,
    requestedAt: input.requested ? (work.requestedAt ?? now) : work.requestedAt,
    permission: { ...permission },
    review: { ...review },
    approvedHash: null,
  };
  return { ...changed, status: nextDraftStatus(changed) };
}

export function attachAsset(work: FanArtWork, asset: FanArtAsset, now: string): FanArtWork {
  editable(work);
  requireTimestamp(now);
  if (!hasApproval(work)) {
    return fail("approval_required", "허락과 제작 방식 검수를 먼저 완료해 주세요.", 409);
  }
  if (
    !asset
    || typeof asset.key !== "string"
    || !/^[0-9a-f-]{36}\.webp$/i.test(asset.key)
    || typeof asset.sha256 !== "string"
    || !/^[0-9a-f]{64}$/i.test(asset.sha256)
    || !Number.isSafeInteger(asset.bytes)
    || asset.bytes <= 0
    || !Number.isSafeInteger(asset.width)
    || asset.width <= 0
    || !Number.isSafeInteger(asset.height)
    || asset.height <= 0
  ) {
    return fail("invalid_asset", "이미지 파일 정보가 올바르지 않습니다.");
  }
  if (work.asset?.key === asset.key && work.asset.sha256 === asset.sha256) return work;

  const replacing = work.asset !== null;
  const changed: FanArtWork = {
    ...work,
    asset: { ...asset },
    updatedAt: now,
    approvedHash: null,
    review: replacing
      ? { status: "pending", creatorConfirmedAt: null, confirmedAt: null, note: "" }
      : { ...work.review },
  };
  return { ...changed, status: nextDraftStatus(changed) };
}

export function publishWork(work: FanArtWork, now: string): FanArtWork {
  if (work.status === "published") return work;
  if (TERMINAL.has(work.status)) {
    return fail("terminal_work", "최종 처리된 작품은 변경할 수 없습니다.", 409);
  }
  requireTimestamp(now);
  if (work.outreach && !["published", "cancelled"].includes(work.outreach.status)) {
    return fail("outreach_approval_required", "자동 요청 작품은 준비된 이미지의 최종 승인을 사용해 주세요.", 409);
  }
  if (!work.asset || !hasApproval(work) || work.status !== "ready") {
    return fail("not_ready", "게시 조건을 모두 충족해 주세요.", 409);
  }
  return {
    ...work,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    approvedHash: work.asset.sha256,
  };
}

export function withdrawWork(work: FanArtWork, now: string): FanArtWork {
  if (work.status === "withdrawn") return work;
  requireTimestamp(now);
  if (work.status !== "published") {
    return fail("not_published", "게시된 작품만 철회할 수 있습니다.", 409);
  }
  return {
    ...work,
    status: "withdrawn",
    withdrawnAt: now,
    updatedAt: now,
  };
}

export function rejectWork(work: FanArtWork, now: string): FanArtWork {
  if (work.status === "rejected") return work;
  requireTimestamp(now);
  if (work.status === "published" || work.status === "withdrawn") {
    return fail("terminal_work", "최종 처리된 작품은 변경할 수 없습니다.", 409);
  }
  return {
    ...work,
    status: "rejected",
    updatedAt: now,
  };
}

export function publicImage(work: FanArtWork): FanArtImage {
  if (
    work.status !== "published"
    || !work.asset
    || !work.publishedAt
    || work.approvedHash !== work.asset.sha256
  ) {
    return fail("not_published", "게시된 작품이 아닙니다.", 404);
  }
  return {
    id: work.id,
    src: `/media/fanart/${work.id}`,
    alt: work.title,
    credit: work.credit,
    sourceUrl: work.sourceUrl,
    publishedAt: work.publishedAt,
  };
}

export function permissionRequest(work: FanArtWork) {
  return `안녕하세요. 모잉 팬사이트 마녀의 포션 공방 운영자입니다. 아래 작품을 사이트의 팬 커뮤니티 작업실에 소개하고 싶어 사용 허락을 요청드립니다.\n\n작품: ${work.title} / ${work.sourceUrl}\n게시 위치: https://moingfans.com\n사용 범위: 작품 이미지 표시, 사이트 표시용 크기 조정 및 WebP 변환, 작가명과 원문 링크 표기. 원본 다운로드 제공, AI 학습 및 재생성에는 사용하지 않습니다.\n\n위 사용 범위에 동의하시는지, 원하시는 작가명 표기와 생성형 AI 사용 여부를 알려주시면 감사하겠습니다. 게시 중단은 이 요청에 답장해 요청하실 수 있습니다. 답변이 없으면 게시하지 않겠습니다.`;
}
