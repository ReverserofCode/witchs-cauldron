import { NextResponse } from "next/server";
import {
  diagnoseSchedule,
  fetchScheduleFromPublishedCsv,
  ScheduleSourceError,
} from "./schedule";

const DEFAULT_REVALIDATE_SECONDS = 60 * 10; // 10 minutes

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const debugFlag = requestUrl.searchParams.get("debug");
  const diagnosticsFlag = requestUrl.searchParams.get("diagnostics");
  const isDebugMode = debugFlag === "1" || diagnosticsFlag === "1";

  const csvUrl = process.env.BROADCAST_SCHEDULE_CSV_URL;
  const hasEnvUrl = Boolean(csvUrl && csvUrl.trim());

  if (isDebugMode) {
    const diagnostics = await diagnoseSchedule(csvUrl, {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
    });

    const status = diagnostics.ok ? 200 : diagnostics.errorStatus ?? 500;

    return NextResponse.json(
      {
        diagnostics,
        feed: diagnostics.feed ?? null,
        hint: hasEnvUrl
          ? undefined
          : "BROADCAST_SCHEDULE_CSV_URL 환경 변수가 비어 있어 기본 구글 시트를 사용했습니다. 다른 시트를 사용하려면 환경 변수를 설정하세요.",
      },
      {
        status,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  try {
    const feed = await fetchScheduleFromPublishedCsv(csvUrl, {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
    });

    return NextResponse.json(feed, {
      status: 200,
      headers: {
        "cache-control": `s-maxage=${DEFAULT_REVALIDATE_SECONDS}`,
      },
    });
  } catch (error) {
    if (error instanceof ScheduleSourceError) {
      const diagnostics = await diagnoseSchedule(csvUrl, {
        revalidate: DEFAULT_REVALIDATE_SECONDS,
      });

      return NextResponse.json(
        {
          error: error.message,
          diagnostics,
        },
        { status: error.status }
      );
    }

    console.error("[broadCastSchedule] Unexpected error", error);

    const diagnostics = await diagnoseSchedule(csvUrl, {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
    });

    return NextResponse.json(
      {
        error: "Failed to load broadcast schedule.",
        diagnostics,
      },
      { status: 500 }
    );
  }
}
