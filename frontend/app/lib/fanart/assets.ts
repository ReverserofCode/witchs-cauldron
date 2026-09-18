import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import { FanArtError, type FanArtAsset } from "./model";

const INPUT_BYTES_LIMIT = 10 * 1024 * 1024;
const OUTPUT_BYTES_LIMIT = 5 * 1024 * 1024;
const PIXEL_LIMIT = 20_000_000;
const LONG_EDGE_LIMIT = 1600;
const ASSET_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

export interface FanArtAssetStore {
  save(input: Uint8Array): Promise<FanArtAsset>;
  readVerified(asset: FanArtAsset): Promise<Buffer | null>;
  removeCreated(key: string): Promise<void>;
}

function isSupportedMagic(input: Buffer) {
  const png = input.length >= 8 && input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const webp = input.length >= 12 && input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
  return png || jpeg || webp;
}

function defaultDirectory() {
  if (process.env.FANART_ASSETS_DIR?.trim()) return process.env.FANART_ASSETS_DIR.trim();
  return process.env.NODE_ENV === "production"
    ? "/app/data/fanart"
    : join(process.cwd(), ".data", "fanart");
}

export function createFanArtAssetStore(directory = defaultDirectory()): FanArtAssetStore {
  return {
    async save(bytes) {
      const input = Buffer.from(bytes);
      if (input.length === 0 || input.length > INPUT_BYTES_LIMIT) {
        throw new FanArtError("image_too_large", "이미지 파일 크기 제한을 초과했습니다.", 413);
      }
      if (!isSupportedMagic(input)) {
        throw new FanArtError("invalid_image", "PNG, JPEG, WebP 정지 이미지만 업로드할 수 있습니다.", 400);
      }

      let metadata: {
        width?: number;
        height?: number;
        format?: string;
        pages?: number;
      };
      try {
        metadata = await sharp(input, { animated: true, limitInputPixels: false, failOn: "error" }).metadata();
      } catch {
        throw new FanArtError("invalid_image", "이미지 파일을 확인할 수 없습니다.", 400);
      }
      if (
        !metadata.width
        || !metadata.height
        || !(["png", "jpeg", "webp"] as Array<string | undefined>).includes(metadata.format)
        || (metadata.pages ?? 1) !== 1
      ) {
        throw new FanArtError("invalid_image", "PNG, JPEG, WebP 정지 이미지만 업로드할 수 있습니다.", 400);
      }
      if (metadata.width * metadata.height > PIXEL_LIMIT) {
        throw new FanArtError("image_too_large", "이미지 픽셀 수 제한을 초과했습니다.", 413);
      }

      let converted: { data: Buffer; info: { width: number; height: number } };
      try {
        converted = await sharp(input, {
          animated: false,
          limitInputPixels: PIXEL_LIMIT,
          failOn: "error",
        })
          .rotate()
          .resize({ width: LONG_EDGE_LIMIT, height: LONG_EDGE_LIMIT, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85, effort: 4 })
          .toBuffer({ resolveWithObject: true });
      } catch {
        throw new FanArtError("invalid_image", "이미지 파일을 변환할 수 없습니다.", 400);
      }
      const { data: output, info } = converted;
      if (output.length > OUTPUT_BYTES_LIMIT) {
        throw new FanArtError("image_output_too_large", "변환된 이미지 크기 제한을 초과했습니다.", 413);
      }

      await mkdir(directory, { recursive: true });
      let key = "";
      for (let attempt = 0; attempt < 3; attempt += 1) {
        key = `${randomUUID()}.webp`;
        try {
          await writeFile(join(directory, key), output, { flag: "wx" });
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt === 2) throw error;
        }
      }
      return {
        key,
        sha256: createHash("sha256").update(output).digest("hex"),
        bytes: output.length,
        width: info.width,
        height: info.height,
      };
    },

    async readVerified(asset) {
      if (!ASSET_KEY.test(asset.key)) return null;
      let data: Buffer;
      try {
        data = await readFile(join(directory, asset.key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      const actual = createHash("sha256").update(data).digest("hex");
      if (actual !== asset.sha256 || data.length !== asset.bytes) return null;
      return data;
    },

    async removeCreated(key) {
      if (!ASSET_KEY.test(key)) return;
      await unlink(join(directory, key)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    },
  };
}
