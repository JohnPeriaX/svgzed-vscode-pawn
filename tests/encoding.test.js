const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const {
  decodeUtf8Strict,
  encodeUtf8ToLegacy,
  encodeUtf8PawnLiteralsToEscapes,
} = require("../out/encoding/codec.js");
const { preparePawnBuild } = require("../out/encoding/pawnEncoding.js");

test("WHATWG Windows-874 maps Thai and punctuation exactly", () => {
  const input = Buffer.from("สวัสดี ฿๐๙ €…‘’“”•–—", "utf8");
  const result = encodeUtf8ToLegacy(input, "windows-874");
  assert.deepEqual(result.failures, []);
  assert.equal(result.bytes.toString("hex"), "cac7d1cab4d520dff0f920808591929394959697");
});

test("WHATWG Windows-1251 maps Russian and Ukrainian Cyrillic", () => {
  const input = Buffer.from("Привіт ЄЇІґ", "utf8");
  const result = encodeUtf8ToLegacy(input, "windows-1251");
  assert.deepEqual(result.failures, []);
  assert.equal(result.bytes.toString("hex"), "cff0e8e2b3f220aaafb2b4");
});

test("invalid UTF-8 is rejected by strict decoder", () => {
  assert.equal(decodeUtf8Strict(Buffer.from([0xe0, 0x80, 0x80])), undefined);
  assert.equal(decodeUtf8Strict(Buffer.from([0xed, 0xa0, 0x80])), undefined);
});

test("unrepresentable Unicode produces a build diagnostic", () => {
  const input = Buffer.from('new text[] = "สวัสดี 😊";\n', "utf8");
  const result = encodeUtf8ToLegacy(input, "windows-874");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].codePoint, 0x1f60a);
});

test("legacy CP874 source is preserved byte-for-byte", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pawn-encoding-"));
  try {
    fs.mkdirSync(path.join(root, "gamemodes"), { recursive: true });
    const source = path.join(root, "gamemodes", "main.pwn");
    const legacy = Buffer.from([0x6e, 0x65, 0x77, 0x20, 0x6d, 0x73, 0x67, 0x5b, 0x5d, 0x20, 0x3d, 0x20, 0x22, 0xca, 0xc7, 0xd1, 0xca, 0xb4, 0xd5, 0x22, 0x3b, 0x0a]);
    fs.writeFileSync(source, legacy);
    const prepared = preparePawnBuild(root, source, "windows-874");
    assert.deepEqual(fs.readFileSync(path.join(prepared.root, "gamemodes", "main.pwn")), legacy);
    assert.equal(prepared.convertedFiles.length, 0);
    assert.equal(prepared.preservedFiles.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("UTF-8 Pawn literals become compiler byte escapes in the build mirror", () => {
  const result = encodeUtf8PawnLiteralsToEscapes('new msg[] = "สวัสดี";\n', "windows-874");
  assert.deepEqual(result.failures, []);
  assert.equal(result.text, 'new msg[] = "\\xCA;\\xC7;\\xD1;\\xCA;\\xB4;\\xD5;";\n');
  assert.equal(result.convertedCharacters, 6);
});

test("UTF-8 source is converted only in the build mirror", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pawn-encoding-"));
  try {
    fs.mkdirSync(path.join(root, "gamemodes"), { recursive: true });
    const source = path.join(root, "gamemodes", "main.pwn");
    const original = Buffer.from('new msg[] = "สวัสดี";\n', "utf8");
    fs.writeFileSync(source, original);
    const prepared = preparePawnBuild(root, source, "windows-874");
    const mirrored = fs.readFileSync(path.join(prepared.root, "gamemodes", "main.pwn"));
    assert.deepEqual(fs.readFileSync(source), original);
    assert.equal(mirrored.includes(0xe0), false);
    assert.equal(mirrored.toString("utf8"), 'new msg[] = "\\xCA;\\xC7;\\xD1;\\xCA;\\xB4;\\xD5;";\n');
    assert.equal(prepared.convertedFiles.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
