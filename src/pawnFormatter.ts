// Node 24 exposes fetch globally, but a local WASM asset must be loaded from disk.
if (typeof process !== "undefined" && process.versions?.node && typeof (globalThis as any).fetch === "function") {
  (globalThis as any).fetch = undefined;
}
const { format } = require("astyle") as { format: (code: string, options?: string) => Promise<string> };
const ASTYLE_MAX_INPUT = 750_000;
type PawnLexState = "code" | "blockComment";

export type PawnBraceStyle = "Allman" | "K&R" | "Stroustrup" | "Google";
const beforeFix: Array<[RegExp, string]> = [
  [/^[ \t]+#|^#/gm, "//pawnd_tag_hash_$&"],
  [/\f|\v|\t*(new|static|const)\s*\n\s*((.|\s)*?)\s*;/gm, "$1 $2;"],
  [/case\s*(\S*)\s*:\s*(\w+\s*.*;)/gm, "case $1pawnd_switch_case_signle_line$2"],
  [/extract\s*(.*)->\s*(.*?);/gm, "pawnd_sscanf_extract_$1___$2___"],
  [/([^\s:]):([^\s:])(?=(?:[^"]*"[^"]*")*[^"]*$)/gm, "$1pawnd_tag_semicolon$2"],
  [/([^\s:])::([^\s:])(?=(?:[^"]*"[^"]*")*[^"]*$)/gm, "$1pawnd_tag_two_semicolon$2"],
  [/([^\s:])@([^\s:])(?=(?:[^"]*"[^"]*")*[^"]*$)/gm, "$1pawnd_tag_at$2"],
  [/\bconst\b/gm, "pawnd_tag_const"],
];
const afterFix: Array<[RegExp, string]> = [
  [/\bpawnd_tag_const\b/gm, "const"],
  [/case(.*)pawnd_switch_case_signle_line/gm, "case$1: "],
  [/pawnd_sscanf_extract_(.*?)___(.*?)___/gm, "extract $1-> $2;"],
  [/pawnd_tag_semicolon/gm, ":"],
  [/pawnd_tag_two_semicolon/gm, "::"],
  [/pawnd_tag_at/gm, "@"],
  [/>(\s+)\nhook/gm, ">\nhook"],
  [/static(\s+)const/gm, "static const"],
  [/\.\s\./gm, ".."],
  [/^[ \t]+\/\/pawnd_tag_hash_|^\/\/pawnd_tag_hash_/gm, ""],
  [/CMD(.*):\r\n(.*)\(/gim, "CMD$1:$2("],
  [/CMD(.*):\n(.*)\(/gim, "CMD$1:$2("],
  [/(static|const|new) (.*?):\s+/gm, "$1 $2:"],
];

function pawnCharLiteralEnd(text: string, start: number): number {
  if (text[start] !== "'") return -1;
  for (let index = start + 1; index < text.length && text[index] !== "\n" && text[index] !== "\r"; index++) {
    if (text[index] === "\\") { index++; continue; }
    if (text[index] === "'") return index;
  }
  return -1;
}

function lineCodeView(line: string, state: PawnLexState): { code: string; state: PawnLexState } {
  let current = state;
  let inString = false;
  let escaped = false;
  const chars = [...line];
  for (let cursor = 0; cursor < chars.length; cursor++) {
    const ch = chars[cursor];
    const next = chars[cursor + 1];
    if (current === "blockComment") {
      chars[cursor] = " ";
      if (ch === "*" && next === "/") { chars[cursor + 1] = " "; cursor++; current = "code"; }
      continue;
    }
    if (inString) {
      chars[cursor] = " ";
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === "/" && next === "/") { for (let rest = cursor; rest < chars.length; rest++) chars[rest] = " "; break; }
    if (ch === "/" && next === "*") { chars[cursor] = " "; chars[cursor + 1] = " "; cursor++; current = "blockComment"; continue; }
    if (ch === '"') { chars[cursor] = " "; inString = true; continue; }
    if (ch === "'") {
      const end = pawnCharLiteralEnd(line, cursor);
      if (end !== -1) { for (let rest = cursor; rest <= end; rest++) chars[rest] = " "; cursor = end; }
    }
  }
  return { code: chars.join(""), state: current };
}

function normalizePawnBraceLayout(content: string): string {
  const lines = content.split(/\r?\n/);
  let state: PawnLexState = "code";
  const views: string[] = [];
  const blocked: boolean[] = [];
  for (const line of lines) {
    const view = lineCodeView(line, state);
    views.push(view.code);
    blocked.push(/\/\/|\/\*/.test(line));
    state = view.state;
  }
  for (let index = 0; index + 1 < lines.length; index++) {
    if (blocked[index] || blocked[index + 1]) continue;
    const current = views[index].trimEnd();
    const next = views[index + 1].trim();
    if (current.endsWith(")") && next === "{") {
      lines[index] = lines[index].trimEnd() + " {";
      lines.splice(index + 1, 1); views.splice(index + 1, 1); blocked.splice(index + 1, 1); index--; continue;
    }
    if (current === "}" && /^(else|else\s+if\b)/.test(next)) {
      lines[index] = lines[index].trimEnd() + " " + lines[index + 1].trimStart();
      lines.splice(index + 1, 1); views[index] = views[index].trimEnd() + " " + views[index + 1].trimStart(); views.splice(index + 1, 1); blocked.splice(index + 1, 1); index--; continue;
    }
    if (/^else(?:\s+if\b.*)?$/.test(current) && next === "{") {
      lines[index] = lines[index].trimEnd() + " {";
      lines.splice(index + 1, 1); views.splice(index + 1, 1); blocked.splice(index + 1, 1); index--;
    }
  }
  return lines.join("\n");
}

function normalizePawnBraces(content: string): string {
  const lines = content.split(/\r?\n/);
  let depth = 0;
  let blockComment = false;
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed) continue;
    const view = lineCodeView(trimmed, blockComment ? "blockComment" : "code");
    const code = view.code;
    const first = code.search(/\S/);
    const leadingClose = first >= 0 && code[first] === "}";
    if (leadingClose) depth = Math.max(0, depth - 1);
    lines[index] = " ".repeat(depth * 4) + trimmed;
    for (let cursor = 0; cursor < code.length; cursor++) {
      if (leadingClose && cursor === first) continue;
      if (code[cursor] === "{") depth++;
      else if (code[cursor] === "}") depth = Math.max(0, depth - 1);
    }
    blockComment = view.state === "blockComment";
  }
  return lines.join("\n");
}

function normalizePawnDeclarations(content: string): string {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const first = lines[index].match(/^(\s*)new\s+(.*)$/);
    const standalone = lines[index].match(/^(\s*)new\s*$/);
    if (!first && !standalone) continue;
    const indent = (first ?? standalone)![1].length;
    let end = index;
    if (!(first && first[2].trimEnd().endsWith(";"))) {
      for (let cursor = index + 1; cursor < lines.length; cursor++) {
        const value = lines[cursor].trim();
        if (!value) continue;
        end = cursor;
        if (value.endsWith(";")) break;
      }
    }
    if (end === index) continue;
    if (standalone) lines[index] = " ".repeat(indent) + "new " + lines[index + 1].trim();
    const continuationIndent = indent + 4;
    for (let cursor = index + 1; cursor <= end; cursor++) {
      const value = lines[cursor].trim();
      if (value) lines[cursor] = " ".repeat(continuationIndent) + value;
    }
    index = end;
  }
  return lines.join("\n");
}

function compactSingleStatementBlocks(content: string): string {
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\s*)(if|else if|else|while|for|foreach)\b(.*)\{\s*$/);
    if (match && index + 2 < lines.length) {
      const statement = lines[index + 1].trim();
      let cursor = index + 2;
      while (cursor < lines.length && !lines[cursor].trim()) cursor++;
      const close = lines[cursor]?.trim() ?? "";
      let afterClose = cursor + 1;
      while (afterClose < lines.length && !lines[afterClose].trim()) afterClose++;
      const following = lines[afterClose]?.trim() ?? "";
      if (/^[^{}\n]*;\s*(\/\/.*)?$/.test(statement) && close === "}" && !/^else\b/.test(following)) {
        output.push(`${match[1]}${match[2]}${match[3].trimEnd()} ${statement}`.trimEnd());
        index = cursor;
        continue;
      }
    }
    output.push(lines[index]);
  }
  return output.join("\n");
}

export interface PawnFormatOffsets { start: number; end: number; }

export function expandPawnFormatRange(content: string, range: PawnFormatOffsets): PawnFormatOffsets {
  const start = Math.max(0, Math.min(range.start, content.length));
  const end = Math.max(start, Math.min(range.end, content.length));
  const stack: number[] = [];
  const pairs = new Map<number, number>();
  let state: "code" | "lineComment" | "blockComment" | "string" = "code";
  let escaped = false;
  for (let index = 0; index < content.length; index++) {
    const ch = content[index];
    const next = content[index + 1];
    if (state === "lineComment") { if (ch === "\n") state = "code"; continue; }
    if (state === "blockComment") { if (ch === "*" && next === "/") { index++; state = "code"; } continue; }
    if (state === "string") { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') state = "code"; continue; }
    if (ch === "/" && next === "/") { index++; state = "lineComment"; continue; }
    if (ch === "/" && next === "*") { index++; state = "blockComment"; continue; }
    if (ch === '"') { state = "string"; escaped = false; continue; }
    if (ch === "'") { const charEnd = pawnCharLiteralEnd(content, index); if (charEnd !== -1) { index = charEnd; continue; } }
    if (ch === "{") stack.push(index);
    else if (ch === "}" && stack.length > 0) { const open = stack.pop()!; pairs.set(open, index + 1); }
  }
  let bestStart = -1; let bestEnd = -1;
  for (const [open, close] of pairs) {
    const containsSelection = open <= start && end <= close;
    const startsBeforeBlock = start <= open && open < end && end <= close;
    if ((containsSelection || startsBeforeBlock) && (bestStart === -1 || open > bestStart)) { bestStart = open; bestEnd = close; }
  }
  if (bestStart === -1) {
    bestStart = content.lastIndexOf("\n", start - 1) + 1;
    const nextLine = content.indexOf("\n", end);
    bestEnd = nextLine === -1 ? content.length : nextLine;
  } else bestStart = content.lastIndexOf("\n", bestStart - 1) + 1;
  return { start: bestStart, end: bestEnd };
}

export async function formatPawn(content: string, braceStyle: PawnBraceStyle = "K&R"): Promise<string> {
  for (const [expr, replacement] of beforeFix) content = content.replace(expr, replacement);
  const style = braceStyle === "K&R" ? "kr" : braceStyle === "Stroustrup" ? "stroustrup" : braceStyle === "Google" ? "google" : "allman";
  const options = [`--style=${style}`, "--indent-switches", "--indent-preproc-define", "--indent-col1-comments", "--indent-preproc-block", "--indent-after-parens", "--pad-comma", "--pad-oper", "--unpad-paren", "--pad-header", "--attach-return-type"];
  if (content.length <= ASTYLE_MAX_INPUT) {
    try { content = await format(content, options.join(" ")); } catch { /* use Pawn-safe normalization */ }
  }
  content = normalizePawnBraceLayout(content);
  for (const [expr, replacement] of afterFix) content = content.replace(expr, replacement);
  content = normalizePawnBraces(content);
  content = normalizePawnDeclarations(content);
  if (content.length <= ASTYLE_MAX_INPUT) content = compactSingleStatementBlocks(content);
  return content.trimEnd() + "\n";
}
