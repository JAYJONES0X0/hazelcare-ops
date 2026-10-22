export async function authRequest(path: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Could not reach the sign-in service. Check your connection and retry.');
  }
  return response;
}

export async function confirmAuthSession() {
  const response = await authRequest('session');
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.authed) throw new Error('Sign-in did not create a session. Please retry or contact the administrator.');
  return session as { authed: true; role: string; email: string };
}
