export type PawnBraceKind = "open" | "close";

export interface PawnBracePair {
  open: number;
  close: number;
}

export interface PawnUnmatchedBrace {
  kind: PawnBraceKind;
  offset: number;
}

export interface PawnBraceScan {
  pairs: PawnBracePair[];
  unmatched: PawnUnmatchedBrace[];
  pairAt(offset: number): PawnBracePair | undefined;
}

function charLiteralEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length && text[i] !== "\n" && text[i] !== "\r"; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text[i] === "'") return i;
  }
  return -1;
}

export function scanPawnBraces(text: string): PawnBraceScan {
  const stack: number[] = [];
  const pairs: PawnBracePair[] = [];
  const pairByOffset = new Map<number, PawnBracePair>();
  const unmatched: PawnUnmatchedBrace[] = [];
  let state: "code" | "lineComment" | "blockComment" | "string" = "code";
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (state === "lineComment") { if (ch === "\n") state = "code"; continue; }
    if (state === "blockComment") {
      if (ch === "*" && next === "/") { i++; state = "code"; }
      continue;
    }
    if (state === "string") {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') state = "code";
      continue;
    }
    if (ch === "/" && next === "/") { i++; state = "lineComment"; continue; }
    if (ch === "/" && next === "*") { i++; state = "blockComment"; continue; }
    if (ch === '"') { state = "string"; escaped = false; continue; }
    if (ch === "'") {
      const end = charLiteralEnd(text, i);
      if (end !== -1) { i = end; continue; }
    }
    if (ch === "{") stack.push(i);
    else if (ch === "}") {
      if (stack.length === 0) unmatched.push({ kind: "close", offset: i });
      else { const pair = { open: stack.pop()!, close: i }; pairs.push(pair); pairByOffset.set(pair.open, pair); pairByOffset.set(pair.close, pair); }
    }
  }

  while (stack.length) unmatched.push({ kind: "open", offset: stack.pop()! });
  pairs.sort((a, b) => a.open - b.open);
  unmatched.sort((a, b) => a.offset - b.offset);
  const pairAt = (offset: number) => pairByOffset.get(offset);
  return { pairs, unmatched, pairAt };
}
