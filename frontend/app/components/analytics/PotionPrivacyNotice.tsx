'use client';

import { useState } from 'react';
import { POTION_PILOT_WINDOW } from '@/app/lib/analytics/potion-config';
import { excludePilot, excludePilotInCurrentTab } from '@/app/lib/analytics/potion-client';

export function PotionPrivacyNotice() {
  const [message, setMessage] = useState('');
  function exclude() {
    let saved = false;
    try { saved = excludePilot(window.localStorage); }
    catch { excludePilotInCurrentTab(); }
    setMessage(saved ? '이 브라우저의 게임 재방문 집계에서 제외했습니다.' : '저장소를 사용할 수 없어 현재 탭에서만 제외했습니다.');
  }
  return (
    <aside className="rounded-2xl border border-purple-200/50 bg-white/60 p-4 text-sm leading-relaxed text-ink/75" aria-label="게임 기록과 방문 집계 안내">
      <h2 className="font-semibold text-ink">기록과 방문 집계 안내</h2>
      <p className="mt-2">게임 기록은 이 기기에 저장되며 서버 순위표에 올라가지 않습니다. 기록 지우기와 방문 집계 제외는 서로 다른 기능입니다.</p>
      <p className="mt-2">{POTION_PILOT_WINDOW
        ? '게임 이용 후 재방문 여부를 알아보기 위한 한시적 집계를 진행합니다. 첫 게임 시작 때 임의 식별자를 만들고 시작·완료·활동일만 집계하며 점수, IP, 닉네임은 이 집계에 저장하지 않습니다.'
        : '현재 게임 전용 재방문 집계는 비활성 상태이며, 게임용 방문 식별자를 만들거나 전송하지 않습니다.'}</p>
      <p className="mt-2">집계가 활성화되면 식별자는 최초 참여 후 45일에 만료되며 방문으로 연장되지 않습니다. 운영 DB는 만료 자료를 다음 정리 작업에서 삭제합니다(정상 일일 실행 시 24시간 이내). 제외 버튼은 이후 전송을 중단하며 이미 저장된 자료를 즉시 삭제하지는 않습니다. 브라우저 변경·저장 차단으로 집계가 누락될 수 있습니다. 기존 사이트 분석은 별도로 동작합니다.</p>
      <button type="button" onClick={exclude} className="mt-3 min-h-11 rounded-lg border border-purple-300 px-4 py-2 font-medium text-purple-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600">게임 방문 집계 제외</button>
      <p role="status" className="mt-2">{message}</p>
    </aside>
  );
}
