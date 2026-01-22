FROM node:22.12.0-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g corepack@latest
RUN corepack enable

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential libcairo2-dev libpango1.0-dev

# We don't need the standalone Chromium
# Install Google Chrome Stable (amd64) or Chromium (arm64) and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates \
  && ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then \
      mkdir -p /etc/apt/keyrings \
      && curl -fsSL --retry 3 --retry-delay 2 https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
      && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
      && apt-get update \
      && apt-get install -y --no-install-recommends google-chrome-stable; \
    else \
      apt-get install -y --no-install-recommends chromium chromium-sandbox; \
    fi \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM base AS runner
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/src /app/src
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json

EXPOSE ${PORT}

CMD [ "pnpm", "start" ]