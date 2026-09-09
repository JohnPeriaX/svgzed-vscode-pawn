#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const encoding = require(path.join(repoRoot, "out", "encoding", "pawnEncoding.js"));

function fail(message) {
  console.error(`[Pawn Encoding] ERROR: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const sourceArg = args[0];
if (!sourceArg) fail("usage: build-pawn-with-encoding.js <source.pwn> [pawncc options...]");

const workspaceRoot = process.env.PAWN_WORKSPACE_ROOT || process.cwd();
const sourcePath = path.resolve(workspaceRoot, sourceArg);
if (!fs.existsSync(sourcePath)) fail(`source file not found: ${sourcePath}`);

const pawncc = process.env.PAWNCC || path.join(workspaceRoot, "pawno", "pawncc.exe");
if (!fs.existsSync(pawncc)) fail(`pawncc not found: ${pawncc}`);

const target = String(process.env.PAWN_ENCODING_TARGET || "windows-874").toLowerCase();
const prepared = encoding.preparePawnBuild(workspaceRoot, sourcePath, encoding.resolveTargetEncoding(target));
if (prepared.diagnostics.length > 0) {
  for (const diagnostic of prepared.diagnostics) {
    console.error(`[Pawn Encoding] ${diagnostic.filePath}: ${diagnostic.message}`);
  }
  process.exit(2);
}

const output = process.env.PAWN_OUTPUT
  ? path.resolve(workspaceRoot, process.env.PAWN_OUTPUT)
  : path.join(workspaceRoot, "gamemodes", `${path.basename(sourcePath, path.extname(sourcePath))}.amx`);
const gamemodesDir = path.join(workspaceRoot, "gamemodes");
const includeDirs = [
  ...prepared.includeDirs.filter((dir) => fs.existsSync(dir)),
  path.join(workspaceRoot, "pawno", "include"),
];

const compilerArgs = [
  prepared.sourcePath,
  `-D${gamemodesDir}`,
  ...includeDirs.map((dir) => `-i${dir}`),
  `-o${output}`,
  "-;+",
  "-(+",
  "-v2",
  ...args.slice(1),
];

console.log(`[Pawn Encoding] source: ${path.relative(workspaceRoot, sourcePath)}`);
console.log(`[Pawn Encoding] target: ${encoding.resolveTargetEncoding(target)}`);
console.log(`[Pawn Encoding] converted files: ${prepared.convertedFiles.length}`);
console.log(`[Pawn Encoding] preserved legacy files: ${prepared.preservedFiles.length}`);

const tempRoot = path.join(workspaceRoot, "pawn-build-output");
fs.mkdirSync(tempRoot, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(tempRoot, "build-"));
const tempOutput = path.join(tempDir, "pawn_build.amx");
const tempCompilerArgs = compilerArgs.map((arg) => (arg === `-o${output}` ? `-o${tempOutput}` : arg));
let keepTemp = false;
try {
  if (fs.existsSync(tempOutput)) fs.rmSync(tempOutput, { force: true });
  const result = spawnSync(pawncc, tempCompilerArgs, {
    cwd: path.join(workspaceRoot, "pawno"),
    stdio: "inherit",
    windowsHide: false,
  });
  if (result.error) fail(result.error.message);
  const status = result.status === null ? 1 : result.status;
  if (status !== 0) {
    process.exitCode = status;
  } else if (!fs.existsSync(tempOutput)) {
    fail(`compiler reported success but output was not created: ${tempOutput}`);
  } else {
    const outputSize = fs.statSync(tempOutput).size;
    if (outputSize <= 0) fail(`compiler reported success but output is empty: ${output}`);
    fs.rmSync(output, { force: true });
    fs.renameSync(tempOutput, output);
    console.log(`[Pawn Encoding] output: ${outputSize} bytes`);
  }
} finally {
  if (!keepTemp && fs.existsSync(tempOutput)) {
    try { fs.rmSync(tempOutput, { force: true }); } catch (error) {
      console.warn(`[Pawn Encoding] warning: could not remove temp output: ${error.message}`);
    }
  }
}
