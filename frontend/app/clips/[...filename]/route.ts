import fs from "node:fs";
import type { Stats } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLIPS_DIR = path.join(process.cwd(), "public", "clips");
const VIDEO_CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
};

type RouteContext = {
  params: Promise<{ filename: string[] }>;
};

function resolveClipPath(filenameParts: string[]): string | null {
  const requestedPath = filenameParts.join("/");
  const resolvedPath = path.resolve(CLIPS_DIR, requestedPath);
  const clipsRoot = path.resolve(CLIPS_DIR);

  if (!resolvedPath.startsWith(`${clipsRoot}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

function parseRange(rangeHeader: string | null, fileSize: number) {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return "invalid" as const;

  const startText = match[1];
  const endText = match[2];
  let start = startText ? Number(startText) : 0;
  let end = endText ? Number(endText) : fileSize - 1;

  if (!startText && endText) {
    const suffixLength = Number(endText);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return "invalid" as const;
  }

  return { start, end: Math.min(end, fileSize - 1) };
}

async function serveClip(req: NextRequest, { params }: RouteContext, headOnly = false) {
  const { filename } = await params;
  const clipPath = resolveClipPath(filename);

  if (!clipPath) {
    return NextResponse.json({ error: "Invalid clip path" }, { status: 400 });
  }

  const extension = path.extname(clipPath).toLowerCase();
  const contentType = VIDEO_CONTENT_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported clip type" }, { status: 415 });
  }

  let stat: Stats;
  try {
    stat = fs.statSync(clipPath);
  } catch {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (!stat.isFile()) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const range = parseRange(req.headers.get("range"), stat.size);
  if (range === "invalid") {
    return new NextResponse(null, {
      status: 416,
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes */${stat.size}`,
      },
    });
  }

  const commonHeaders = {
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=0, must-revalidate",
    "content-type": contentType,
  };

  if (range) {
    const contentLength = range.end - range.start + 1;
    const headers = {
      ...commonHeaders,
      "content-length": String(contentLength),
      "content-range": `bytes ${range.start}-${range.end}/${stat.size}`,
    };

    if (headOnly) {
      return new NextResponse(null, { status: 206, headers });
    }

    const stream = fs.createReadStream(clipPath, {
      start: range.start,
      end: range.end,
    });

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers,
    });
  }

  const headers = {
    ...commonHeaders,
    "content-length": String(stat.size),
  };

  if (headOnly) {
    return new NextResponse(null, { status: 200, headers });
  }

  return new NextResponse(Readable.toWeb(fs.createReadStream(clipPath)) as ReadableStream, {
    status: 200,
    headers,
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  return serveClip(req, context);
}

export async function HEAD(req: NextRequest, context: RouteContext) {
  return serveClip(req, context, true);
}
