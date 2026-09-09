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
    if (!map.has(codePoint)) map.set(codePoint, byte);
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
