ARG NODE_VERSION=22.12.0
ARG PNPM_VERSION=9.15.4
FROM node:${NODE_VERSION}-slim AS base

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

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install pnpm
RUN npm install -g pnpm@${PNPM_VERSION} && \
    pnpm --version

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm run build

FROM base AS runner

# Copy built application
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json

# Copy template and font files needed at runtime
# Create directory structure and copy files
COPY --from=builder /app/src/stages/book-covers /app/src/stages/book-covers

# Set default PORT if not provided
ENV PORT=8080
ENV NODE_ENV="production"

EXPOSE 8080

CMD [ "npm", "start" ]