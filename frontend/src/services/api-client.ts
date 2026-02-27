const API_BASE = '/api';

export async function authenticate(token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  if (res.status === 429) {
    throw new Error('Too many attempts. Try again later.');
  }

  return res.ok;
}

export async function getStatus(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/status`, {
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  return res.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
