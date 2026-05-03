import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const apiZodIndex = path.join(root, "lib", "api-zod", "src", "index.ts");
const apiZodTypes = path.join(root, "lib", "api-zod", "src", "types.ts");
const generatedTypes = path.join(root, "lib", "api-zod", "src", "generated", "types");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assertFileContains(file: string, expected: string) {
  const content = readFileSync(file, "utf8");
  if (!content.includes(expected)) {
    fail(`${path.relative(root, file)} must contain: ${expected}`);
  }
}

function assertNoGeneratedTypeBarrelCollision() {
  assertFileContains(apiZodIndex, 'export * from "./generated/api";');
  const indexContent = readFileSync(apiZodIndex, "utf8");
  if (indexContent.includes('export * from "./generated/types";')) {
    fail("lib/api-zod/src/index.ts must not re-export generated/types; it collides with Zod schema names.");
  }
  assertFileContains(apiZodTypes, 'export * from "./generated/types";');
}

function assertGeneratedFilesExist() {
  const required = [
    path.join(root, "lib", "api-client-react", "src", "generated", "api.ts"),
    path.join(root, "lib", "api-zod", "src", "generated", "api.ts"),
    path.join(generatedTypes, "index.ts"),
  ];

  for (const file of required) {
    try {
      readFileSync(file, "utf8");
    } catch {
      fail(`Missing generated API file: ${path.relative(root, file)}`);
    }
  }

  const generatedTypeFiles = readdirSync(generatedTypes).filter((file) => file.endsWith(".ts"));
  if (generatedTypeFiles.length <= 1) {
    fail("Generated API types appear incomplete.");
  }
}

assertGeneratedFilesExist();
assertNoGeneratedTypeBarrelCollision();
