ARG NODE_VERSION=20.10.0
ARG PNPM_VERSION=9.6.0
FROM node:${NODE_VERSION}-slim as base

WORKDIR /app

ENV NODE_ENV="production"
ENV PORT=3000
RUN corepack enable

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential libcairo2-dev libpango1.0-dev

# We don't need the standalone Chromium
# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder

RUN npm install -g pnpm@$PNPM_VERSION
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM base AS runner

COPY --from=builder /app /app
RUN rm -rf /app/src
RUN rm -rf /app/workers

EXPOSE ${PORT}

CMD [ "npm", "start" ]