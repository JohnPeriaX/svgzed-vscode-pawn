const assert = require("node:assert/strict");
const { test } = require("node:test");
const { scanPawnBraces } = require("../out/braceScanner.js");

test("matches nested Pawn braces", () => {
  const text = 'if (a) {\n    if (b) {\n        return 1;\n    } else {\n        return 0;\n    }\n}\n';
  const scan = scanPawnBraces(text);
  assert.equal(scan.unmatched.length, 0);
  assert.equal(scan.pairs.length, 3);
  for (const pair of scan.pairs) {
    assert.equal(scan.pairAt(pair.open).open, pair.open);
    assert.equal(scan.pairAt(pair.close).close, pair.close);
  }
});

test("ignores braces inside strings and comments", () => {
  const text = '// { ignored }\nnew s[] = "{ not real }"; /* { ignored */\nif (a) { return 1; }\n';
  const scan = scanPawnBraces(text);
  assert.equal(scan.unmatched.length, 0);
  assert.equal(scan.pairs.length, 1);
});

test("reports missing closing and extra closing braces", () => {
  const missing = scanPawnBraces('if (a) {\n    foo();\n');
  assert.deepEqual(missing.unmatched.map((x) => x.kind), ["open"]);
  const extra = scanPawnBraces('foo();\n}\n');
  assert.deepEqual(extra.unmatched.map((x) => x.kind), ["close"]);
});

test("does not treat an apostrophe without a closing quote as a char literal", () => {
  const text = "if (a) { // don't confuse the scanner\n    foo();\n}\n";
  const scan = scanPawnBraces(text);
  assert.equal(scan.unmatched.length, 0);
  assert.equal(scan.pairs.length, 1);
});
