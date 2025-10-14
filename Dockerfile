# ================================
# Stage 1: Dependencies (Production)
# ================================
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ================================
# Stage 2: Builder
# ================================
FROM node:22-alpine AS builder
WORKDIR /app

# 빌드에 필요한 모든 dependencies 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사
COPY . .

# Next.js 텔레메트리 비활성화
ENV NEXT_TELEMETRY_DISABLED=1
ENV YOUTUBE_API_KEY=dummy_key_for_build

# 애플리케이션 빌드
RUN npm run build

# ================================
# Stage 3: Runner (Production)
# ================================
FROM node:22-alpine AS runner
WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 시스템 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# production dependencies 복사
COPY --from=deps /app/node_modules ./node_modules

# public 폴더 복사
COPY --from=builder /app/public ./public

# package.json 복사 (standalone 서버에 필요)
COPY --from=builder /app/package*.json ./

# 빌드된 애플리케이션 복사 (권한 설정 포함)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# nextjs 사용자로 전환
USER nextjs

# 포트 노출
EXPOSE 3000

# 환경 변수 설정
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# 애플리케이션 실행
CMD ["node", "server.js"]