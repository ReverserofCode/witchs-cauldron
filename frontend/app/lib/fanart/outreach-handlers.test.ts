import { describe, expect, it } from "vitest";
import { createOutreachHandlers } from "./outreach-handlers";
const config = { username: "test", password: "test-only", origin: "https://example.test" };
const auth = `Basic ${Buffer.from("test:test-only").toString("base64")}`;
const id = "10000000-0000-4000-8000-000000000001";
describe("outreach administrator boundary", () => {
  const handlers = () => createOutreachHandlers({ config, getRepository: async () => { throw new Error("unavailable"); } });
  it("protects prepared bytes and mutation without contacting repository", async () => {
    const request = new Request("https://example.test/api/outreach");
    expect((await handlers().preview(request, id)).status).toBe(401);
    expect((await handlers().action(request, id)).status).toBe(401);
  });
  it("requires exact Origin for every mutation", async () => {
    const request = new Request("https://example.test/api/outreach", { method: "POST", headers: { authorization: auth, origin: "https://evil.test" }, body: "{}" });
    expect((await handlers().action(request, id)).status).toBe(403);
  });
  it("validates action, version and id before repository access", async () => {
    for (const body of [{ action: "send", version: 1 }, { action: "enqueue", version: 0 }]) {
      const response = await handlers().action(new Request("https://example.test/api/outreach", { method: "POST", headers: { authorization: auth, origin: config.origin }, body: JSON.stringify(body) }), id);
      expect(response.status).toBe(400);
    }
    expect((await handlers().preview(new Request("https://example.test/api/outreach", { headers: { authorization: auth } }), "not-id")).status).toBe(400);
  });
  it("does not expose internal errors or cache administrator responses", async () => {
    const response = await handlers().action(new Request("https://example.test/api/outreach", { method: "POST", headers: { authorization: auth, origin: config.origin }, body: JSON.stringify({ action: "enqueue", version: 1 }) }), id);
    expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("unavailable");
  });
});
