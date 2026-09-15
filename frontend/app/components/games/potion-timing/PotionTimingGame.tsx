"use client";

import { useState } from "react";
import { PotionPrivacyNotice } from "@/app/components/analytics/PotionPrivacyNotice";
import {
  usePotionTimingGame,
  type PotionRecordSummary,
} from "@/app/hooks/usePotionTimingGame";
import type {
  GameMode,
  GameState,
} from "@/app/lib/games/potion-timing/types";
import styles from "./PotionTimingGame.module.css";

const MODE_LABELS: Record<GameMode, string> = {
  daily: "오늘의 도전",
  practice: "일반 연습",
  "slow-practice": "느린 연습",
};

function expectedFrom(state: GameState) {
  return { runId: state.runId, roundIndex: state.roundIndex };
}

function ModeButtons({
  loading,
  onDaily,
  onPractice,
}: Readonly<{
  loading: boolean;
  onDaily: () => void;
  onPractice: (mode: "practice" | "slow-practice") => void;
}>) {
  return (
    <div className={styles.modeGrid} aria-label="게임 모드 선택">
      <button
        type="button"
        aria-label="오늘의 도전"
        className={`${styles.modeButton} ${styles.dailyButton}`}
        onClick={onDaily}
        disabled={loading}
      >
        <span>오늘의 도전</span>
        <small>{loading ? "서버 날짜 확인 중…" : "매일 오전 9시 새 포션"}</small>
      </button>
      <button
        type="button"
        aria-label="일반 연습"
        className={styles.modeButton}
        onClick={() => onPractice("practice")}
      >
        <span>일반 연습</span>
        <small>새로운 5개 배치로 연습</small>
      </button>
      <button
        type="button"
        aria-label="느린 연습"
        className={styles.modeButton}
        onClick={() => onPractice("slow-practice")}
      >
        <span>느린 연습</span>
        <small>게이지 속도 1.8배 여유롭게</small>
      </button>
    </div>
  );
}

function ResultPanel({
  state,
  saveStatus,
  onReplay,
  onDaily,
  onPractice,
  dailyLoading,
}: Readonly<{
  state: GameState;
  saveStatus: "idle" | "saved" | "unavailable";
  onReplay: () => void;
  onDaily: () => void;
  onPractice: (mode: "practice" | "slow-practice") => void;
  dailyLoading: boolean;
}>) {
  const total = state.scores.reduce((sum, score) => sum + score, 0);
  return (
    <div className={styles.resultPanel} role="status" aria-live="polite">
      <p className={styles.eyebrow}>5라운드 조제 완료</p>
      <h2>이번 포션 결과</h2>
      <p className={styles.totalScore} data-testid="total-score">
        <strong>{total}</strong>
        <span>/ 500점</span>
      </p>
      <ol className={styles.scoreList} aria-label="라운드별 점수">
        {state.scores.map((score, index) => (
          <li key={`${state.runId}-${index}`} data-testid="round-score">
            <span>{index + 1}라운드</span>
            <strong>{score}점</strong>
          </li>
        ))}
      </ol>
      {saveStatus === "saved" && (
        <p className={styles.saveMessage}>이 브라우저에 결과를 저장했어요.</p>
      )}
      {saveStatus === "unavailable" && (
        <p className={styles.errorMessage}>
          결과는 확인할 수 있지만 이 브라우저에 기록을 저장하지 못했어요.
        </p>
      )}
      <div className={styles.resultActions}>
        <button type="button" className={styles.primaryButton} onClick={onReplay}>
          같은 모드로 다시 하기
        </button>
      </div>
      <div className={styles.otherModes}>
        <p>다른 모드로 새 포션을 만들 수도 있어요.</p>
        <ModeButtons
          loading={dailyLoading}
          onDaily={onDaily}
          onPractice={onPractice}
        />
      </div>
    </div>
  );
}

function RecordsPanel({
  summaries,
  storageAvailable,
  onClear,
}: Readonly<{
  summaries: readonly PotionRecordSummary[];
  storageAvailable: boolean;
  onClear: () => boolean;
}>) {
  const [confirming, setConfirming] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);

  const confirmClear = () => {
    const cleared = onClear();
    setClearFailed(!cleared);
    if (cleared) setConfirming(false);
  };

  return (
    <section className={styles.records} aria-labelledby="potion-records-title">
      <div className={styles.sectionHeadingRow}>
        <div>
          <p className={styles.eyebrow}>최근 30일 · 기기 저장</p>
          <h2 id="potion-records-title">내 포션 기록</h2>
        </div>
        {!confirming && summaries.length > 0 && (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              setClearFailed(false);
              setConfirming(true);
            }}
          >
            게임 기록 지우기
          </button>
        )}
      </div>

      {!storageAvailable ? (
        <p className={styles.errorMessage}>
          이 브라우저의 로컬 기록을 읽을 수 없어요. 게임은 계속할 수 있어요.
        </p>
      ) : summaries.length === 0 ? (
        <p className={styles.emptyRecord}>아직 완료한 포션이 없어요.</p>
      ) : (
        <ul className={styles.recordList}>
          {summaries.map((summary) => (
            <li key={`${summary.mode}-${summary.challengeId}`}>
              <span>{MODE_LABELS[summary.mode]}</span>
              <small>
                {summary.mode === "daily"
                  ? summary.first.challengeDate
                  : `${summary.first.challengeDate} 기기 기준`}
              </small>
              <dl>
                <div>
                  <dt>첫 완료</dt>
                  <dd data-testid="record-first-score">{summary.first.total}점</dd>
                </div>
                <div>
                  <dt>최고</dt>
                  <dd data-testid="record-best-score">{summary.best.total}점</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <div className={styles.confirmBox} role="group" aria-label="게임 기록 삭제 확인">
          <p>포션 게임 기록만 모두 지울까요? 다른 사이트 설정은 유지됩니다.</p>
          <div>
            <button type="button" className={styles.dangerButton} onClick={confirmClear}>
              기록 삭제 확인
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfirming(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}
      {clearFailed && (
        <p className={styles.errorMessage}>기록을 지우지 못했어요.</p>
      )}
    </section>
  );
}

export function PotionTimingGame(): React.JSX.Element {
  const {
    state,
    dispatch,
    gaugeRef,
    dailyStatus,
    dailyError,
    recordSummaries,
    storageAvailable,
    saveStatus,
    startPractice,
    startDaily,
    replay,
    clearSavedRecords,
  } = usePotionTimingGame();
  const rule = state?.challenge.rounds[state.roundIndex];
  const lastScore = state?.scores[state.scores.length - 1];

  return (
    <div className={styles.gameShell} data-testid="potion-game">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>팬 창작 미니게임 · 무음</p>
          <h1>포션 불조절</h1>
          <p>
            움직이는 온도를 목표 구간에 맞춰 멈춰 주세요. 다섯 번의 불조절로
            나만의 포션을 완성합니다.
          </p>
        </div>
        <div className={styles.heroSeal} aria-hidden="true">
          <span>5</span>
          <small>ROUNDS</small>
        </div>
      </header>

      {!state ? (
        <section className={styles.modeSection} aria-labelledby="potion-mode-title">
          <p className={styles.eyebrow}>조제법 선택</p>
          <h2 id="potion-mode-title">어떤 포션을 만들까요?</h2>
          <p className={styles.modeIntro}>
            오늘의 도전은 서버 날짜 기준 오전 9시에 바뀝니다. 연습은 네트워크
            확인 없이 바로 시작할 수 있어요.
          </p>
          <ModeButtons
            loading={dailyStatus === "loading"}
            onDaily={() => void startDaily()}
            onPractice={startPractice}
          />
          {dailyError && (
            <p className={styles.errorMessage} role="alert">
              {dailyError}
            </p>
          )}
        </section>
      ) : state.phase === "finished" ? (
        <ResultPanel
          state={state}
          saveStatus={saveStatus}
          onReplay={replay}
          onDaily={() => void startDaily()}
          onPractice={startPractice}
          dailyLoading={dailyStatus === "loading"}
        />
      ) : (
        <section
          className={styles.playPanel}
          aria-labelledby="potion-round-title"
          data-testid="game-state"
          data-phase={state.phase}
          data-mode={state.mode}
          data-run-id={state.runId}
          data-round-index={state.roundIndex}
          data-score-count={state.scores.length}
          data-challenge-id={state.challenge.challengeId}
        >
          <div className={styles.playMeta}>
            <span className={styles.modePill}>{MODE_LABELS[state.mode]}</span>
            <span>{state.roundIndex + 1} / 5 라운드</span>
          </div>
          <h2 id="potion-round-title">
            목표 온도 <strong>{rule?.center ?? 0}</strong>
          </h2>
          <p className={styles.targetHelp}>
            중앙 100점 · 경계 및 구간 밖 0점
          </p>

          {rule && (
            <div
              className={styles.gaugeFrame}
              data-testid="gauge-frame"
              data-center={rule.center}
              data-half-width={rule.halfWidth}
              data-period-ms={rule.periodMs}
            >
              <div className={styles.gaugeLabels} aria-hidden="true">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
              <div className={styles.gaugeTrack}>
                <div className={styles.gaugeRail}>
                  <div
                    className={styles.targetZone}
                    style={{
                      left: `${rule.center - rule.halfWidth}%`,
                      width: `${rule.halfWidth * 2}%`,
                    }}
                  >
                    <span aria-hidden="true">목표</span>
                  </div>
                  <div
                    ref={gaugeRef}
                    className={styles.gaugeTravel}
                    role="meter"
                    aria-label="현재 온도"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={0}
                    data-testid="gauge-indicator"
                    data-position="0"
                  >
                    <span className={styles.gaugeMarker} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className={`${styles.cauldronScene} ${
              state.phase === "running" ? styles.isHeating : ""
            }`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 320 230" focusable="false">
              <path className={styles.steam} d="M112 70c-16-22 18-27 2-49" />
              <path className={styles.steamSecond} d="M171 65c20-22-12-31 4-50" />
              <path className={styles.steamThird} d="M218 72c-10-17 15-28 3-43" />
              <ellipse className={styles.rimBack} cx="160" cy="92" rx="91" ry="24" />
              <path className={styles.potion} d="M78 92c11 19 153 19 164 0v20c-8 20-155 20-164 0Z" />
              <path className={styles.pot} d="M72 102c0 70 34 102 88 102s88-32 88-102c-42 27-134 27-176 0Z" />
              <ellipse className={styles.rim} cx="160" cy="96" rx="93" ry="25" />
              <ellipse className={styles.potionTop} cx="160" cy="96" rx="78" ry="15" />
              <path className={styles.handle} d="M75 119H51c-19 0-22 28-3 32h25M245 119h24c19 0 22 28 3 32h-25" />
              <path className={styles.leg} d="M112 188l-18 27M208 188l18 27" />
              <g className={styles.flames}>
                <path d="M121 210c-8-18 12-22 8-39 19 17 21 28 10 42Z" />
                <path d="M151 216c-13-25 18-33 9-59 28 25 29 42 12 61Z" />
                <path d="M190 212c-11-21 13-27 8-47 23 21 24 33 10 50Z" />
              </g>
              <circle className={styles.bubble} cx="126" cy="94" r="5" />
              <circle className={styles.bubbleSecond} cx="180" cy="96" r="4" />
              <circle className={styles.bubbleThird} cx="205" cy="91" r="3" />
            </svg>
          </div>

          <div className={styles.controlArea}>
            {state.phase === "ready" && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => dispatch("START", expectedFrom(state))}
                onKeyDown={(event) => {
                  if (event.repeat) event.preventDefault();
                }}
              >
                가열 시작
              </button>
            )}
            {state.phase === "running" && (
              <button
                type="button"
                className={`${styles.primaryButton} ${styles.stopButton}`}
                onClick={() => dispatch("STOP", expectedFrom(state))}
                onKeyDown={(event) => {
                  if (event.repeat) event.preventDefault();
                }}
              >
                불 끄기
              </button>
            )}
            {state.phase === "round-result" && (
              <div className={styles.roundResult} role="status" aria-live="polite">
                <p>
                  {state.roundIndex + 1}라운드 <strong>{lastScore}점</strong>
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => dispatch("ADVANCE", expectedFrom(state))}
                >
                  다음 라운드
                </button>
              </div>
            )}
            {state.phase === "paused" && (
              <div className={styles.roundResult} role="status" aria-live="polite">
                <p>
                  화면을 벗어나 현재 라운드를 멈췄어요. 이전 점수는 그대로예요.
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => dispatch("RESUME", expectedFrom(state))}
                >
                  다시 준비
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <RecordsPanel
        summaries={recordSummaries}
        storageAvailable={storageAvailable}
        onClear={clearSavedRecords}
      />

      <aside className={styles.instructions} aria-labelledby="potion-help-title">
        <div>
          <p className={styles.eyebrow}>조작 안내</p>
          <h2 id="potion-help-title">한 버튼으로 천천히</h2>
          <ul>
            <li>버튼을 누르거나, 포커스한 뒤 Enter 또는 Space를 누르세요.</li>
            <li>무입력 제한 시간은 없으며 자동으로 다음 라운드가 시작되지 않아요.</li>
            <li>화면을 벗어나면 현재 미채점 라운드만 다시 준비합니다.</li>
          </ul>
        </div>
        <p className={styles.accessibilityNote}>
          움직임 줄이기 설정에서는 장식 효과를 제거합니다. 반응 조작이 어렵다면
          느린 연습을 이용해 주세요.
        </p>
      </aside>
      <div className={styles.privacyNotice} data-potion-analytics-note-slot>
        <PotionPrivacyNotice />
      </div>
    </div>
  );
}
