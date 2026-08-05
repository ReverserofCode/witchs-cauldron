import fs from "node:fs";
import type { Stats } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";

import { getClipOpenFlags, resolveClipPath } from "../../lib/clips/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
};

type RouteContext = {
  params: Promise<{ filename: string[] }>;
};

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
  const resolution = resolveClipPath(filename);

  if (resolution.status === "invalid") {
    return NextResponse.json({ error: "Invalid clip path" }, { status: 400 });
  }

  if (resolution.status === "not-found") {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const clipPath = resolution.path;

  const extension = path.extname(clipPath).toLowerCase();
  const contentType = VIDEO_CONTENT_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported clip type" }, { status: 415 });
  }

  let fileDescriptor: number | null = null;
  let stat: Stats;
  try {
    fileDescriptor = fs.openSync(clipPath, getClipOpenFlags(fs.constants));
    stat = fs.fstatSync(fileDescriptor);

    const realRoot = fs.realpathSync(resolution.root);
    const realClipPath = fs.realpathSync(clipPath);
    const relativePath = path.relative(realRoot, realClipPath);
    const resolvedStat = fs.statSync(realClipPath);
    const isWithinRoot =
      Boolean(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath);
    const isSameFile = resolvedStat.dev === stat.dev && resolvedStat.ino === stat.ino;

    if (!isWithinRoot || !isSameFile) {
      throw new Error("Clip changed during secure open");
    }
  } catch {
    if (fileDescriptor !== null) fs.closeSync(fileDescriptor);
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (!stat.isFile()) {
    fs.closeSync(fileDescriptor);
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const range = parseRange(req.headers.get("range"), stat.size);
  if (range === "invalid") {
    fs.closeSync(fileDescriptor);
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
      fs.closeSync(fileDescriptor);
      return new NextResponse(null, { status: 206, headers });
    }

    const stream = fs.createReadStream(clipPath, {
      fd: fileDescriptor,
      autoClose: true,
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
    fs.closeSync(fileDescriptor);
    return new NextResponse(null, { status: 200, headers });
  }

  const stream = fs.createReadStream(clipPath, {
    fd: fileDescriptor,
    autoClose: true,
  });

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
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
