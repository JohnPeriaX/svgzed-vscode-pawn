const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const { encodeUtf8ToLegacy } = require("../out/encoding/codec.js");
const tables = require("../out/encoding/whatwgTables.js");

function parseIndex(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+)\s+0x([0-9A-Fa-f]+)\s/))
    .filter(Boolean)
    .map((m) => ({ byte: Number(m[1]) + 0x80, codePoint: Number.parseInt(m[2], 16) }));
}

function verifyTable(name, indexPath) {
  const table = tables[name];
  const entries = parseIndex(indexPath);
  assert.equal(Object.keys(table).length, entries.length, `${name}: table length mismatch`);
  for (const entry of entries) {
    assert.equal(table[entry.byte], entry.codePoint, `${name}: byte 0x${entry.byte.toString(16)} mismatch`);
    const input = Buffer.from(String.fromCodePoint(entry.codePoint), "utf8");
    const result = encodeUtf8ToLegacy(input, name.replace("_", "-"));
    assert.deepEqual(result.failures, [], `${name}: U+${entry.codePoint.toString(16)} unexpectedly unmapped`);
    assert.equal(result.bytes[0], entry.byte, `${name}: U+${entry.codePoint.toString(16)} encoded incorrectly`);
  }
}

test("WHATWG Windows-874 table is complete and byte-exact", () => {
  verifyTable("windows_874", "src/encoding/index-windows-874.txt");
});

test("WHATWG Windows-1251 table is complete and byte-exact", () => {
  verifyTable("windows_1251", "src/encoding/index-windows-1251.txt");
});
