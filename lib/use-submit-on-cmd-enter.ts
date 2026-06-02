import type { KeyboardEvent } from "react";

// Pure helper for textareas: Cmd/Ctrl+Enter triggers submit. Not a hook
// (no React state) — just a stable handler factory the caller can drop
// into onKeyDown without memoization.
export function submitOnCmdEnter(submit: () => void) {
  return (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };
}
