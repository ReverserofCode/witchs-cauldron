# AgentHQ Review Notes (2026-03-08)

디자인 컨셉/브랜드 톤/주요 팔레트는 유지하고, UX/접근성/신뢰성 중심으로 고도화하기 위한 검토안입니다.

## 핵심 개선 포인트

### P1
1. Schedule 데이터 일관성 정리 (사이드바 vs 메인 일정)
2. 클립 키보드/휠 제어 범위를 포커스된 뷰어로 제한
3. YouTube API 키 미설정 시 라우트 fallback 강화

### P2
4. 중복 YouTube 데이터 요청 통합
5. 로딩/오류 상태에 재시도·대체 링크 CTA 추가
6. 운영용 진단 버튼/문구를 퍼블릭 UI에서 분리

### P3
7. 팬아트 자동회전 상호작용 중 일시정지 + 토글 유지
8. 일정표 설명 문구 명확화

## 사용자 영향 요약
- 일정/콘텐츠 표시 불일치로 인한 신뢰 저하 방지
- 페이지 키보드 조작 충돌 감소
- API 장애 시에도 화면 기능 최소 유지
- 실패 상태에서 사용자 다음 행동 경로 확보

## 실행 체크리스트
- [ ] Extract shared schedule normalization util and use everywhere.
- [x] Scope clips keyboard/wheel interactions to focused component.
- [ ] Add robust route-level fallback for missing YouTube key.
- [ ] Deduplicate YouTube data fetching strategy.
- [ ] Add retry/fallback CTA on shorts/clips errors.
- [ ] Hide diagnostics controls from public runtime.
- [x] Pause fan-art autoplay on interaction + optional toggle.
- [x] Fix schedule descriptive copy.

## 비고
- 위 항목 중 [x]는 2026-03-08 작업에서 반영 완료.
- 나머지는 안정성 개선 라운드로 묶어 순차 적용 권장.
