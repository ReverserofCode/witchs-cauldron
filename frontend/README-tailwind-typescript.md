# Frontend Dev Notes (TypeScript + Tailwind)

이 프로젝트는 Docker 컨테이너에서 dev 서버를 실행합니다. VS Code가 타입을 인식하도록 `node_modules`를 호스트와 공유하도록 docker-compose가 구성되어 있습니다.

## 최초 설정

1. 호스트에 `frontend/node_modules/` 디렉터리가 없다면 생성합니다(빈 폴더여도 됨).
2. 컨테이너를 재시작하면 컨테이너 내부의 설치가 호스트에도 반영됩니다.

## 유용한 명령

컨테이너에서 패키지 설치:

```
docker exec -it witchs-cauldron-frontend npm install <pkg>
```

타입 체크:

```
docker exec -it witchs-cauldron-frontend npx tsc --noEmit
```
