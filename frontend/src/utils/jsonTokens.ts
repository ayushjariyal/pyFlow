// Splits pretty-printed JSON into coloured tokens, one array per line.

export type TokenKind = "key" | "str" | "num" | "bool" | "pun";

export interface Token {
  text: string;
  kind: TokenKind;
}

const TOKEN_RE =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

export function jsonLines(value: unknown): Token[][] {
  const text = JSON.stringify(value, null, 2) ?? "null";
  return text.split("\n").map((line) => {
    const tokens: Token[] = [];
    let last = 0;
    for (const match of line.matchAll(TOKEN_RE)) {
      const index = match.index ?? 0;
      const tok = match[0];
      if (index > last) tokens.push({ text: line.slice(last, index), kind: "pun" });
      if (match[2]) {
        // An object key: colour the string, leave the trailing colon as punctuation.
        const colon = tok.lastIndexOf(":");
        tokens.push({ text: tok.slice(0, colon), kind: "key" });
        tokens.push({ text: tok.slice(colon), kind: "pun" });
      } else if (tok[0] === '"') {
        tokens.push({ text: tok, kind: "str" });
      } else {
        tokens.push({ text: tok, kind: /^(true|false|null)$/.test(tok) ? "bool" : "num" });
      }
      last = index + tok.length;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), kind: "pun" });
    return tokens;
  });
}
