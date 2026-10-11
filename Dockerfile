# Multi-stage Dockerfile to build and run Typing Clash in a single container
# Stage 1: Build the Vite frontend
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Build the Rust Axum backend
FROM rust:1-slim-bookworm AS server-builder
WORKDIR /app

# Create a skeleton to cache dependencies
RUN cargo new --bin server
WORKDIR /app/server
COPY server/Cargo.toml server/Cargo.lock ./
RUN cargo build --release --locked
RUN rm src/*.rs

# Copy actual server source code
COPY server/src ./src
# Touch main.rs to force cargo to rebuild the binary
RUN touch src/main.rs && cargo build --release --locked

# Stage 3: Minimal production runtime
FROM debian:bookworm-slim AS runner
WORKDIR /app

# Install certificates and runtime essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled backend binary
COPY --from=server-builder /app/server/target/release/typing_clash_server /app/typing_clash_server

# Copy compiled frontend dist assets
COPY --from=client-builder /app/client/dist /app/client/dist

# Render provides PORT dynamically (defaults to 10000 on Render, fallback 4000)
ENV PORT=10000
EXPOSE 10000

CMD ["/app/typing_clash_server"]
