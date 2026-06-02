import { headers } from "next/headers";

// Auth model: Caddy + Authentik enforce SSO at the edge and forward
// x-authentik-* headers. This module reads them and gates on a single
// allow-listed user. For LOCAL dev (no Authentik), set CURLY_AUTH_DISABLED=1
// and everything is treated as the dev user.
const AUTH_DISABLED = process.env.CURLY_AUTH_DISABLED === "1";
const DEV_USER = process.env.CURLY_DEV_USER ?? "hiten";

// The real Authentik username allowed in production. Confirm against the live
// user at deploy (akadmin vs crazymage). Override with CURLY_ALLOWED_USER.
export const ALLOWED_USERNAME = process.env.CURLY_ALLOWED_USER ?? "akadmin";

export type AuthUser = {
  username: string;
  displayName: string | null;
  email: string | null;
  groups: string[];
};

// Authentik's forward-auth provider forwards these by default. If you
// remap them in Caddy, change them here too.
const HEADER_USERNAME = "x-authentik-username";
const HEADER_NAME = "x-authentik-name";
const HEADER_EMAIL = "x-authentik-email";
const HEADER_GROUPS = "x-authentik-groups";

export function usernameFromHeaders(h: Headers): string | null {
  return h.get(HEADER_USERNAME) ?? (AUTH_DISABLED ? DEV_USER : null);
}

export function isAllowed(h: Headers): boolean {
  if (AUTH_DISABLED) return true;
  return h.get(HEADER_USERNAME) === ALLOWED_USERNAME;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const h = await headers();
  const username = h.get(HEADER_USERNAME) ?? (AUTH_DISABLED ? DEV_USER : null);
  if (!username) {
    // proxy.ts already rejects unauth'd requests; reaching this means
    // something is misconfigured upstream.
    throw new Error(
      `Missing ${HEADER_USERNAME} header — auth proxy misconfigured`,
    );
  }
  const groupsHeader = h.get(HEADER_GROUPS) ?? "";
  return {
    username,
    displayName: h.get(HEADER_NAME),
    email: h.get(HEADER_EMAIL),
    groups: groupsHeader
      ? groupsHeader.split(",").map((g) => g.trim()).filter(Boolean)
      : [],
  };
}
