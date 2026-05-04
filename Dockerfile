FROM node:22-alpine

WORKDIR /app

# تفعيل pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# نسخ ملفات الاعتماد
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps ./apps
COPY lib ./lib

# تثبيت الحزم
RUN pnpm install --frozen-lockfile --prod

EXPOSE 8080

# تشغيل التطبيق
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
