import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const BASE_INPUT =
  "w-full rounded-md border border-border bg-surface px-3 text-sm " +
  "text-foreground placeholder:text-muted transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type={rest.type ?? "text"}
      className={[BASE_INPUT, "min-h-10 py-2", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  resize?: "none" | "y";
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, resize = "none", ...rest }, ref) {
    const resizeCls = resize === "y" ? "resize-y" : "resize-none";
    return (
      <textarea
        ref={ref}
        className={[BASE_INPUT, "py-2", resizeCls, className]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      />
    );
  }
);
