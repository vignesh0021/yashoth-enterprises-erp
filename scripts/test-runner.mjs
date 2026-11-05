#!/usr/bin/env node
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const testsDir = path.join(projectRoot, 'tests');

// Register custom module loader for vitest shim if needed
const testFiles = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => path.join(testsDir, f));

console.log(`\n==================================================`);
console.log(`YE ERP AUTHORITATIVE TEST SUITE (Node Test Engine)`);
console.log(`==================================================`);
console.log(`Found ${testFiles.length} test suites in tests/\n`);

const loaderPath = path.join(__dirname, 'test-loader.mjs');

// Spawn node test runner with the loader
import { spawn } from 'node:child_process';

const child = spawn(
  process.execPath,
  [
    '--experimental-strip-types',
    '--loader',
    loaderPath,
    '--test',
    ...testFiles
  ],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' }
  }
);

child.on('exit', (code) => {
  process.exit(code || 0);
});
