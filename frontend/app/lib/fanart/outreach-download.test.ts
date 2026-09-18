import { describe, expect, it } from "vitest";
import { createImageDownloader } from "./outreach-download";
const good = "https://cafefiles.pstatic.net/image.png";
describe("outreach image download boundaries", () => {
  it.each(["http://cafefiles.pstatic.net/a", "https://cafefiles.pstatic.net.evil.test/a", "https://user:pass@cafefiles.pstatic.net/a", "https://127.0.0.1/a", "https://cafefiles.pstatic.net:444/a"])("rejects URL %s before DNS", async value => {
    const download = createImageDownloader({ resolve: async () => { throw new Error("DNS should not be reached"); } });
    await expect(download(value)).rejects.toMatchObject({ code: "unsafe_image_url" });
  });
  it.each(["127.0.0.1", "10.2.3.4", "169.254.169.254", "172.16.4.2", "192.168.1.1", "0.0.0.0", "100.64.0.1", "::1"])("denies local/private DNS %s", async address => {
    await expect(createImageDownloader({ resolve: async () => [address] })(good)).rejects.toMatchObject({ code: "unsafe_image_address" });
  });
  it("uses the validated pinned address, not a second DNS lookup", async () => {
    let resolves = 0;
    const download = createImageDownloader({ resolve: async () => { resolves++; return ["8.8.8.8"]; }, transport: async (url, address) => {
      expect(url.hostname).toBe("cafefiles.pstatic.net"); expect(address).toBe("8.8.8.8");
      return { status: 200, body: (async function* () { yield Buffer.from("image"); })() };
    } });
    expect(Buffer.from(await download(good)).toString()).toBe("image"); expect(resolves).toBe(1);
  });
  it("rejects redirects without following them", async () => {
    const download = createImageDownloader({ resolve: async () => ["8.8.8.8"], transport: async () => ({ status: 302, body: (async function* () {})() }) });
    await expect(download(good)).rejects.toMatchObject({ code: "image_download_failed" });
  });
  it("bounds streamed bytes even without content-length", async () => {
    const download = createImageDownloader({ resolve: async () => ["8.8.8.8"], transport: async () => ({ status: 200, body: (async function* () { yield Buffer.alloc(10 * 1024 * 1024 + 1); })() }) });
    await expect(download(good)).rejects.toMatchObject({ code: "image_too_large" });
  });
});
