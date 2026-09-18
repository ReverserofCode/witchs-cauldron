import {
  applyReview,
  attachAsset,
  FanArtError,
  normalizeSourceUrl,
  publicImage,
  publishWork,
  rejectWork,
  withdrawWork,
  type FanArtStatus,
  type ReviewInput,
} from "./model";
import { createFanArtAssetStore, type FanArtAssetStore } from "./assets";
import {
  authenticateAdmin,
  getFanArtHttpConfig,
  MULTIPART_BODY_LIMIT,
  readBoundedBody,
  readJsonObject,
  requireMutationOrigin,
  type FanArtHttpConfig,
} from "./http";
import { getFanArtRepository, type FanArtRepository } from "./repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_REALM = "MoingFans Admin";
const STATUSES: ReadonlySet<string> = new Set(["candidate", "requested", "ready", "published", "withdrawn", "rejected"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PREFLIGHT_ASSET = {
  key: "00000000-0000-4000-8000-000000000000.webp",
  sha256: "0".repeat(64),
  bytes: 1,
  width: 1,
  height: 1,
};

interface HandlerDependencies {
  getRepository?: () => Promise<FanArtRepository>;
  assets?: FanArtAssetStore;
  config?: FanArtHttpConfig;
  now?: () => string;
}

function responseHeaders(admin = false) {
  return {
    "cache-control": "no-store",
    ...(admin ? { "x-robots-tag": "noindex, nofollow, noarchive" } : {}),
  };
}

function json(body: unknown, status = 200, admin = false) {
  return Response.json(body, { status, headers: responseHeaders(admin) });
}

function errorResponse(error: unknown, admin = false) {
  if (error instanceof FanArtError) {
    const headers = new Headers(responseHeaders(admin));
    if (error.status === 401) headers.set("www-authenticate", `Basic realm="${ADMIN_REALM}"`);
    return Response.json({ error: error.message }, { status: error.status, headers });
  }
  return json({ error: "서비스를 일시적으로 사용할 수 없습니다." }, 503, admin);
}

function validId(id: string) {
  if (!UUID.test(id)) throw new FanArtError("invalid_id", "작품 ID 형식이 올바르지 않습니다.", 400);
}

function positiveVersion(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new FanArtError("invalid_version", "버전 번호가 올바르지 않습니다.", 400);
  }
  return value as number;
}

function stringField(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new FanArtError("invalid_input", `${label} 형식이 올바르지 않습니다.`, 400);
  }
  return value.trim();
}

function reviewInput(value: unknown): ReviewInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FanArtError("invalid_review", "허락 및 검수 기록 형식이 올바르지 않습니다.", 400);
  }
  const input = value as Record<string, unknown>;
  const permission = input.permission;
  const review = input.review;
  if (
    typeof input.requested !== "boolean"
    || !permission
    || typeof permission !== "object"
    || Array.isArray(permission)
    || !review
    || typeof review !== "object"
    || Array.isArray(review)
  ) {
    throw new FanArtError("invalid_review", "허락 및 검수 기록 형식이 올바르지 않습니다.", 400);
  }
  return value as ReviewInput;
}

async function parseMultipart(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;") || !/boundary=/i.test(contentType)) {
    throw new FanArtError("invalid_multipart", "multipart 업로드 형식이 필요합니다.", 400);
  }
  const body = await readBoundedBody(request, MULTIPART_BODY_LIMIT);
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    }).formData();
  } catch {
    throw new FanArtError("invalid_multipart", "multipart 업로드 형식이 올바르지 않습니다.", 400);
  }
  for (const key of form.keys()) {
    if (key !== "version" && key !== "file") {
      throw new FanArtError("invalid_multipart", "허용되지 않은 업로드 필드입니다.", 400);
    }
  }
  const versionValue = form.get("version");
  const fileValue = form.get("file");
  if (typeof versionValue !== "string" || !/^[1-9]\d*$/.test(versionValue)) {
    throw new FanArtError("invalid_version", "버전 번호가 올바르지 않습니다.", 400);
  }
  if (typeof File === "undefined" || !(fileValue instanceof File)) {
    throw new FanArtError("invalid_file", "업로드할 이미지 파일이 필요합니다.", 400);
  }
  if (fileValue.size === 0 || fileValue.size > MAX_FILE_BYTES) {
    throw new FanArtError("image_too_large", "이미지 파일 크기 제한을 초과했습니다.", 413);
  }
  return { version: positiveVersion(Number(versionValue)), file: fileValue };
}

export function createFanArtHandlers(dependencies: HandlerDependencies = {}) {
  const getRepository = dependencies.getRepository ?? getFanArtRepository;
  const assets = dependencies.assets ?? createFanArtAssetStore();
  const config = dependencies.config ?? getFanArtHttpConfig();
  const now = dependencies.now ?? (() => new Date().toISOString());

  function guard(request: Request, mutation = false) {
    authenticateAdmin(request, config);
    if (mutation) requireMutationOrigin(request, config);
  }

  return {
    async adminList(request: Request) {
      try {
        guard(request);
        const url = new URL(request.url);
        const statusValue = url.searchParams.get("status");
        if (statusValue && !STATUSES.has(statusValue)) {
          throw new FanArtError("invalid_status", "상태 필터가 올바르지 않습니다.", 400);
        }
        const offsetValue = url.searchParams.get("offset") ?? "0";
        const limitValue = url.searchParams.get("limit") ?? "50";
        if (!/^\d+$/.test(offsetValue) || !/^[1-9]\d*$/.test(limitValue)) {
          throw new FanArtError("invalid_pagination", "페이지 번호가 올바르지 않습니다.", 400);
        }
        const offset = Number(offsetValue);
        const limit = Number(limitValue);
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(limit) || limit > 50) {
          throw new FanArtError("invalid_pagination", "페이지 번호가 올바르지 않습니다.", 400);
        }
        const repository = await getRepository();
        return json(await repository.list({ status: statusValue as FanArtStatus | undefined, offset, limit }), 200, true);
      } catch (error) {
        return errorResponse(error, true);
      }
    },

    async create(request: Request) {
      try {
        guard(request, true);
        const body = await readJsonObject(request);
        const sourceUrl = stringField(body.sourceUrl, "원문 URL", 2048);
        const title = stringField(body.title, "작품 제목", 200);
        const credit = stringField(body.credit, "작가명", 100);
        normalizeSourceUrl(sourceUrl);
        const repository = await getRepository();
        const work = await repository.create({ sourceUrl, title, credit }, now());
        return json({ work }, 201, true);
      } catch (error) {
        return errorResponse(error, true);
      }
    },

    async detail(request: Request, id: string) {
      try {
        guard(request);
        validId(id);
        const repository = await getRepository();
        const work = await repository.get(id);
        if (!work) throw new FanArtError("not_found", "작품을 찾을 수 없습니다.", 404);
        const events = await repository.audit(id);
        return json({ work, events }, 200, true);
      } catch (error) {
        return errorResponse(error, true);
      }
    },

    async review(request: Request, id: string) {
      try {
        guard(request, true);
        validId(id);
        const body = await readJsonObject(request);
        const version = positiveVersion(body.version);
        const input = reviewInput(body.review);
        const operationNow = now();
        const repository = await getRepository();
        const work = await repository.update(id, version, (current) => applyReview(current, input, operationNow));
        return json({ work }, 200, true);
      } catch (error) {
        return errorResponse(error, true);
      }
    },

    async uploadAsset(request: Request, id: string) {
      try {
        guard(request, true);
        validId(id);
        const { version, file } = await parseMultipart(request);
        const repository = await getRepository();
        const current = await repository.get(id);
        if (!current) throw new FanArtError("not_found", "작품을 찾을 수 없습니다.", 404);
        if (current.version !== version) {
          throw new FanArtError("version_conflict", "다른 변경이 저장되었습니다. 새로고침 후 다시 시도해 주세요.", 409);
        }
        const operationNow = now();
        attachAsset(current, PREFLIGHT_ASSET, operationNow);
        const saved = await assets.save(new Uint8Array(await file.arrayBuffer()));
        try {
          const work = await repository.update(id, version, (locked) => attachAsset(locked, saved, operationNow));
          return json({ work }, 200, true);
        } catch (error) {
          await assets.removeCreated(saved.key).catch(() => undefined);
          throw error;
        }
      } catch (error) {
        return errorResponse(error, true);
      }
    },

    async publish(request: Request, id: string) {
      return action(request, id, (work, timestamp) => publishWork(work, timestamp));
    },

    async withdraw(request: Request, id: string) {
      return action(request, id, (work, timestamp) => withdrawWork(work, timestamp));
    },

    async reject(request: Request, id: string) {
      return action(request, id, (work, timestamp) => rejectWork(work, timestamp));
    },

    async publicList(request: Request) {
      try {
        void request;
        const repository = await getRepository();
        const works = await repository.published();
        return json({ images: works.map(publicImage) });
      } catch (error) {
        return errorResponse(error);
      }
    },

    async media(_request: Request, id: string) {
      try {
        validId(id);
        const repository = await getRepository();
        const work = await repository.get(id);
        if (!work) throw new FanArtError("not_found", "이미지를 찾을 수 없습니다.", 404);
        publicImage(work);
        const asset = work.asset;
        if (!asset) throw new FanArtError("not_found", "이미지를 찾을 수 없습니다.", 404);
        const data = await assets.readVerified(asset);
        if (!data) throw new FanArtError("not_found", "이미지를 찾을 수 없습니다.", 404);
        return new Response(new Uint8Array(data), {
          headers: {
            "cache-control": "no-store",
            "content-type": "image/webp",
            "x-content-type-options": "nosniff",
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };

  async function action(
    request: Request,
    id: string,
    operation: (work: Parameters<Parameters<FanArtRepository["update"]>[2]>[0], timestamp: string) => ReturnType<Parameters<FanArtRepository["update"]>[2]>,
  ) {
    try {
      guard(request, true);
      validId(id);
      const body = await readJsonObject(request);
      const version = positiveVersion(body.version);
      const operationNow = now();
      const repository = await getRepository();
      const work = await repository.update(id, version, (current) => operation(current, operationNow));
      return json({ work }, 200, true);
    } catch (error) {
      return errorResponse(error, true);
    }
  }
}

export const fanArtHandlers = createFanArtHandlers();
