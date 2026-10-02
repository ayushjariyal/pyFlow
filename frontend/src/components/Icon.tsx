import type { CSSProperties } from "react";

type Weight = "regular" | "bold" | "fill";

const WEIGHT_CLASS: Record<Weight, string> = {
  regular: "ph",
  bold: "ph-bold",
  fill: "ph-fill",
};

/** A Phosphor icon-font glyph. Sizes with font-size, colours with `color`. */
export function Icon({
  name,
  weight = "regular",
  spin = false,
  className = "",
  style,
}: {
  name: string;
  weight?: Weight;
  spin?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <i
      aria-hidden="true"
      className={`${WEIGHT_CLASS[weight]} ph-${name}${spin ? " spin" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    />
  );
}
