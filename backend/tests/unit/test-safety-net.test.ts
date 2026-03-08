import { describe, it, expect } from 'vitest';

describe('test-safety-net', () => {
  it('should block fetch to localhost:8866', () => {
    expect(() => fetch('http://localhost:8866/api/shutdown')).toThrow(
      '[test-safety-net] Blocked fetch to real daemon',
    );
  });

  it('should block fetch to 127.0.0.1:8866', () => {
    expect(() => fetch('http://127.0.0.1:8866/api/health')).toThrow(
      '[test-safety-net] Blocked fetch to real daemon',
    );
  });

  it('should allow fetch to other ports', async () => {
    // Use a port that nothing listens on — expect a network error, not our guard error
    await expect(fetch('http://localhost:19999/test')).rejects.not.toThrow(
      '[test-safety-net]',
    );
  });
});
