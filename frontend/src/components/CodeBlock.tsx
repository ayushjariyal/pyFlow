import { useMemo } from "react";
import { jsonLines } from "../utils/jsonTokens";

/** Syntax-coloured, line-numbered JSON. */
export function CodeBlock({
  value,
  maxHeight,
  className = "",
}: {
  value: unknown;
  maxHeight?: number;
  className?: string;
}) {
  const lines = useMemo(() => jsonLines(value), [value]);
  return (
    <div
      className={`codeblock${className ? ` ${className}` : ""}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {lines.map((tokens, i) => (
        <div key={i} className="code-line">
          <span className="code-ln">{i + 1}</span>
          <span>
            {tokens.map((tok, k) => (
              <span key={k} className={`tok-${tok.kind}`}>
                {tok.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
