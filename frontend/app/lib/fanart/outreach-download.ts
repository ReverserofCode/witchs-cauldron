import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIPv4 } from "node:net";
import { FanArtError } from "./model";

const HOSTS = new Set(["cafefiles.pstatic.net", "cafeptthumb-phinf.pstatic.net", "postfiles.pstatic.net"]);
const LIMIT = 10 * 1024 * 1024;
const denied = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) denied.addSubnet(address, prefix, "ipv4");
interface DownloadResponse { status: number; body: AsyncIterable<Uint8Array>; close?: () => void }
interface DownloadDependencies {
  resolve?: (hostname: string) => Promise<string[]>;
  transport?: (url: URL, address: string, signal: AbortSignal) => Promise<DownloadResponse>;
}
function failure(code: string, message: string, status = 400) { return new FanArtError(code, message, status); }
async function transport(url: URL, address: string, signal: AbortSignal): Promise<DownloadResponse> {
  return new Promise((resolve, reject) => {
    // No cookies, authorization, proxy, pooled socket or second DNS resolution.
    const req = request(url, { method: "GET", agent: false, signal, family: 4,
      lookup: (_host, _options, callback) => callback(null, address, 4),
      headers: { accept: "image/png,image/jpeg,image/webp" },
    }, response => resolve({ status: response.statusCode ?? 0, body: response, close: () => response.destroy() }));
    req.on("error", reject);
    req.end();
  });
}
export function createImageDownloader(dependencies: DownloadDependencies = {}) {
  const resolve = dependencies.resolve ?? (async (hostname: string) => (await lookup(hostname, { all: true, family: 4 })).map(entry => entry.address));
  const send = dependencies.transport ?? transport;
  return async (value: string): Promise<Uint8Array> => {
    let url: URL;
    try { url = new URL(value); } catch { throw failure("unsafe_image_url", "지원하지 않는 이미지 URL입니다."); }
    if (url.protocol !== "https:" || !HOSTS.has(url.hostname) || url.port || url.username || url.password || url.hash) throw failure("unsafe_image_url", "지원하지 않는 이미지 URL입니다.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: DownloadResponse | undefined;
    try {
      const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(failure("image_download_failed", "이미지 다운로드 시간이 초과되었습니다.")), { once: true }));
      const addresses = await Promise.race([resolve(url.hostname), aborted]);
      if (!addresses.length || addresses.some(address => !isIPv4(address) || denied.check(address, "ipv4"))) throw failure("unsafe_image_address", "로컬 또는 비공개 이미지 주소는 사용할 수 없습니다.");
      response = await Promise.race([send(url, addresses[0], controller.signal), aborted]);
      if (response.status !== 200) throw failure("image_download_failed", "이미지 응답을 확인할 수 없습니다. 리디렉션은 허용되지 않습니다.");
      const body = response.body;
      return await Promise.race([(async () => {
        const chunks: Buffer[] = []; let bytes = 0;
        for await (const chunk of body) {
          bytes += chunk.byteLength;
          if (bytes > LIMIT) throw failure("image_too_large", "이미지 파일 크기 제한을 초과했습니다.", 413);
          chunks.push(Buffer.from(chunk));
        }
        if (!bytes) throw failure("image_download_failed", "이미지 파일이 비어 있습니다.");
        return Buffer.concat(chunks, bytes);
      })(), aborted]);
    } finally { clearTimeout(timeout); controller.abort(); response?.close?.(); }
  };
}
