import { windows_874, windows_1251 } from "./whatwgTables";

export type PawnEncoding = "windows-874" | "windows-1251";

export interface EncodingFailure {
  codePoint: number;
  index: number;
}

export interface EncodeResult {
  bytes: Buffer;
  encoding: PawnEncoding;
  failures: EncodingFailure[];
}

const reverseTables: Record<PawnEncoding, Map<number, number>> = {
  "windows-874": reverseTable(windows_874),
  "windows-1251": reverseTable(windows_1251),
};

function reverseTable(table: Record<number, number>): Map<number, number> {
  const map = new Map<number, number>();
  for (const [byteText, codePoint] of Object.entries(table)) {
    const byte = Number(byteText);
    if (byte >= 0x80 && !map.has(codePoint)) map.set(codePoint, byte);
  }
  return map;
}

export function decodeUtf8Strict(bytes: Buffer): string | undefined {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch {
    return undefined;
  }
}

export function encodeUtf8ToLegacy(bytes: Buffer, encoding: PawnEncoding): EncodeResult {
  const text = decodeUtf8Strict(bytes);
  if (text === undefined) return { bytes, encoding, failures: [] };
  const output: number[] = [];
  const failures: EncodingFailure[] = [];
  let sourceIndex = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0)!;
    const encoded = codePoint <= 0x7f ? codePoint : reverseTables[encoding].get(codePoint);
    if (encoded === undefined) failures.push({ codePoint, index: sourceIndex });
    else output.push(encoded);
    sourceIndex += character.length;
  }
  return { bytes: Buffer.from(output), encoding, failures };
}

export interface PawnLiteralEncodeResult {
  text: string;
  encoding: PawnEncoding;
  failures: EncodingFailure[];
  convertedCharacters: number;
}

export function encodeUtf8PawnLiteralsToEscapes(text: string, encoding: PawnEncoding): PawnLiteralEncodeResult {
  const table = reverseTables[encoding];
  const failures: EncodingFailure[] = [];
  let output = "";
  let state: "code" | "lineComment" | "blockComment" | "string" | "char" = "code";
  let escaped = false;
  let convertedCharacters = 0;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const next = text[index + 1];
    const codePoint = character.codePointAt(0)!;

    if (state === "lineComment") {
      output += character;
      if (character === "\n") state = "code";
      continue;
    }

    if (state === "blockComment") {
      output += character;
      if (character === "*" && next === "/") {
        output += next;
        index++;
        state = "code";
      }
      continue;
    }

    if (state === "code") {
      if (character === "/" && next === "/") {
        output += "//";
        index++;
        state = "lineComment";
        continue;
      }
      if (character === "/" && next === "*") {
        output += "/*";
        index++;
        state = "blockComment";
        continue;
      }
      if (character === '"') {
        output += character;
        state = "string";
        escaped = false;
        continue;
      }
      if (character === "'") {
        output += character;
        state = "char";
        escaped = false;
        continue;
      }
      output += character;
      continue;
    }

    if (escaped) {
      output += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      output += character;
      escaped = true;
      continue;
    }

    if (state === "string" && character === '"') {
      output += character;
      state = "code";
      continue;
    }
    if (state === "char" && character === "'") {
      output += character;
      state = "code";
      continue;
    }

    if (codePoint <= 0x7f) {
      output += character;
      continue;
    }

    const encoded = table.get(codePoint);
    if (encoded === undefined) {
      failures.push({ codePoint, index });
      output += character;
      index += character.length - 1;
      continue;
    }

    output += `\\x${encoded.toString(16).toUpperCase()};`;
    convertedCharacters++;
    index += character.length - 1;
  }

  return { text: output, encoding, failures, convertedCharacters };
}
