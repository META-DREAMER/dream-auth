# Build stage - use Bun for fast dependency installation and building
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Skip env validation during build
ENV SKIP_ENV_VALIDATION=true

# Build the application
RUN bun run build

# Production stage - use Node.js for stable ESM module resolution
# This is the recommended approach by TanStack Start docs for Docker deployment
FROM node:22-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

# Copy built application (node-server preset output is self-contained)
COPY --from=builder /app/.output ./.output

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
CMD ["node", ".output/server/index.mjs"]
