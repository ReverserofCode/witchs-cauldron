# ================================
# Stage 1: Dependencies
# ================================
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./
RUN npm ci --only=production

# ================================
# Stage 2: Builder
# ================================
FROM node:18-alpine AS builder
WORKDIR /app

# Dependencies stage에서 node_modules 복사
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js 텔레메트리 비활성화
ENV NEXT_TELEMETRY_DISABLED=1

# 애플리케이션 빌드
RUN npm run build

# ================================
# Stage 3: Runner (Production)
# ================================
FROM node:18-alpine AS runner
WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 시스템 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# public 폴더 복사
COPY --from=builder /app/public ./public

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