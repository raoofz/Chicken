import app from "./app";
import { logger } from "./lib/logger";
import { execSync } from "node:child_process";
import { createServer } from "node:net";

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

function killPort(p: number) {
  try {
    execSync(`fuser -k ${p}/tcp 2>/dev/null || true`, { stdio: "ignore" });
  } catch {}
}

function waitForPort(p: number, maxAttempts = 40): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    function check() {
      attempt++;
      const tester = createServer();
      tester.once("error", () => {
        killPort(p);
        if (attempt >= maxAttempts) {
          resolve();
          return;
        }
        setTimeout(check, 500);
      });
      tester.once("listening", () => {
        tester.close(() => resolve());
      });
      tester.listen(p);
    }
    check();
  });
}

waitForPort(port)
  .then(() => {
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Could not free port");
    process.exit(1);
  });
