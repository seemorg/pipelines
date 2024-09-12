FROM node:20-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates chromium build-essential libcairo2-dev libpango1.0-dev

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

RUN corepack enable

COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build --filter create-pipeline

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules

COPY --from=build /app/apps /app/apps
COPY --from=build /app/packages /app/packages
COPY --from=build /app/tooling /app/tooling

EXPOSE 8080

CMD [ "pnpm", "start:create-pipeline" ]