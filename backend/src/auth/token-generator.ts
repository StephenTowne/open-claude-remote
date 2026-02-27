import { randomBytes } from 'node:crypto';
import { TOKEN_BYTES, SESSION_ID_BYTES } from '@claude-remote/shared';

/**
 * Generate a random hex token for authentication.
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Generate a random session ID.
 */
export function generateSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString('hex');
}
