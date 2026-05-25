import Link from "next/link";

/*
 * Family tile — broken-grid entry into a product category.
 *
 * No image yet (Phase 1 ships with placeholder material tints). Each tile
 * carries the family's `--mat-*` semantic token as its accent.
 */

export type MaterialToken =
  | "laser"
  | "uv"
  | "crystal"
  | "leather"
  | "metal";

const MAT_VAR: Record<MaterialToken, string> = {
  laser: "var(--color-mat-laser)",
  uv: "var(--color-mat-uv)",
  crystal: "var(--color-mat-crystal)",
  leather: "var(--color-mat-leather)",
  metal: "var(--color-mat-metal)",
};

export function FamilyTile({
  href,
  name,
  caption,
  material,
  size = "md",
}: {
  href: string;
  name: string;
  caption: string;
  material: MaterialToken;
  size?: "sm" | "md" | "lg";
}) {
  const heights: Record<"sm" | "md" | "lg", string> = {
    sm: "min-h-[14rem] md:min-h-[18rem]",
    md: "min-h-[18rem] md:min-h-[24rem]",
    lg: "min-h-[22rem] md:min-h-[30rem]",
  };
  return (
    <Link
      href={href}
      className={`group surface-noise relative block overflow-hidden ${heights[size]}`}
      style={{
        background: `color-mix(in oklch, ${MAT_VAR[material]} 22%, var(--color-paper-100))`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "color-mix(in oklch, var(--color-paper-300) 60%, transparent)" }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-8">
        <span
          className="font-mono text-[0.7rem] uppercase tracking-[0.22em]"
          style={{ color: "color-mix(in oklch, var(--color-ink-800) 70%, transparent)" }}
        >
          {caption}
        </span>
        <h3
          className="font-display text-3xl md:text-4xl leading-[1.05]"
          style={{
            fontVariationSettings: '"opsz" 36, "wght" 420',
            textWrap: "balance",
          }}
        >
          {name}
        </h3>
      </div>
    </Link>
  );
}
