import { describe, expect, it } from "vitest";

import { authenticateAdmin, readBoundedBody, requireMutationOrigin } from "./http";

const credentials = {
  username: "operator",
  password: "correct horse battery staple",
  origin: "https://moingfans.com",
};

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe("fanart HTTP guards", () => {
  it("accepts exact Basic credentials and rejects missing, malformed, or unequal credentials", () => {
    const accepted = new Request("https://moingfans.com/api/admin/fanart", {
      headers: { authorization: basic(credentials.username, credentials.password) },
    });
    expect(() => authenticateAdmin(accepted, credentials)).not.toThrow();

    for (const authorization of [
      undefined,
      "Bearer token",
      "Basic not-base64!",
      basic(credentials.username, "wrong"),
      basic(`${credentials.username}x`, credentials.password),
    ]) {
      const request = new Request("https://moingfans.com/api/admin/fanart", {
        headers: authorization ? { authorization } : undefined,
      });
      expect(() => authenticateAdmin(request, credentials)).toThrowError(expect.objectContaining({ status: 401 }));
    }
  });

  it("fails closed when credentials are not configured", () => {
    const request = new Request("http://localhost/api/admin/fanart", {
      headers: { authorization: basic("operator", "password") },
    });
    expect(() => authenticateAdmin(request, { username: "", password: "", origin: credentials.origin }))
      .toThrowError(expect.objectContaining({ status: 503 }));
  });

  it("requires the exact configured origin for every mutation", () => {
    const accepted = new Request("https://internal/api/admin/fanart", {
      method: "POST",
      headers: { origin: credentials.origin },
    });
    expect(() => requireMutationOrigin(accepted, credentials)).not.toThrow();

    for (const origin of [undefined, "https://attacker.invalid", "https://moingfans.com.evil.invalid"] as const) {
      const request = new Request("https://internal/api/admin/fanart", {
        method: "POST",
        headers: origin ? { origin } : undefined,
      });
      expect(() => requireMutationOrigin(request, credentials)).toThrowError(expect.objectContaining({ status: 403 }));
    }
  });

  it("bounds the actual stream even when Content-Length claims the body is small", async () => {
    const chunk = new Uint8Array(700).fill(65);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = new Request("https://moingfans.com/api/admin/fanart", {
      method: "POST",
      headers: { "content-length": "1" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedBody(request, 1024)).rejects.toMatchObject({ code: "body_too_large", status: 413 });
  });

  it("rejects an oversized declared length before consuming the stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const request = new Request("https://moingfans.com/api/admin/fanart", {
      method: "POST",
      headers: { "content-length": "9999" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedBody(request, 100)).rejects.toMatchObject({ status: 413 });
  });
});
