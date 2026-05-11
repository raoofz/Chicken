/**
 * Load workspace-root `.env` before `@workspace/db` initializes (single bundle safe).
 * Starting `node dist/index.mjs` without a shell that sourced `.env` would otherwise
 * leave DATABASE_URL unset and every request would fail to connect to PostgreSQL.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadFile(file: string): void {
  const content = readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  path.resolve(here, "../../../.env"),
  path.resolve(here, "../../.env"),
  path.resolve(here, "../.env"),
];

for (const file of candidates) {
  if (existsSync(file)) {
    loadFile(file);
    break;
  }
}
