import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setupE2eHooks } from '../helpers/hooks-setup.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

function buildProject() {
  console.log('[e2e-setup] Building project...');
  execSync('pnpm build', { cwd: PROJECT_ROOT, stdio: 'inherit', timeout: 120_000 });
  console.log('[e2e-setup] Build complete.');
}

export default async function globalSetup() {
  buildProject();
  setupE2eHooks();
}
