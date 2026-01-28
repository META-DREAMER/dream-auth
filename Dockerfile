# Build stage - use Node.js with pnpm for dependency installation and building
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Skip env validation during build
ENV SKIP_ENV_VALIDATION=true

# Increase Node.js heap size for large builds (default ~2GB is insufficient)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the application
RUN pnpm run build

# Production stage - use Node.js for stable ESM module resolution
# This is the recommended approach by TanStack Start docs for Docker deployment
FROM node:22-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

# Copy built application (node-server preset output is self-contained)
COPY --from=builder /app/.output ./.output

# Install reflect-metadata (required for tsyringe, a transitive dependency)
RUN npm install --no-save reflect-metadata

# Fix ownership for non-root user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application using Node.js as recommended by TanStack Start
CMD ["node", "--import=reflect-metadata", ".output/server/index.mjs"]
