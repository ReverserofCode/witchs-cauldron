#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-https://moingfans.com}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-0.5}"
REQUEST_TIMEOUT_SECONDS="${REQUEST_TIMEOUT_SECONDS:-2}"
MAX_SECONDS="${MAX_SECONDS:-300}"
OUT_DIR="${OUT_DIR:-./tmp/downtime-measurements}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/downtime-${STAMP}.log"

mkdir -p "$OUT_DIR"

START_EPOCH="$(date +%s.%N)"
TOTAL_REQUESTS=0
TOTAL_FAILURES=0
FAIL_STREAK=0
MAX_FAIL_STREAK=0
CURRENT_GAP_START_EPOCH=""
CURRENT_GAP_START_ISO=""
LONGEST_GAP_SECONDS="0.000"
LONGEST_GAP_START=""
LONGEST_GAP_END=""

float_ge() {
  awk -v a="$1" -v b="$2" 'BEGIN { exit !(a >= b) }'
}

float_gt() {
  awk -v a="$1" -v b="$2" 'BEGIN { exit !(a > b) }'
}

float_diff() {
  awk -v a="$1" -v b="$2" 'BEGIN { printf "%.3f", (a - b) }'
}

finalize_gap_if_needed() {
  local end_epoch="$1"
  local end_iso="$2"

  if [[ -z "$CURRENT_GAP_START_EPOCH" ]]; then
    return 0
  fi

  local gap_seconds
  gap_seconds="$(float_diff "$end_epoch" "$CURRENT_GAP_START_EPOCH")"

  if float_gt "$gap_seconds" "$LONGEST_GAP_SECONDS"; then
    LONGEST_GAP_SECONDS="$gap_seconds"
    LONGEST_GAP_START="$CURRENT_GAP_START_ISO"
    LONGEST_GAP_END="$end_iso"
  fi

  CURRENT_GAP_START_EPOCH=""
  CURRENT_GAP_START_ISO=""
}

cleanup() {
  local end_epoch duration
  end_epoch="$(date +%s.%N)"
  duration="$(float_diff "$end_epoch" "$START_EPOCH")"

  {
    echo
    echo "finished_at=$(date -Is)"
    echo "total_requests=${TOTAL_REQUESTS}"
    echo "total_failures=${TOTAL_FAILURES}"
    echo "max_fail_streak=${MAX_FAIL_STREAK}"
    echo "longest_gap_seconds=${LONGEST_GAP_SECONDS}"
    echo "longest_gap_start=${LONGEST_GAP_START}"
    echo "longest_gap_end=${LONGEST_GAP_END}"
    echo "duration_seconds=${duration}"
  } | tee -a "$OUT_FILE"

  echo
  echo "Summary"
  echo "- total requests: ${TOTAL_REQUESTS}"
  echo "- total failures: ${TOTAL_FAILURES}"
  echo "- max fail streak: ${MAX_FAIL_STREAK}"
  echo "- longest observed gap (s): ${LONGEST_GAP_SECONDS}"
  echo "- log: ${OUT_FILE}"
}
trap cleanup EXIT

{
  echo "# downtime measurement"
  echo "target=${TARGET_URL}"
  echo "interval_seconds=${INTERVAL_SECONDS}"
  echo "request_timeout_seconds=${REQUEST_TIMEOUT_SECONDS}"
  echo "max_seconds=${MAX_SECONDS}"
  echo "started_at=$(date -Is)"
  echo
} | tee "$OUT_FILE"

echo "Measuring availability for: $TARGET_URL"
echo "Output: $OUT_FILE"
echo "Press Ctrl+C to stop early."
echo

while true; do
  NOW_ISO="$(date -Is)"
  NOW_EPOCH="$(date +%s.%N)"
  TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))

  set +e
  HTTP_CODE="$(curl -k -sS -o /dev/null -w '%{http_code}' --max-time "$REQUEST_TIMEOUT_SECONDS" "$TARGET_URL")"
  CURL_EXIT=$?
  set -e

  if [[ "$CURL_EXIT" -eq 0 && "$HTTP_CODE" =~ ^[23] ]]; then
    echo "${NOW_ISO} ok http=${HTTP_CODE}" | tee -a "$OUT_FILE" >/dev/null
    finalize_gap_if_needed "$NOW_EPOCH" "$NOW_ISO"
    FAIL_STREAK=0
  else
    echo "${NOW_ISO} fail http=${HTTP_CODE:-000} curl_exit=${CURL_EXIT}" | tee -a "$OUT_FILE" >/dev/null
    TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
    FAIL_STREAK=$((FAIL_STREAK + 1))
    if [[ "$FAIL_STREAK" -gt "$MAX_FAIL_STREAK" ]]; then
      MAX_FAIL_STREAK="$FAIL_STREAK"
    fi
    if [[ -z "$CURRENT_GAP_START_EPOCH" ]]; then
      CURRENT_GAP_START_EPOCH="$NOW_EPOCH"
      CURRENT_GAP_START_ISO="$NOW_ISO"
    fi
  fi

  ELAPSED="$(float_diff "$NOW_EPOCH" "$START_EPOCH")"
  if float_ge "$ELAPSED" "$MAX_SECONDS"; then
    break
  fi

  sleep "$INTERVAL_SECONDS"
done
