// Static Mintrix Bloom mark. Inlines the SVG so `currentColor`
// resolves to the surrounding text color — drop a `<Logo />` anywhere
// and it picks up the right ink for light/dark mode.

import { renderSettled } from "@/lib/bloom-mark";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 96,
  xl: 160,
};

function getInnerHTML(sizePx: number): string {
  // Use a fake SVG element to capture innerHTML. The renderer writes to
  // it synchronously, no DOM needed.
  const fake = { innerHTML: "" } as unknown as SVGSVGElement;
  renderSettled(fake, sizePx);
  return fake.innerHTML;
}

export function Logo({
  size = "md",
  className,
  ariaLabel = "Mintrix Bloom mark",
}: {
  size?: Size;
  className?: string;
  ariaLabel?: string;
}) {
  const px = SIZE_PX[size];
  const inner = getInnerHTML(px);
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 240 240"
      aria-label={ariaLabel}
      role="img"
      className={className}
      style={{ overflow: "visible", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
