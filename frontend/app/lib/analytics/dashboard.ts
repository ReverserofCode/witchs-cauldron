export type AnalyticsHealthLevel = "ok" | "warning" | "critical";

export type AnalyticsHealthResponse = {
  ok: boolean;
  database: {
    connected: boolean;
    latencyMs: number;
  };
  events?: {
    latestEventAt: string | null;
    events24h: number;
    pageviews24h: number;
    unknownEvents: number;
    missingVisitorKey: number;
    missingEventDateKst: number;
  };
  schema?: {
    version: number;
    timeZone: string;
    requiredColumns: readonly string[];
    requiredIndexes: readonly string[];
    missingColumns: readonly string[];
    missingIndexes: readonly string[];
  };
  generatedAt: string;
  error?: string;
};

export type AnalyticsHealthStatus = {
  level: AnalyticsHealthLevel;
  label: string;
  reasons: string[];
};

export type AnalyticsProfileInput = {
  rows: number;
  events24h: number;
  missingVisitorKey: number;
  missingEventDateKst: number;
  rawIpRows: number;
  unknownEvents: number;
  duplicateEventIds: number;
};

export type AnalyticsProfileFinding = {
  severity: "high" | "medium" | "low";
  message: string;
};

const EMPTY_STATES = {
  trend: {
    title: "선택한 기간에 데이터가 없습니다.",
    description: "날짜 범위를 바꾸거나 최근 24시간 수집 상태를 확인하세요.",
  },
  sections: {
    title: "섹션 조회 데이터가 없습니다.",
    description: "section_view 이벤트가 아직 수집되지 않았거나 화면 노출 기준에 도달하지 않았습니다.",
  },
  scroll: {
    title: "스크롤 깊이 데이터가 없습니다.",
    description: "scroll_depth 이벤트 수집 여부와 metadata.threshold 값을 확인하세요.",
  },
  device: {
    title: "디바이스 분류 데이터가 없습니다.",
    description: "device_category metadata가 없는 legacy 이벤트가 대부분일 수 있습니다.",
  },
  interactions: {
    title: "상호작용 데이터가 없습니다.",
    description: "menu_click 또는 content_click 이벤트 수집 여부를 확인하세요.",
  },
  menuClicks: {
    title: "메뉴 클릭 데이터가 없습니다.",
    description: "헤더, 사이드바, 푸터 링크의 data-analytics 속성과 track API 상태를 확인하세요.",
  },
  paths: {
    title: "페이지 경로 데이터가 없습니다.",
    description: "pageview 이벤트가 비어 있거나 path 값이 누락되었을 수 있습니다.",
  },
  referrers: {
    title: "유입 데이터가 없습니다.",
    description: "직접 방문만 있거나 referrer_host backfill이 아직 끝나지 않았을 수 있습니다.",
  },
  generic: {
    title: "데이터가 없습니다.",
    description: "수집 상태와 조회 기간을 확인하세요.",
  },
} as const;

export type AnalyticsEmptyStateKind = keyof typeof EMPTY_STATES;

export function getAnalyticsHealthStatus(health: AnalyticsHealthResponse | null): AnalyticsHealthStatus {
  if (!health) {
    return {
      level: "warning",
      label: "확인 중",
      reasons: ["운영 상태를 아직 불러오지 못했습니다."],
    };
  }

  const criticalReasons: string[] = [];
  const warningReasons: string[] = [];

  if (!health.database.connected) {
    criticalReasons.push("DB 연결 실패");
  }

  const missingColumns = health.schema?.missingColumns.length ?? 0;
  if (missingColumns > 0) {
    criticalReasons.push(`필수 컬럼 누락 ${missingColumns}개`);
  }

  const missingVisitorKey = health.events?.missingVisitorKey ?? 0;
  if (missingVisitorKey > 0) {
    criticalReasons.push(`visitor_key 누락 이벤트 ${missingVisitorKey.toLocaleString()}건`);
  }

  const missingEventDateKst = health.events?.missingEventDateKst ?? 0;
  if (missingEventDateKst > 0) {
    criticalReasons.push(`KST 일자 누락 이벤트 ${missingEventDateKst.toLocaleString()}건`);
  }

  const missingIndexes = health.schema?.missingIndexes.length ?? 0;
  if (missingIndexes > 0) {
    warningReasons.push(`인덱스 누락 ${missingIndexes}개`);
  }

  const unknownEvents = health.events?.unknownEvents ?? 0;
  if (unknownEvents > 0) {
    warningReasons.push(`unknown 이벤트 ${unknownEvents.toLocaleString()}건`);
  }

  if ((health.events?.events24h ?? 0) === 0) {
    warningReasons.push("최근 24시간 이벤트 없음");
  }

  if (criticalReasons.length > 0 || !health.ok) {
    return {
      level: "critical",
      label: "조치 필요",
      reasons: [...criticalReasons, ...warningReasons],
    };
  }

  if (warningReasons.length > 0) {
    return {
      level: "warning",
      label: "주의",
      reasons: warningReasons,
    };
  }

  return { level: "ok", label: "정상", reasons: [] };
}

export function getAnalyticsEmptyState(kind: AnalyticsEmptyStateKind | string) {
  return EMPTY_STATES[kind as AnalyticsEmptyStateKind] ?? EMPTY_STATES.generic;
}

export function buildAnalyticsProfileFindings(profile: AnalyticsProfileInput): AnalyticsProfileFinding[] {
  const findings: AnalyticsProfileFinding[] = [];
  const rate = (value: number) => (profile.rows > 0 ? value / profile.rows : 0);

  if (profile.events24h === 0) {
    findings.push({
      severity: "high",
      message: "최근 24시간 이벤트가 없어 수집 중단 가능성이 있습니다.",
    });
  }

  if (profile.missingVisitorKey > 0 || profile.missingEventDateKst > 0) {
    findings.push({
      severity: "high",
      message: "visitor_key 또는 event_date_kst 누락으로 운영 통계 기준이 흔들릴 수 있습니다.",
    });
  }

  if (profile.rawIpRows > 0) {
    findings.push({
      severity: rate(profile.rawIpRows) >= 0.1 ? "high" : "medium",
      message: "raw IP가 남아 있어 backfill 또는 신규 수집 경로 점검이 필요합니다.",
    });
  }

  if (profile.unknownEvents > 0) {
    findings.push({
      severity: rate(profile.unknownEvents) >= 0.05 ? "high" : "medium",
      message: "허용되지 않은 event_type이 있어 track contract와 클라이언트 수집 코드를 맞춰야 합니다.",
    });
  }

  if (profile.duplicateEventIds > 0) {
    findings.push({
      severity: rate(profile.duplicateEventIds) >= 0.05 ? "high" : "medium",
      message: "event_id 중복이 있어 재전송 또는 중복 삽입 방지 정책을 확인해야 합니다.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "low",
      message: "핵심 품질 규칙에서 즉시 조치할 이상은 확인되지 않았습니다.",
    });
  }

  return findings;
}
