import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "../../../proxy";

function request(path: string, authorization?: string) {
  return new NextRequest(`https://moingfans.com${path}`, {
    headers: authorization ? { authorization } : undefined,
  });
}

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fanart proxy authentication", () => {
  it.each(["/api/admin/fanart", "/admin/fanart"])(
    "fails closed for %s without credentials even in development",
    async (path) => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_BASIC_AUTH_USERNAME", "");
      vi.stubEnv("ADMIN_BASIC_AUTH_PASSWORD", "");

      const response = await proxy(request(path));

      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("accepts exact fanart credentials and rejects a long common-prefix mismatch", async () => {
    vi.stubEnv("ADMIN_BASIC_AUTH_USERNAME", "operator");
    vi.stubEnv("ADMIN_BASIC_AUTH_PASSWORD", "shared-prefix-correct");

    const accepted = await proxy(request(
      "/api/admin/fanart",
      basic("operator", "shared-prefix-correct"),
    ));
    const rejected = await proxy(request(
      "/api/admin/fanart",
      basic("operator", "shared-prefix-wrong"),
    ));

    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("x-middleware-next")).toBe("1");
    expect(rejected.status).toBe(401);
  });

  it("preserves the existing development bypass for unrelated admin routes", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_BASIC_AUTH_USERNAME", "");
    vi.stubEnv("ADMIN_BASIC_AUTH_PASSWORD", "");

    const response = await proxy(request("/admin/analytics"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
