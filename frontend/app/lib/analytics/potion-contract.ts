export type PotionGameMode = "daily" | "practice" | "slow-practice";
export type PotionRuleVersion = "potion-v1";

export type PotionPilotEvent = {
  schema_version: 1;
  visitor_id: string;
  event_id: string;
} & (
  | {
      type: "game_start" | "game_complete";
      run_id: string;
      mode: PotionGameMode;
      rule_version: PotionRuleVersion;
    }
  | { type: "site_active" }
);

export type AcceptedEvent = {
  ok: true;
  serverNowMs: number;
  expiresAtMs: number;
  dayKst: string;
};

type ValidationResult =
  | { ok: true; value: PotionPilotEvent }
  | { ok: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COMMON_KEYS = ["event_id", "schema_version", "type", "visitor_id"] as const;
const GAME_KEYS = [...COMMON_KEYS, "mode", "rule_version", "run_id"].sort();
const SITE_KEYS = [...COMMON_KEYS].sort();
const GAME_MODES = new Set<PotionGameMode>(["daily", "practice", "slow-practice"]);

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasExactKeys(input: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(input).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isUuid(input: unknown): input is string {
  return typeof input === "string" && UUID_PATTERN.test(input);
}

export function validatePotionPayload(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, error: "invalid_payload" };
  if (input.schema_version !== 1 || !isUuid(input.visitor_id) || !isUuid(input.event_id)) {
    return { ok: false, error: "invalid_payload" };
  }

  if (input.type === "site_active") {
    if (!hasExactKeys(input, SITE_KEYS)) return { ok: false, error: "invalid_payload" };
    return { ok: true, value: input as PotionPilotEvent };
  }

  if (input.type !== "game_start" && input.type !== "game_complete") {
    return { ok: false, error: "invalid_payload" };
  }
  if (!hasExactKeys(input, GAME_KEYS)) return { ok: false, error: "invalid_payload" };
  if (!isUuid(input.run_id) || !GAME_MODES.has(input.mode as PotionGameMode) || input.rule_version !== "potion-v1") {
    return { ok: false, error: "invalid_payload" };
  }
  return { ok: true, value: input as PotionPilotEvent };
}
