/**
 * Staff login email allowlist from AUTH_LOGIN_EMAIL (comma-separated, case-insensitive).
 * If empty or missing, login and OTP send must fail closed — never allow any address.
 */

export function getAllowedLoginEmails() {
  return (process.env.AUTH_LOGIN_EMAIL || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export function isLoginAllowlistConfigured() {
  return getAllowedLoginEmails().length > 0;
}

export function isLoginEmailAllowed(normalizedEmail) {
  const list = getAllowedLoginEmails();
  return list.length > 0 && list.includes(normalizedEmail);
}
