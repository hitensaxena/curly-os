import type { SVGProps } from "react";

// Shared OS navigation model — consumed by the Spaces menu in the Curly bar.
export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = { label: string; items: NavItem[] };

// The four surfaces. Everything the app can show lives inside one of them.
export const NAV: NavItem[] = [
  { href: "/", label: "Ask" },
  { href: "/library", label: "Library" },
  { href: "/graph", label: "Graph" },
  { href: "/think", label: "Think" },
  { href: "/system", label: "System" },
  { href: "/chat", label: "Chat" },
];
