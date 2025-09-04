FROM oven/bun:1 AS base
WORKDIR /usr/src/app

COPY . .

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
