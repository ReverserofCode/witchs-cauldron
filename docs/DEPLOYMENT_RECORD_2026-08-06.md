# Production Deployment Record - 2026-08-06

## 개요 (Summary)

2026-08-06 운영 배포의 준비, 첫 시도 실패 진단, 복구 및 최종 스모크 테스트 결과를 보존한 기록입니다.

| 항목 | 결과 |
| --- | --- |
| 대상 커밋 | `61540545527a5edff73610cea45ecb03e578c846` |
| GitHub Actions 실행 | [CD run `31046763294`](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/31046763294) |
| 최종 결과 | attempt 2 성공, `build-and-test` 및 `deploy` job 성공 |

## 포함 범위 (Scope Included)

- 방송 모아보기 허브
- Next.js 16 및 React 19 현대화
- 안전한 클립 스트리밍
- Analytics 개선
- workflow 강화 및 문서 업데이트

## 배포 전 검증 (Pre-Deployment Verification)

- 테스트 파일 17개와 테스트 85개가 통과했습니다.
- TypeScript 검사가 통과했습니다.
- ESLint는 오류 0건과 동작을 막지 않는 경고 22건을 보고했습니다.
- Next.js production build와 Docker runtime smoke가 통과했습니다.
- `npm audit`는 취약점 0건을 보고했습니다.

## GitHub 배포 구성 (GitHub Deployment Configuration)

- `production` environment를 만들고 `main` 전용 custom deployment branch policy를 적용했습니다.
- `SSH_HOST_FINGERPRINT`는 실제 값을 문서화하지 않고 environment secret으로 저장했습니다.
- 현재 required reviewer는 설정되어 있지 않습니다.

## 배포 타임라인 (Deployment Timeline)

1. 로컬과 원격 `main`의 분기를 확인했습니다.
2. 커밋 `6154054`를 push하여 CD를 시작했습니다.
3. attempt 1에서는 build가 성공했지만 애플리케이션 교체 전에 SSH host key의 fingerprint mismatch가 발생했습니다.
4. 서버의 ED25519, ECDSA P-256, RSA host key를 비교했습니다.
5. `drone-ssh` 1.8.2가 ED25519보다 ECDSA P-256을 먼저 선택함을 확인했습니다.
6. environment secret을 수정하고 실패한 job을 다시 실행했습니다.
7. attempt 2에서 checkout, image snapshot, clean build, 교체, health check, Analytics 검증을 완료했습니다.

## 원인과 해결 (Root Cause and Resolution)

첫 번째로 저장한 fingerprint는 ED25519 key에는 유효했지만, Go SSH client가 선택한 ECDSA key와 일치하지 않았습니다. 일치하는 ECDSA P-256 SHA256 fingerprint를 저장하여 해결했으며, 비밀번호나 key material은 이 기록에 남기지 않았습니다.

## 최종 배포 결과 (Final Deployment Result)

- 서버는 `6154054`를 checkout했습니다.
- frontend와 backend health check가 통과했습니다.
- 인증된 Analytics stats 검증이 통과했습니다.
- 주 deploy step은 성공했고 retry step은 건너뛰었으며 rollback은 실행되지 않았습니다.

## 배포 후 스모크 결과 (Post-Deployment Smoke Results)

| 확인 대상 | 결과 |
| --- | --- |
| 홈페이지 | `200` |
| `/api/health` | `200`, `ok=true` |
| `/broadcasts` | `200`, 방송 30개, fallback 또는 partial-data 경고 없음 |
| 클립 catalog | `200`, 클립 10개, 조건부 ETag 요청 `304` |
| 클립 `HEAD` 및 Range | `200`, 정확한 byte range의 `206` |
| sitemap | `200`, 홈페이지와 broadcasts entry 포함 |
| 인증 없는 admin analytics | Basic challenge 및 `noindex` header와 함께 `401` |

## 운영 참고 및 후속 사항 (Operational Notes and Follow-Up)

- 현재 `main` push는 PR 또는 required reviewer gate 없이 자동 배포를 시작합니다.
- production required reviewer를 추가하면 scheduled recovery 및 maintenance workflow도 승인 대기 상태가 됩니다.
- `COLLECT_API_KEY`와 `CLIP_REFRESH_API_KEY`는 GitHub에 없으며, 서버의 기존 `.env` 값을 보존했습니다.
- `/api/health`는 frontend liveness만 증명합니다. CD health check와 Analytics 검증이 추가 의존성을 확인합니다.
- 이 기록에는 secret 값이 포함되어 있지 않습니다.

## 재현 명령 (Reproduction Commands)

아래 명령은 공개 run ID와 repository name만 사용하거나, 운영 환경에서 secret을 노출하지 않는 상태 코드 확인을 위한 예시입니다.

```bash
gh run view 31046763294 --repo ReverserofCode/witchs-cauldron
gh run view 31046763294 --repo ReverserofCode/witchs-cauldron --log-failed

curl -i https://<production-host>/api/health
curl -i https://<production-host>/broadcasts
curl -i https://<production-host>/api/clips
curl -I https://<production-host>/media/clips/<clip-file>
curl -i -H "Range: bytes=0-1023" https://<production-host>/media/clips/<clip-file>
curl -i https://<production-host>/sitemap.xml
curl -i https://<production-host>/admin/analytics
```
