/**
 * Tests for AGENTS.md
 *
 * Validates the structural integrity and required content of the
 * Cursor Cloud development instructions document.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_MD_PATH = resolve(__dirname, '..', 'AGENTS.md');

let content;

// Load file once; fail fast if missing
assert.ok(existsSync(AGENTS_MD_PATH), `AGENTS.md must exist at ${AGENTS_MD_PATH}`);
content = readFileSync(AGENTS_MD_PATH, 'utf8');

// ---------------------------------------------------------------------------
// File-level basics
// ---------------------------------------------------------------------------

describe('AGENTS.md – file basics', () => {
  it('should not be empty', () => {
    assert.ok(content.trim().length > 0, 'AGENTS.md must not be empty');
  });

  it('should start with a level-1 heading', () => {
    const firstLine = content.split('\n')[0].trim();
    assert.match(firstLine, /^#\s+\S/, 'First line must be a level-1 markdown heading');
  });

  it('should use Unix line endings or mixed (no bare \\r)', () => {
    // Windows CRLF is common in docs repos — just ensure the file is parseable
    const withoutCR = content.replace(/\r\n/g, '\n');
    assert.ok(withoutCR.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Required top-level sections
// ---------------------------------------------------------------------------

describe('AGENTS.md – required sections', () => {
  const requiredHeadings = [
    'Overview',
    'Starting services',
    'Key gotchas',
    'Standard commands',
  ];

  for (const heading of requiredHeadings) {
    it(`should contain a section titled "${heading}"`, () => {
      // Match any heading level (##, ###, etc.) that starts with the expected text
      // (allowing for trailing parenthetical annotations like "(see `package.json` scripts)")
      const pattern = new RegExp(`^#{1,6}\\s+${heading}`, 'im');
      assert.match(content, pattern, `Missing section: "${heading}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// Technology stack mentions
// ---------------------------------------------------------------------------

describe('AGENTS.md – technology stack', () => {
  it('should mention pnpm as the package manager', () => {
    assert.ok(content.includes('pnpm'), 'Must document pnpm usage');
  });

  it('should specify Node.js version requirement', () => {
    assert.match(content, /Node\.js\s+\d+/, 'Must specify a Node.js version');
  });

  it('should mention the API server package (@workspace/api-server)', () => {
    assert.ok(
      content.includes('@workspace/api-server'),
      'Must reference @workspace/api-server workspace package'
    );
  });

  it('should mention the frontend package (@workspace/poultry-manager)', () => {
    assert.ok(
      content.includes('@workspace/poultry-manager'),
      'Must reference @workspace/poultry-manager workspace package'
    );
  });

  it('should mention Express as the backend framework', () => {
    assert.match(content, /Express/i, 'Must mention Express backend');
  });

  it('should mention React as the frontend framework', () => {
    assert.match(content, /React/i, 'Must mention React frontend');
  });

  it('should mention PostgreSQL as the database', () => {
    assert.match(content, /PostgreSQL/i, 'Must mention PostgreSQL database');
  });

  it('should mention Drizzle ORM', () => {
    assert.match(content, /Drizzle/i, 'Must mention Drizzle ORM');
  });
});

// ---------------------------------------------------------------------------
// Service ports
// ---------------------------------------------------------------------------

describe('AGENTS.md – service ports', () => {
  it('should document the API server port (8080)', () => {
    assert.ok(content.includes('8080'), 'Must document API server port 8080');
  });

  it('should document the frontend dev port (5173)', () => {
    assert.ok(content.includes('5173'), 'Must document frontend Vite port 5173');
  });
});

// ---------------------------------------------------------------------------
// Required environment variables
// ---------------------------------------------------------------------------

describe('AGENTS.md – required environment variables', () => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'PORT',
    'SESSION_SECRET',
  ];

  for (const envVar of requiredEnvVars) {
    it(`should document the required env var "${envVar}"`, () => {
      assert.ok(
        content.includes(envVar),
        `Must document required env var: ${envVar}`
      );
    });
  }

  it('should reference .env.example for configuration guidance', () => {
    assert.match(content, /\.env\.example/, 'Must reference .env.example file');
  });
});

// ---------------------------------------------------------------------------
// Default credentials
// ---------------------------------------------------------------------------

describe('AGENTS.md – default dev credentials', () => {
  it('should document the default admin username', () => {
    assert.ok(content.includes('yones'), 'Must document default admin username "yones"');
  });

  it('should document the ADMIN_PASSWORD env var for password configuration', () => {
    assert.ok(content.includes('ADMIN_PASSWORD'), 'Must document ADMIN_PASSWORD env var');
  });

  it('should document the default password value', () => {
    assert.ok(content.includes('admin123'), 'Must document default password value admin123');
  });
});

// ---------------------------------------------------------------------------
// Starting services instructions
// ---------------------------------------------------------------------------

describe('AGENTS.md – starting services', () => {
  it('should include a PostgreSQL start command', () => {
    assert.match(content, /pg_ctlcluster/, 'Must include pg_ctlcluster start command');
  });

  it('should include the API server dev command', () => {
    assert.match(
      content,
      /pnpm.*--filter.*api-server.*dev/,
      'Must include pnpm filter command for api-server dev'
    );
  });

  it('should include the frontend dev command with PORT', () => {
    assert.match(
      content,
      /PORT=5173.*pnpm.*poultry-manager/,
      'Must include frontend start command with PORT=5173'
    );
  });

  it('should document that the frontend proxies /api requests to the backend', () => {
    assert.match(content, /\/api/, 'Must document /api proxy path');
    assert.ok(content.includes('localhost:8080'), 'Must reference localhost:8080 as proxy target');
  });

  it('should document that the dev script runs drizzle-kit push', () => {
    assert.match(content, /drizzle-kit/, 'Must mention drizzle-kit in dev script description');
  });
});

// ---------------------------------------------------------------------------
// Standard commands table
// ---------------------------------------------------------------------------

describe('AGENTS.md – standard commands table', () => {
  it('should contain a markdown table with Task and Command columns', () => {
    assert.match(content, /\|\s*Task\s*\|\s*Command\s*\|/, 'Must have a table with Task and Command headers');
  });

  it('should include a table separator row', () => {
    // A table separator is a row of |---|---| or similar
    assert.match(content, /\|[-\s]+\|[-\s]+\|/, 'Table must have a separator row');
  });

  const requiredCommands = [
    { label: 'pnpm install --frozen-lockfile', description: 'install deps' },
    { label: 'pnpm run typecheck', description: 'typecheck' },
    { label: 'pnpm run verify', description: 'full verify / pre-commit check' },
    { label: 'pnpm run build', description: 'build all' },
    { label: 'pnpm run db:push', description: 'DB schema push' },
    { label: 'pnpm run codegen', description: 'codegen (OpenAPI)' },
  ];

  for (const { label, description } of requiredCommands) {
    it(`should document the "${description}" command: ${label}`, () => {
      assert.ok(content.includes(label), `Must include command: \`${label}\``);
    });
  }
});

// ---------------------------------------------------------------------------
// Key gotchas
// ---------------------------------------------------------------------------

describe('AGENTS.md – key gotchas', () => {
  it('should warn about user seeding and stale password hashes', () => {
    assert.match(
      content,
      /password hash/i,
      'Must warn about stale password hash issues requiring row deletion'
    );
  });

  it('should mention pnpm-workspace.yaml in context of build warnings', () => {
    assert.ok(
      content.includes('pnpm-workspace.yaml'),
      'Must reference pnpm-workspace.yaml for build script configuration'
    );
  });

  it('should document the pnpm run verify pre-commit check', () => {
    assert.match(
      content,
      /pre-commit/i,
      'Must document pnpm run verify as a pre-commit sanity check'
    );
  });

  it('should mention sharp optional dependency', () => {
    assert.ok(content.includes('sharp'), 'Must mention sharp optional dependency and its purpose');
  });
});

// ---------------------------------------------------------------------------
// Regression / boundary cases
// ---------------------------------------------------------------------------

describe('AGENTS.md – regression and boundary cases', () => {
  it('should not contain placeholder TODO or FIXME markers', () => {
    assert.doesNotMatch(
      content,
      /\bTODO\b|\bFIXME\b/,
      'AGENTS.md should not contain unresolved TODO/FIXME markers'
    );
  });

  it('should not contain template-style unresolved placeholders like <YOUR_VALUE>', () => {
    assert.doesNotMatch(
      content,
      /<YOUR_[A-Z_]+>/,
      'AGENTS.md must not contain unfilled template placeholders'
    );
  });

  it('should have a non-trivial length (at least 500 characters)', () => {
    assert.ok(
      content.length >= 500,
      `AGENTS.md is too short (${content.length} chars); expected at least 500`
    );
  });

  it('should contain at least one fenced code block with bash commands', () => {
    assert.match(
      content,
      /```bash[\s\S]+?```/,
      'Must contain at least one ```bash fenced code block'
    );
  });

  it('should not have duplicate section headings at the same level', () => {
    const headingPattern = /^(#{1,6})\s+(.+?)\s*$/gm;
    const seen = new Map();
    let match;
    const duplicates = [];

    while ((match = headingPattern.exec(content)) !== null) {
      const key = `${match[1]}|${match[2].toLowerCase()}`;
      if (seen.has(key)) {
        duplicates.push(match[2]);
      }
      seen.set(key, true);
    }

    assert.deepEqual(
      duplicates,
      [],
      `Duplicate section headings found: ${duplicates.join(', ')}`
    );
  });

  it('should document the WORKER_PASSWORD env var (used in server startup export)', () => {
    assert.ok(
      content.includes('WORKER_PASSWORD'),
      'Must document WORKER_PASSWORD env var exported on server startup'
    );
  });
});
