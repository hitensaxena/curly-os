// Pure path-validation helpers. NO node:fs imports — safe to use from client
// components for "should we render this as a link?" checks.

export const SETTINGS_WRITEABLE_PREFIXES = [
  "ai-context/",
  "agents/",
  "prompts/",
  "skills/",
];

export const SETTINGS_ROOT_FILES = new Set(["START_HERE.md", "CLAUDE.md"]);

// Files explicitly viewable in /settings UI but never editable there.
export const SETTINGS_READ_ONLY = new Set(["health/conditions.md"]);

// Writes need a confirm() prompt before they go through.
export const REQUIRES_CONFIRMATION = new Set(["ai-context/personal_lore.md"]);

// Anything outside this whitelist is hidden from the /settings UI entirely
// (per the plan: journals/*, memoirs/*, systems/*, etc. are never accessible
// from the UI even read-only).
export function isSettingsReadable(rel: string): boolean {
  if (!rel || rel.includes("..")) return false;
  if (!rel.endsWith(".md")) return false;
  if (SETTINGS_ROOT_FILES.has(rel)) return true;
  if (SETTINGS_READ_ONLY.has(rel)) return true;
  return SETTINGS_WRITEABLE_PREFIXES.some((p) => rel.startsWith(p));
}

export function isSettingsWriteable(rel: string): boolean {
  if (!isSettingsReadable(rel)) return false;
  if (SETTINGS_READ_ONLY.has(rel)) return false;
  return true;
}

export function settingsRequiresConfirmation(rel: string): boolean {
  return REQUIRES_CONFIRMATION.has(rel);
}

// Build the /notes URL for a vault-relative path, encoding each segment so
// titles/dates with spaces or special chars survive the catch-all route.
export function noteHref(rel: string): string {
  return "/notes/" + rel.split("/").map(encodeURIComponent).join("/");
}
