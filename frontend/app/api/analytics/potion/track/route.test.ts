import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  window: null as null | { enrollFromMs: number; enrollUntilMs: number; observeUntilMs: number },
}));
const getPotionPool = vi.hoisted(() => vi.fn());
const ensurePotionSchema = vi.hoisted(() => vi.fn());
const ingestPotionEvent = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/analytics/potion-config", () => ({
  POTION_ALLOWED_ORIGIN: "https://moingfans.com",
  get POTION_PILOT_WINDOW() {
    return testState.window;
  },
}));

vi.mock("../../../../lib/analytics/potion-db", () => ({
  getPotionPool,
  ensurePotionSchema,
  ingestPotionEvent,
}));

const payload = {
  schema_version: 1,
  visitor_id: "2197e2ee-e965-471b-bf69-af674815133a",
  event_id: "c998b107-d983-4422-8015-83ba78b3dc54",
  type: "site_active",
};

function request(body: BodyInit = JSON.stringify(payload), headers: HeadersInit = {}) {
  return new Request("http://localhost/api/analytics/potion/track", {
    method: "POST",
    headers: { origin: "https://moingfans.com", ...headers },
    body,
  });
}

describe("POST /api/analytics/potion/track", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    testState.window = { enrollFromMs: 100, enrollUntilMs: 200, observeUntilMs: 300 };
    getPotionPool.mockReset().mockResolvedValue({});
    ensurePotionSchema.mockReset().mockResolvedValue(undefined);
    ingestPotionEvent.mockReset().mockResolvedValue({
      status: 200,
      body: { ok: true, serverNowMs: 150, expiresAtMs: 1_000, dayKst: "2026-09-15" },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns 204 before origin, body, or database work when the pilot is disabled", async () => {
    testState.window = null;
    const { POST } = await import("./route");

    const response = await POST(request("not-json", { origin: "https://evil.example" }));

    expect(response.status).toBe(204);
    expect(getPotionPool).not.toHaveBeenCalled();
    expect(ensurePotionSchema).not.toHaveBeenCalled();
    expect(ingestPotionEvent).not.toHaveBeenCalled();
  });

  it("requires the first-party origin in production before database work", async () => {
    const { POST } = await import("./route");

    const requests = [
      new Request("http://localhost/api/analytics/potion/track", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      request(JSON.stringify(payload), { origin: "https://evil.example" }),
    ];
    for (const candidate of requests) {
      const response = await POST(candidate);
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: "origin_forbidden" });
    }
    expect(getPotionPool).not.toHaveBeenCalled();
  });

  it("allows loopback origins only outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { POST } = await import("./route");

    expect((await POST(request(JSON.stringify(payload), { origin: "http://127.0.0.1:3000" }))).status).toBe(200);
    expect((await POST(request(JSON.stringify(payload), { origin: "http://localhost:3000" }))).status).toBe(200);
    expect((await POST(request(JSON.stringify(payload), { origin: "https://dev.example" }))).status).toBe(403);
  });

  it("rejects bodies over 2 KiB using both content-length and streamed bytes", async () => {
    const { POST } = await import("./route");

    const declared = await POST(request("{}", { "content-length": "2049" }));
    expect(declared.status).toBe(413);

    const streamed = await POST(request(JSON.stringify({ ...payload, padding: "x".repeat(2048) })));
    expect(streamed.status).toBe(413);
    expect(getPotionPool).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON and invalid event contracts", async () => {
    const { POST } = await import("./route");

    const malformed = await POST(request("{"));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "invalid_payload" });

    const invalid = await POST(request(JSON.stringify({ ...payload, score: 500 })));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_payload" });
  });

  it("maps a rejected body stream to a generic no-store response", async () => {
    const { POST } = await import("./route");
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("stream includes sensitive transport details"));
      },
    });
    const brokenRequest = new Request("http://localhost/api/analytics/potion/track", {
      method: "POST",
      headers: { origin: "https://moingfans.com" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(brokenRequest);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "potion_request_unavailable" });
    expect(getPotionPool).not.toHaveBeenCalled();
  });

  it("returns the typed ingest result with no-store headers", async () => {
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      serverNowMs: expect.any(Number),
      expiresAtMs: 1_000,
      dayKst: "2026-09-15",
    });
    expect(ensurePotionSchema).toHaveBeenCalledTimes(1);
    expect(ingestPotionEvent).toHaveBeenCalledWith({}, payload, expect.any(Number), testState.window);
  });

  it("maps semantic conflicts to 400 and hides database errors behind a generic 503", async () => {
    const { POST } = await import("./route");

    ingestPotionEvent.mockResolvedValueOnce({ status: 400, body: { error: "event_conflict" } });
    const conflict = await POST(request());
    expect(conflict.status).toBe(400);
    await expect(conflict.json()).resolves.toEqual({ error: "event_conflict" });

    getPotionPool.mockRejectedValueOnce(new Error("postgres://secret@db.internal/potion"));
    const unavailable = await POST(request());
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ error: "potion_database_unavailable" });
  });
});
