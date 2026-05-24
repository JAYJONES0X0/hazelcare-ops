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

export function getLoginRoleMap() {
  const mapped = (process.env.AUTH_LOGIN_EMAIL_ROLES || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((pair) => {
      const [email, role] = pair.split(':').map((v) => (v || '').trim().toLowerCase());
      return { email, role };
    })
    .filter((x) => x.email && x.role);

  const out = new Map();
  for (const item of mapped) {
    out.set(item.email, item.role);
  }
  return out;
}

export function getRoleForLoginEmail(normalizedEmail, fallbackRole = 'manager') {
  const map = getLoginRoleMap();
  return map.get(normalizedEmail) || fallbackRole;
}

export function isLoginAllowlistConfigured() {
  return getAllowedLoginEmails().length > 0;
}

export function isLoginEmailAllowed(normalizedEmail) {
  const list = getAllowedLoginEmails();
  return list.length > 0 && list.includes(normalizedEmail);
}
