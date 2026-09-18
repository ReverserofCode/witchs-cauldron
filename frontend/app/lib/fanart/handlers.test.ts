import sharp from "sharp";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createFanArtAssetStore, type FanArtAssetStore } from "./assets";
import {
  applyReview,
  attachAsset,
  createCandidate,
  FanArtError,
  publishWork,
  withdrawWork,
  type ReviewInput,
} from "./model";
import type { FanArtRepository } from "./repository";
import { createFanArtHandlers } from "./handlers";

const NOW = "2026-09-18T00:00:00.000Z";
const config = { username: "operator", password: "secret", origin: "https://moingfans.com" };
const authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
const confirmed: ReviewInput = {
  requested: true,
  permission: {
    display: true,
    resize: true,
    credit: true,
    confirmedAt: NOW,
    evidence: "minimal evidence",
  },
  review: {
    status: "confirmed_non_generative",
    creatorConfirmedAt: NOW,
    confirmedAt: NOW,
    note: "creator assertion and operator review",
  },
};
const asset = {
  key: "e53a3531-9fa8-4ff0-a213-76010365f508.webp",
  sha256: "a".repeat(64),
  bytes: 12,
  width: 100,
  height: 100,
};

function adminHeaders(mutation = false) {
  return {
    authorization,
    ...(mutation ? { origin: config.origin } : {}),
  };
}

function candidate() {
  return createCandidate({
    sourceUrl: "https://cafe.naver.com/moinge/987654",
    title: "작품",
    credit: "작가",
  }, NOW);
}

function ready() {
  return attachAsset(applyReview(candidate(), confirmed, NOW), asset, NOW);
}

function published() {
  return publishWork(ready(), NOW);
}

function repository(overrides: Partial<FanArtRepository> = {}): FanArtRepository {
  return {
    create: vi.fn(async () => candidate()),
    list: vi.fn(async () => ({ works: [candidate()], hasMore: false })),
    get: vi.fn(async () => candidate()),
    update: vi.fn(async (_id, _version, operation) => operation(candidate())),
    published: vi.fn(async () => [published()]),
    audit: vi.fn(async () => []),
    ...overrides,
  };
}

function assetStore(overrides: Partial<FanArtAssetStore> = {}): FanArtAssetStore {
  return {
    save: vi.fn(async () => asset),
    readVerified: vi.fn(async () => Buffer.from("webp-content")),
    removeCreated: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("fanart handler guards", () => {
  it("does not resolve or call the repository when admin authentication fails", async () => {
    const getRepository = vi.fn(async () => repository());
    const handlers = createFanArtHandlers({ getRepository, assets: assetStore(), config, now: () => NOW });
    const request = new Request("https://moingfans.com/api/admin/fanart");

    const response = await handlers.adminList(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
    expect(getRepository).not.toHaveBeenCalled();
  });

  it("does not resolve or call the repository when a mutation origin is missing or invalid", async () => {
    const getRepository = vi.fn(async () => repository());
    const handlers = createFanArtHandlers({ getRepository, assets: assetStore(), config, now: () => NOW });
    const request = new Request("https://moingfans.com/api/admin/fanart", {
      method: "POST",
      headers: { authorization, origin: "https://attacker.invalid", "content-type": "application/json" },
      body: "{}",
    });

    expect((await handlers.create(request)).status).toBe(403);
    expect(getRepository).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs and scalar types before repository access", async () => {
    const getRepository = vi.fn(async () => repository());
    const handlers = createFanArtHandlers({ getRepository, assets: assetStore(), config, now: () => NOW });
    const badId = new Request("https://moingfans.com/api/admin/fanart/not-an-id", { headers: adminHeaders() });
    const badCreate = new Request("https://moingfans.com/api/admin/fanart", {
      method: "POST",
      headers: { ...adminHeaders(true), "content-type": "application/json" },
      body: JSON.stringify({ sourceUrl: 123, title: "작품", credit: "작가" }),
    });

    expect((await handlers.detail(badId, "not-an-id")).status).toBe(400);
    expect((await handlers.create(badCreate)).status).toBe(400);
    expect(getRepository).not.toHaveBeenCalled();
  });

  it("rejects a non-scalar creator assertion timestamp through the review endpoint", async () => {
    const current = candidate();
    const repo = repository({
      update: vi.fn(async (_id, _version, operation) => operation(current)),
    });
    const handlers = createFanArtHandlers({ getRepository: async () => repo, assets: assetStore(), config, now: () => NOW });
    const request = new Request(`https://moingfans.com/api/admin/fanart/${current.id}`, {
      method: "PATCH",
      headers: { ...adminHeaders(true), "content-type": "application/json" },
      body: JSON.stringify({
        version: current.version,
        review: {
          ...confirmed,
          review: { ...confirmed.review, creatorConfirmedAt: 123 },
        },
      }),
    });

    expect((await handlers.review(request, current.id)).status).toBe(400);
  });
});

describe("fanart API projections and media", () => {
  it("returns only the documented public projection with no-store", async () => {
    const handlers = createFanArtHandlers({
      getRepository: async () => repository(),
      assets: assetStore(),
      config,
      now: () => NOW,
    });

    const response = await handlers.publicList(new Request("https://moingfans.com/api/fanart"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.images).toHaveLength(1);
    expect(Object.keys(body.images[0]).sort()).toEqual(["alt", "credit", "id", "publishedAt", "sourceUrl", "src"]);
    expect(JSON.stringify(body)).not.toContain("minimal evidence");
    expect(JSON.stringify(body)).not.toContain(asset.key);
  });

  it("serves only a currently published, hash-verified WebP with defensive headers", async () => {
    const work = published();
    const store = assetStore();
    const handlers = createFanArtHandlers({
      getRepository: async () => repository({ get: vi.fn(async () => work) }),
      assets: store,
      config,
      now: () => NOW,
    });

    const response = await handlers.media(new Request(`https://moingfans.com/media/fanart/${work.id}`), work.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("webp-content");
    expect(store.readVerified).toHaveBeenCalledWith(work.asset);
  });

  it("returns 404 after withdrawal and 503 on a database outage without reading the file", async () => {
    const withdrawn = withdrawWork(published(), NOW);
    const store = assetStore();
    const afterWithdrawal = createFanArtHandlers({
      getRepository: async () => repository({ get: vi.fn(async () => withdrawn) }),
      assets: store,
      config,
      now: () => NOW,
    });
    const outage = createFanArtHandlers({
      getRepository: async () => repository({ get: vi.fn(async () => { throw new Error("postgres password leaked"); }) }),
      assets: store,
      config,
      now: () => NOW,
    });

    expect((await afterWithdrawal.media(new Request(`https://moingfans.com/media/fanart/${withdrawn.id}`), withdrawn.id)).status).toBe(404);
    const unavailable = await outage.media(new Request(`https://moingfans.com/media/fanart/${withdrawn.id}`), withdrawn.id);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "서비스를 일시적으로 사용할 수 없습니다." });
    expect(store.readVerified).not.toHaveBeenCalled();
  });
});

describe("fanart asset attachment", () => {
  it.each([
    ["creator assertion", { ...confirmed, review: { ...confirmed.review, creatorConfirmedAt: null } }],
    ["operator review", { ...confirmed, review: { ...confirmed.review, confirmedAt: null } }],
    ["permission evidence", { ...confirmed, permission: { ...confirmed.permission, evidence: "   " } }],
  ])("does not process a file while %s is missing", async (_label, incomplete) => {
    const current = applyReview(candidate(), incomplete, NOW);
    const store = assetStore();
    const repo = repository({ get: vi.fn(async () => current) });
    const handlers = createFanArtHandlers({ getRepository: async () => repo, assets: store, config, now: () => NOW });
    const form = new FormData();
    form.set("version", String(current.version));
    form.set("file", new File([new Uint8Array([1])], "shape.png", { type: "image/png" }));
    const request = new Request(`https://moingfans.com/api/admin/fanart/${current.id}/asset`, {
      method: "POST",
      headers: adminHeaders(true),
      body: form,
    });

    expect((await handlers.uploadAsset(request, current.id)).status).toBe(409);
    expect(store.save).not.toHaveBeenCalled();
  });

  it("rejects server paths and other non-file multipart values", async () => {
    const store = assetStore();
    const getRepository = vi.fn(async () => repository());
    const handlers = createFanArtHandlers({ getRepository, assets: store, config, now: () => NOW });
    const form = new FormData();
    form.set("version", "1");
    form.set("file", "C:\\private\\artist.png");
    const request = new Request(`https://moingfans.com/api/admin/fanart/${candidate().id}/asset`, {
      method: "POST",
      headers: adminHeaders(true),
      body: form,
    });

    expect((await handlers.uploadAsset(request, candidate().id)).status).toBe(400);
    expect(getRepository).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("removes only the newly created orphan when database attachment fails", async () => {
    const current = applyReview(candidate(), confirmed, NOW);
    const store = assetStore();
    const repo = repository({
      get: vi.fn(async () => current),
      update: vi.fn(async () => { throw new Error("database unavailable"); }),
    });
    const handlers = createFanArtHandlers({ getRepository: async () => repo, assets: store, config, now: () => NOW });
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).png().toBuffer();
    const form = new FormData();
    form.set("version", String(current.version));
    form.set("file", new File([png], "ignored-client-name.png", { type: "image/png" }));
    const request = new Request(`https://moingfans.com/api/admin/fanart/${current.id}/asset`, {
      method: "POST",
      headers: adminHeaders(true),
      body: form,
    });

    const response = await handlers.uploadAsset(request, current.id);

    expect(response.status).toBe(503);
    expect(store.removeCreated).toHaveBeenCalledTimes(1);
    expect(store.removeCreated).toHaveBeenCalledWith(asset.key);
  });
});

describe("fanart publication file validation", () => {
  function publishRequest(id: string, version: number) {
    return new Request(`https://moingfans.com/api/admin/fanart/${id}/publish`, {
      method: "POST",
      headers: { ...adminHeaders(true), "content-type": "application/json" },
      body: JSON.stringify({ version }),
    });
  }

  it.each(["missing", "corrupt"])("does not publish a ready draft whose saved file is %s", async (damage) => {
    const directory = await mkdtemp(join(tmpdir(), "fanart-publish-"));
    try {
      const store = createFanArtAssetStore(directory);
      const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).png().toBuffer();
      const saved = await store.save(png);
      let current = attachAsset(applyReview(candidate(), confirmed, NOW), saved, NOW);
      const before = structuredClone(current);
      if (damage === "missing") await store.removeCreated(saved.key);
      else await writeFile(join(directory, saved.key), Buffer.from("corrupt"));
      const repo = repository({
        get: async () => current,
        update: async (_id, _version, operation) => { current = operation(current); return current; },
      });
      const handlers = createFanArtHandlers({ getRepository: async () => repo, assets: store, config });

      expect((await handlers.publish(publishRequest(current.id, current.version), current.id)).status).toBe(409);
      expect(current).toEqual(before);
      expect(current.status).toBe("ready");
      expect(current.approvedHash).toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not bind validation of an old asset to a concurrently replaced asset", async () => {
    const before = ready();
    const replacement = { ...asset, key: "762ebfec-d1b5-4e40-bd0b-6dc64188b02a.webp", sha256: "b".repeat(64) };
    let current = before;
    const store = assetStore({ readVerified: async () => {
      current = { ...applyReview(attachAsset(before, replacement, NOW), confirmed, NOW), version: before.version + 1 };
      return Buffer.from("verified-old-file");
    } });
    const repo = repository({
      get: async () => current,
      update: async (_id, version, operation) => {
        if (version !== current.version) throw new FanArtError("version_conflict", "conflict", 409);
        current = operation(current);
        return current;
      },
    });
    const handlers = createFanArtHandlers({ getRepository: async () => repo, assets: store, config });

    expect((await handlers.publish(publishRequest(before.id, before.version), before.id)).status).toBe(409);
    expect(current.status).toBe("ready");
    expect(current.asset?.sha256).toBe("b".repeat(64));
    expect(current.approvedHash).toBeNull();
  });

  it("preserves successful publication retries even if the already-published file is later lost", async () => {
    const current = { ...published(), version: 5 };
    const repo = repository({ get: async () => current, update: async (_id, _version, operation) => operation(current) });
    const handlers = createFanArtHandlers({ getRepository: async () => repo, assets: assetStore({ readVerified: async () => null }), config });

    const response = await handlers.publish(publishRequest(current.id, 4), current.id);
    expect(response.status).toBe(200);
    expect((await response.json()).work).toEqual(current);
  });
});
