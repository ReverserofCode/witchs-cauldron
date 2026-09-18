import { createHash, timingSafeEqual } from "node:crypto";

import { FanArtError } from "./model";

export const JSON_BODY_LIMIT = 32 * 1024;
export const MULTIPART_BODY_LIMIT = 11 * 1024 * 1024;

export interface FanArtHttpConfig {
  username: string;
  password: string;
  origin: string;
}

export function getFanArtHttpConfig(): FanArtHttpConfig {
  return {
    username: process.env.ADMIN_BASIC_AUTH_USERNAME ?? "",
    password: process.env.ADMIN_BASIC_AUTH_PASSWORD ?? "",
    origin: process.env.FANART_ALLOWED_ORIGIN ?? "",
  };
}

function credentialHash(username: string, password: string) {
  return createHash("sha256").update(username).update("\0").update(password).digest();
}

function parseBasic(header: string | null) {
  if (!header || !/^Basic\s+/i.test(header)) return null;
  const encoded = header.replace(/^Basic\s+/i, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

export function authenticateAdmin(request: Request, config = getFanArtHttpConfig()) {
  if (!config.username || !config.password) {
    throw new FanArtError("admin_disabled", "관리자 API가 비활성화되어 있습니다.", 503);
  }
  const supplied = parseBasic(request.headers.get("authorization"));
  const expectedHash = credentialHash(config.username, config.password);
  const suppliedHash = supplied
    ? credentialHash(supplied.username, supplied.password)
    : credentialHash("", "");
  if (!supplied || !timingSafeEqual(expectedHash, suppliedHash)) {
    throw new FanArtError("unauthorized", "관리자 인증이 필요합니다.", 401);
  }
}

export function requireMutationOrigin(request: Request, config = getFanArtHttpConfig()) {
  if (!config.origin) {
    throw new FanArtError("admin_disabled", "관리자 API가 비활성화되어 있습니다.", 503);
  }
  if (request.headers.get("origin") !== config.origin) {
    throw new FanArtError("invalid_origin", "허용되지 않은 요청 출처입니다.", 403);
  }
}

export async function readBoundedBody(request: Request, limit: number) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > limit) {
    throw new FanArtError("body_too_large", "요청 본문이 너무 큽니다.", 413);
  }
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => undefined);
        throw new FanArtError("body_too_large", "요청 본문이 너무 큽니다.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), length);
}

export async function readJsonObject(request: Request) {
  const body = await readBoundedBody(request, JSON_BODY_LIMIT);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw new FanArtError("invalid_json", "JSON 요청 형식이 올바르지 않습니다.", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FanArtError("invalid_json", "JSON 요청 형식이 올바르지 않습니다.", 400);
  }
  return parsed as Record<string, unknown>;
}
