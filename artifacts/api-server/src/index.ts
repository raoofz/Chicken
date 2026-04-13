import app from "./app";
import { logger } from "./lib/logger";
import { execSync } from "node:child_process";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
} catch {}

function startWithRetry(attempt = 1) {
  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && attempt <= 3) {
      logger.warn({ port, attempt }, "Port in use, retrying...");
      try {
        execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
      } catch {}
      setTimeout(() => startWithRetry(attempt + 1), 1000 * attempt);
    } else {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
  });
}

startWithRetry();
