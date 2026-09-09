// astyle 2.0's Emscripten loader prefers global fetch when it exists.
// Node 24 exposes fetch globally, but a local WASM asset must be loaded from disk.
if (typeof process !== "undefined" && process.versions?.node && typeof (globalThis as any).fetch === "function") {
  (globalThis as any).fetch = undefined;
}

const { format } = require("astyle") as { format: (code: string, options?: string) => Promise<string> };

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

export async function formatPawn(content: string, braceStyle: PawnBraceStyle = "Allman"): Promise<string> {
  for (const [expr, replacement] of beforeFix) content = content.replace(expr, replacement);

  const style = braceStyle === "K&R" ? "kr" : braceStyle === "Stroustrup" ? "stroustrup" : braceStyle === "Google" ? "google" : "allman";
  const options = [
    `--style=${style}`,
    "--indent-switches",
    "--indent-preproc-define",
    "--indent-col1-comments",
    "--indent-preproc-block",
    "--indent-after-parens",
    "--pad-comma",
    "--pad-oper",
    "--unpad-paren",
    "--pad-header",
    "--attach-return-type",
  ];

  content = await format(content, options.join(" "));
  for (const [expr, replacement] of afterFix) content = content.replace(expr, replacement);
  return content.trimEnd() + "\n";
}
