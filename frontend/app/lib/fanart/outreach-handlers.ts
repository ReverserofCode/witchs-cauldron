import { createFanArtAssetStore, type FanArtAssetStore } from "./assets";
import { authenticateAdmin, getFanArtHttpConfig, readJsonObject, requireMutationOrigin, type FanArtHttpConfig } from "./http";
import { errorResponse, json, positiveVersion, responseHeaders, validId } from "./handlers";
import { FanArtError } from "./model";
import { createOutreachService, type ConfirmOutreachInput } from "./outreach";
import { getFanArtRepository, type FanArtRepository } from "./repository";

interface Dependencies { getRepository?: () => Promise<FanArtRepository>; assets?: FanArtAssetStore; config?: FanArtHttpConfig; now?: () => string }
export function createOutreachHandlers(dependencies: Dependencies = {}) {
  const getRepository = dependencies.getRepository ?? getFanArtRepository;
  const assets = dependencies.assets ?? createFanArtAssetStore();
  const config = dependencies.config ?? getFanArtHttpConfig();
  return {
    async action(request: Request, id: string) {
      try {
        authenticateAdmin(request, config); requireMutationOrigin(request, config); validId(id);
        const body = await readJsonObject(request), version = positiveVersion(body.version);
        if (!["enqueue", "cancel", "confirm", "approve", "reject"].includes(String(body.action))) throw new FanArtError("invalid_action", "지원하지 않는 작업입니다.");
        const service = createOutreachService({ repository: await getRepository(), assets, now: dependencies.now });
        let work;
        switch (body.action) {
          case "enqueue": work = await service.enqueue(id, version); break;
          case "cancel": work = await service.cancel(id, version); break;
          case "reject": work = await service.reject(id, version); break;
          case "confirm": {
            const input = body.confirmation;
            if (!input || typeof input !== "object" || Array.isArray(input)) throw new FanArtError("invalid_input", "작가 답변과 이미지 확인이 필요합니다.");
            work = await service.confirm(id, version, input as ConfirmOutreachInput); break;
          }
          case "approve":
            if (typeof body.preparedHash !== "string" || !/^[0-9a-f]{64}$/.test(body.preparedHash)) throw new FanArtError("invalid_asset", "준비된 이미지 해시가 필요합니다.");
            work = await service.approve(id, version, body.preparedHash); break;
        }
        return json({ work }, 200, true);
      } catch (error) { return errorResponse(error, true); }
    },
    async preview(request: Request, id: string) {
      try {
        authenticateAdmin(request, config); validId(id);
        const repository = await getRepository(), work = await repository.get(id);
        const hash = new URL(request.url).searchParams.get("sha256");
        if (!work?.asset || ["rejected", "withdrawn"].includes(work.status) || !["prepared", "publication_queued"].includes(work.outreach?.status ?? "") || hash !== work.asset.sha256) throw new FanArtError("not_found", "검토 가능한 준비 이미지가 없습니다.", 404);
        const data = await assets.readVerified(work.asset);
        if (!data) throw new FanArtError("not_found", "준비된 파일이 일치하지 않습니다.", 404);
        const latest = await repository.get(id);
        if (latest?.version !== work.version) throw new FanArtError("version_conflict", "작품이 변경되었습니다.", 409);
        return new Response(new Uint8Array(data), { headers: { ...responseHeaders(true), "content-type": "image/webp", "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" } });
      } catch (error) { return errorResponse(error, true); }
    },
  };
}
export const outreachHandlers = createOutreachHandlers();
