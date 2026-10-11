FROM denoland/deno:latest

WORKDIR /app

# Copy manifests first so the dependency install layer caches across
# source-only edits
COPY deno.json deno.lock package.json* ./
RUN deno install


COPY . .
RUN deno run -A npm:prisma@7.10.0 generate
RUN deno cache main.ts


CMD ["run", "-A", "main.ts"]