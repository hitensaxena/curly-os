import { promises as fs } from "node:fs";
import path from "node:path";
import { VAULT } from "@/lib/paths";
import {
  SETTINGS_ROOT_FILES,
  SETTINGS_READ_ONLY,
  SETTINGS_WRITEABLE_PREFIXES,
  isSettingsReadable,
  isSettingsWriteable,
  settingsRequiresConfirmation,
} from "@/lib/vault-paths";

export type VaultFile = {
  rel: string;
  name: string;
  group: string;
  writeable: boolean;
  requiresConfirmation: boolean;
};

// Re-export the path helpers so existing server callers don't need a second import.
export const isReadable = isSettingsReadable;
export const isWriteable = isSettingsWriteable;
export const requiresConfirmation = settingsRequiresConfirmation;

export function vaultPathFor(rel: string): string {
  const full = path.resolve(VAULT, rel);
  if (!full.startsWith(VAULT + path.sep) && full !== VAULT) {
    throw new Error("path escape");
  }
  return full;
}

export async function readVaultFile(rel: string): Promise<string> {
  if (!isReadable(rel)) throw new Error("not readable");
  return fs.readFile(vaultPathFor(rel), "utf-8");
}

export async function writeVaultFile(rel: string, content: string): Promise<void> {
  if (!isWriteable(rel)) throw new Error("not writeable");
  await fs.writeFile(vaultPathFor(rel), content, "utf-8");
}

export async function listWhitelistedFiles(): Promise<VaultFile[]> {
  const out: VaultFile[] = [];

  for (const name of SETTINGS_ROOT_FILES) {
    if (await exists(path.join(VAULT, name))) {
      out.push(toFile(name, "Identity (root)"));
    }
  }
  for (const prefix of SETTINGS_WRITEABLE_PREFIXES) {
    const dir = prefix.replace(/\/$/, "");
    for (const rel of await listDir(dir)) {
      if (rel.endsWith(".md")) {
        out.push(toFile(rel, prefixToGroup(prefix)));
      }
    }
  }
  for (const rel of SETTINGS_READ_ONLY) {
    if (await exists(path.join(VAULT, rel))) {
      out.push(toFile(rel, "Health (read-only)"));
    }
  }
  return out;
}

function toFile(rel: string, group: string): VaultFile {
  return {
    rel,
    name: path.basename(rel),
    group,
    writeable: isWriteable(rel),
    requiresConfirmation: requiresConfirmation(rel),
  };
}

async function listDir(rel: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(VAULT, rel));
    return entries.map((e) => `${rel}/${e}`).sort();
  } catch {
    return [];
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function prefixToGroup(prefix: string): string {
  const name = prefix.replace(/\/$/, "");
  if (name === "ai-context") return "AI context";
  return name.charAt(0).toUpperCase() + name.slice(1);
}
