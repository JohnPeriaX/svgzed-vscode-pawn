import * as fs from "fs";
import * as path from "path";
import { encodeUtf8ToLegacy, decodeUtf8Strict, type PawnEncoding } from "./codec";

export type SourceEncoding = "auto" | "utf-8" | PawnEncoding;

export interface EncodingDiagnostic {
  filePath: string;
  encoding: string;
  message: string;
  codePoint?: number;
  byteIndex?: number;
}

export interface PreparedPawnBuild {
  root: string;
  sourcePath: string;
  includeDirs: string[];
  diagnostics: EncodingDiagnostic[];
  convertedFiles: string[];
  preservedFiles: string[];
}

const SOURCE_EXTENSIONS = new Set([".pwn", ".inc", ".pawn"]);
const DIRECTIVE = /(?:coding|encoding)\s*[:=]\s*([A-Za-z0-9._-]+)/i;
const TARGET_ENCODINGS: Record<string, PawnEncoding> = {
  "windows-874": "windows-874",
  cp874: "windows-874",
  windows874: "windows-874",
  "windows-1251": "windows-1251",
  cp1251: "windows-1251",
  windows1251: "windows-1251",
};

function canonicalEncoding(value: string): SourceEncoding | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  if (normalized === "utf8" || normalized === "utf-8") return "utf-8";
  return TARGET_ENCODINGS[normalized];
}

function readEncodingDirective(bytes: Buffer): SourceEncoding | undefined {
  const header = bytes.subarray(0, Math.min(bytes.length, 2048)).toString("latin1");
  for (const line of header.split(/\r?\n/).slice(0, 8)) {
    const match = line.match(DIRECTIVE);
    if (match) return canonicalEncoding(match[1]);
  }
  return undefined;
}

function detectSourceEncoding(bytes: Buffer, requested: SourceEncoding): SourceEncoding {
  if (requested !== "auto") return requested;
  const directive = readEncodingDirective(bytes);
  if (directive && directive !== "auto") return directive;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes.every((byte) => byte < 0x80)) return "utf-8";
  return decodeUtf8Strict(bytes) !== undefined ? "utf-8" : "windows-874";
}

function relativeMirrorPath(root: string, workspacePath: string, source: string): string {
  return path.join(root, path.relative(workspacePath, source));
}

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function resolveInclude(currentFile: string, includeName: string, quoted: boolean, includeDirs: string[]): string | undefined {
  const candidates = quoted ? [path.resolve(path.dirname(currentFile), includeName)] : [];
  candidates.push(...includeDirs.map((dir) => path.resolve(dir, includeName)));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

function findIncludes(source: string, currentFile: string, includeDirs: string[]): string[] {
  const result: string[] = [];
  const pattern = /#\s*include\s*(["<])([^">]+)[">]/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const includePath = resolveInclude(currentFile, match[2].trim(), match[1] === '"', includeDirs);
    if (includePath) result.push(includePath);
  }
  return result;
}

function writePreparedFile(
  destination: string,
  bytes: Buffer,
  sourcePath: string,
  target: PawnEncoding,
  diagnostics: EncodingDiagnostic[],
  convertedFiles: string[],
  preservedFiles: string[]
) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const mode = detectSourceEncoding(bytes, "auto");
  if (mode === "utf-8") {
    const text = decodeUtf8Strict(bytes);
    if (text === undefined) {
      fs.writeFileSync(destination, bytes);
      preservedFiles.push(sourcePath);
      return;
    }
    const encoded = encodeUtf8ToLegacy(bytes, target);
    if (encoded.failures.length > 0) {
      const failure = encoded.failures[0];
      diagnostics.push({
        filePath: sourcePath,
        encoding: target,
        message: `Character U+${failure.codePoint.toString(16).toUpperCase().padStart(4, "0")} cannot be represented in ${target}.`,
        codePoint: failure.codePoint,
        byteIndex: failure.index,
      });
      return;
    }
    fs.writeFileSync(destination, encoded.bytes);
    convertedFiles.push(sourcePath);
    return;
  }
  fs.writeFileSync(destination, bytes);
  preservedFiles.push(sourcePath);
}

export function preparePawnBuild(workspacePath: string, sourcePath: string, target: PawnEncoding): PreparedPawnBuild {
  const root = path.join(workspacePath, ".pawn-encoding-build");
  const diagnostics: EncodingDiagnostic[] = [];
  const convertedFiles: string[] = [];
  const preservedFiles: string[] = [];
  const includeDirs = [
    workspacePath,
    path.join(workspacePath, "include"),
    path.join(workspacePath, "includes"),
    path.join(workspacePath, "pawno", "include"),
  ];
  fs.mkdirSync(root, { recursive: true });

  const queue: string[] = [path.resolve(sourcePath)];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const filePath = queue.shift()!;
    const normalized = path.normalize(filePath);
    if (visited.has(normalized) || !fs.existsSync(normalized) || !fs.statSync(normalized).isFile()) continue;
    visited.add(normalized);

    const bytes = fs.readFileSync(normalized);
    const destination = relativeMirrorPath(root, workspacePath, normalized);
    if (isSourceFile(normalized)) {
      writePreparedFile(destination, bytes, normalized, target, diagnostics, convertedFiles, preservedFiles);
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(normalized, destination);
    }

    if (isSourceFile(normalized)) {
      const decoded = decodeUtf8Strict(bytes);
      if (decoded !== undefined) queue.push(...findIncludes(decoded, normalized, includeDirs));
      else queue.push(...findIncludes(Buffer.from(bytes).toString("latin1"), normalized, includeDirs));
    }
  }

  return {
    root,
    sourcePath: path.join(root, path.relative(workspacePath, path.resolve(sourcePath))),
    includeDirs: includeDirs.map((dir) => path.join(root, path.relative(workspacePath, path.resolve(dir)))),
    diagnostics,
    convertedFiles,
    preservedFiles,
  };
}

export function resolveTargetEncoding(value: string | undefined): PawnEncoding {
  const normalized = (value ?? "windows-874").trim().toLowerCase();
  return TARGET_ENCODINGS[normalized] ?? "windows-874";
}
