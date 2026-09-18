import { describe, expect, it } from "vitest";

import {
  applyReview,
  attachAsset,
  createCandidate,
  normalizeSourceUrl,
  permissionRequest,
  publicImage,
  publishWork,
  rejectWork,
  withdrawWork,
  type FanArtImage,
  type FanArtWork,
  type ReviewInput,
} from "./model";

const CREATED_AT = "2026-09-18T00:00:00.000Z";
const REVIEWED_AT = "2026-09-18T01:00:00.000Z";
const UPLOADED_AT = "2026-09-18T02:00:00.000Z";
const PUBLISHED_AT = "2026-09-18T03:00:00.000Z";

const confirmedReview: ReviewInput = {
  requested: true,
  permission: {
    display: true,
    resize: true,
    credit: true,
    confirmedAt: REVIEWED_AT,
    evidence: "작가 답변 위치와 최소 확인 메모",
  },
  review: {
    status: "confirmed_non_generative",
    confirmedAt: REVIEWED_AT,
    note: "운영자 제작 방식 검수 완료",
  },
};

const firstAsset = {
  key: "e53a3531-9fa8-4ff0-a213-76010365f508.webp",
  sha256: "a".repeat(64),
  bytes: 1200,
  width: 800,
  height: 1200,
};

function candidate() {
  return createCandidate(
    {
      sourceUrl: "https://cafe.naver.com/moinge/123?x=1#ignored",
      title: "작품",
      credit: "작가",
    },
    CREATED_AT,
  );
}

function readyWork() {
  return attachAsset(applyReview(candidate(), confirmedReview, REVIEWED_AT), firstAsset, UPLOADED_AT);
}

describe("fanart source identity", () => {
  it("maps both supported NAVER URL shapes to one canonical URL and source key", () => {
    const legacy = normalizeSourceUrl("https://cafe.naver.com/moinge/123?x=1#fragment");
    const modern = normalizeSourceUrl("https://cafe.naver.com/f-e/cafes/30182989/articles/123?query=ignored");

    expect(legacy).toEqual({
      sourceUrl: "https://cafe.naver.com/f-e/cafes/30182989/articles/123",
      sourceKey: "30182989:123",
    });
    expect(modern).toEqual(legacy);
    expect(candidate().sourceKey).toBe("30182989:123");
  });

  it.each([
    "http://cafe.naver.com/moinge/123",
    "https://evil.example/moinge/123",
    "https://cafe.naver.com.evil.example/moinge/123",
    "https://user@cafe.naver.com/moinge/123",
    "https://cafe.naver.com:444/moinge/123",
    "https://cafe.naver.com/another-cafe/123",
    "https://cafe.naver.com/moinge/not-a-number",
  ])("rejects unsupported or ambiguous source URL %s", (sourceUrl) => {
    expect(() => normalizeSourceUrl(sourceUrl)).toThrow("지원하지 않는 팬카페 원문 URL입니다.");
  });
});

describe("fanart approval workflow", () => {
  it("requires explicit ISO timestamps instead of accepting Date.parse shortcuts", () => {
    expect(() => createCandidate({
      sourceUrl: "https://cafe.naver.com/moinge/123",
      title: "작품",
      credit: "작가",
    }, "1")).toThrow("시간 형식이 올바르지 않습니다.");
  });

  it("starts as an unapproved candidate and generates a request that states the exact scope", () => {
    const work = candidate();

    expect(work).toMatchObject({
      status: "candidate",
      version: 1,
      requestedAt: null,
      asset: null,
      approvedHash: null,
      permission: { display: false, resize: false, credit: false, confirmedAt: null },
      review: { status: "pending", confirmedAt: null },
    });
    expect(permissionRequest(work)).toContain("https://moingfans.com");
    expect(permissionRequest(work)).toContain("AI 학습 및 재생성에는 사용하지 않습니다");
    expect(permissionRequest(work)).toContain(work.sourceUrl);
  });

  it("rejects upload until display, resize, credit, and non-generative review are confirmed", () => {
    const base = candidate();
    const cases: ReviewInput[] = [
      confirmedReview,
      { ...confirmedReview, permission: { ...confirmedReview.permission, display: false, confirmedAt: null } },
      { ...confirmedReview, permission: { ...confirmedReview.permission, resize: false, confirmedAt: null } },
      { ...confirmedReview, permission: { ...confirmedReview.permission, credit: false, confirmedAt: null } },
      { ...confirmedReview, review: { ...confirmedReview.review, status: "unclear", confirmedAt: null } },
      { ...confirmedReview, review: { ...confirmedReview.review, status: "excluded_generative", confirmedAt: null } },
    ];

    expect(() => attachAsset(base, firstAsset, UPLOADED_AT)).toThrow("허락과 제작 방식 검수를 먼저 완료해 주세요.");
    for (const input of cases.slice(1)) {
      expect(() => attachAsset(applyReview(base, input, REVIEWED_AT), firstAsset, UPLOADED_AT)).toThrow(
        "허락과 제작 방식 검수를 먼저 완료해 주세요.",
      );
    }
    expect(attachAsset(applyReview(base, cases[0], REVIEWED_AT), firstAsset, UPLOADED_AT).status).toBe("ready");
  });

  it("rejects publication without current permission, review, and file approval", () => {
    expect(() => publishWork(candidate(), PUBLISHED_AT)).toThrow("게시 조건을 모두 충족해 주세요.");
    expect(() => publishWork(applyReview(candidate(), confirmedReview, REVIEWED_AT), PUBLISHED_AT)).toThrow(
      "게시 조건을 모두 충족해 주세요.",
    );

    const unclear = applyReview(readyWork(), {
      ...confirmedReview,
      review: { ...confirmedReview.review, status: "unclear", confirmedAt: null },
    }, PUBLISHED_AT);
    expect(() => publishWork(unclear, PUBLISHED_AT)).toThrow("게시 조건을 모두 충족해 주세요.");
  });

  it("binds publication to the current asset hash and makes repeated publication idempotent", () => {
    const published = publishWork(readyWork(), PUBLISHED_AT);

    expect(published).toMatchObject({
      status: "published",
      publishedAt: PUBLISHED_AT,
      approvedHash: firstAsset.sha256,
    });
    expect(publishWork(published, "2026-09-18T04:00:00.000Z")).toBe(published);
  });

  it("requires a fresh explicit review after replacing an asset", () => {
    const replacement = {
      ...firstAsset,
      key: "5c219e61-7852-40b1-8075-b193d757c08c.webp",
      sha256: "b".repeat(64),
    };

    const replaced = attachAsset(readyWork(), replacement, "2026-09-18T03:00:00.000Z");

    expect(replaced.status).toBe("requested");
    expect(replaced.review).toMatchObject({ status: "pending", confirmedAt: null });
    expect(replaced.approvedHash).toBeNull();
    expect(() => publishWork(replaced, PUBLISHED_AT)).toThrow("게시 조건을 모두 충족해 주세요.");

    const freshlyReviewed = applyReview(replaced, confirmedReview, "2026-09-18T03:30:00.000Z");
    expect(publishWork(freshlyReviewed, PUBLISHED_AT).approvedHash).toBe(replacement.sha256);
  });

  it("clears an obsolete approved hash whenever permission or review changes", () => {
    const work = { ...readyWork(), approvedHash: "stale" };
    const changed = applyReview(work, {
      ...confirmedReview,
      permission: { ...confirmedReview.permission, evidence: "새 답변 위치" },
    }, PUBLISHED_AT);

    expect(changed.approvedHash).toBeNull();
  });

  it("keeps publish and withdraw retries idempotent while terminal records stay immutable", () => {
    const published = publishWork(readyWork(), PUBLISHED_AT);
    const withdrawn = withdrawWork(published, "2026-09-18T04:00:00.000Z");
    const rejected = rejectWork(candidate(), "2026-09-18T04:00:00.000Z");

    expect(withdrawWork(withdrawn, "2026-09-18T05:00:00.000Z")).toBe(withdrawn);
    for (const terminal of [withdrawn, rejected]) {
      expect(() => publishWork(terminal, PUBLISHED_AT)).toThrow("최종 처리된 작품은 변경할 수 없습니다.");
      expect(() => applyReview(terminal, confirmedReview, PUBLISHED_AT)).toThrow("최종 처리된 작품은 변경할 수 없습니다.");
      expect(() => attachAsset(terminal, firstAsset, PUBLISHED_AT)).toThrow("최종 처리된 작품은 변경할 수 없습니다.");
    }
  });
});

describe("public fanart projection", () => {
  it("returns only the documented public fields", () => {
    const published = publishWork(readyWork(), PUBLISHED_AT);
    const image: FanArtImage = publicImage(published);

    expect(image).toEqual({
      id: published.id,
      src: `/media/fanart/${published.id}`,
      alt: "작품",
      credit: "작가",
      sourceUrl: "https://cafe.naver.com/f-e/cafes/30182989/articles/123",
      publishedAt: PUBLISHED_AT,
    });
    expect(Object.keys(image).sort()).toEqual(["alt", "credit", "id", "publishedAt", "sourceUrl", "src"]);
    expect(image).not.toHaveProperty("permission");
    expect(image).not.toHaveProperty("review");
    expect(image).not.toHaveProperty("asset");
    expect(image).not.toHaveProperty("approvedHash");
  });

  it("refuses to project records whose current file is not the approved published file", () => {
    const forged = {
      ...publishWork(readyWork(), PUBLISHED_AT),
      approvedHash: "different",
    } satisfies FanArtWork;

    expect(() => publicImage(forged)).toThrow("게시된 작품이 아닙니다.");
  });
});
