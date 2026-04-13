import app from "./app";
import { logger } from "./lib/logger";
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

function killPort(targetPort: number): Promise<void> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once("error", () => {
        import("node:child_process").then(({ execSync }) => {
          try {
            execSync(`fuser -k ${targetPort}/tcp 2>/dev/null || true`);
          } catch {}
          setTimeout(resolve, 500);
        });
      })
      .once("listening", () => {
        tester.close(() => resolve());
      })
      .listen(targetPort);
  });
}

killPort(port).then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
