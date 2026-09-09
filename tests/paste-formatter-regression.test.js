const assert = require("node:assert/strict");
const { test } = require("node:test");
const { formatPawn, expandPawnFormatRange } = require("../out/pawnFormatter.js");

test("comment before opening brace is never joined", async () => {
  const input = "stock Foo() // comment\n{\n    return 1;\n}\n";
  const formatted = await formatPawn(input);
  assert.match(formatted, /stock Foo\(\) \/\/ comment\n\{/);
  assert.equal((formatted.match(/\{/g) || []).length, 1);
  assert.equal((formatted.match(/\}/g) || []).length, 1);
});

test("blank line before else preserves the branch while allowing safe compaction", async () => {
  const input = "if (a) {\n    return 1;\n}\n\nelse {\n    return 2;\n}\n";
  const formatted = await formatPawn(input);
  assert.match(formatted, /if\s*\(a\)\s*\{[\s\S]*return 1;/);
  assert.match(formatted, /else\s+return 2;/);
  assert.equal((formatted.match(/\{/g) || []).length, 1);
  assert.equal((formatted.match(/\}/g) || []).length, 1);
});

test("nested block keeps outer close at outer indentation", async () => {
  const input = "if (a) {\n    if (b) {\n        foo();\n    } else {\n        bar();\n    }\n        }\n";
  const formatted = await formatPawn(input);
  const lines = formatted.trimEnd().split("\n");
  assert.equal(lines.at(-1), "}");
  assert.doesNotMatch(formatted, /\n\s{8}\}$/);
});

test("range expansion ignores braces inside comments and strings", () => {
  const input = "stock Foo() {\n    // { ignored }\n    new s[] = \"{ ignored }\";\n    if (a) {\n        return 1;\n    }\n}\n";
  const start = input.indexOf("return 1;");
  const expanded = expandPawnFormatRange(input, { start, end: start + 4 });
  assert.equal(expanded.start, input.indexOf("    if (a) {"));
  assert.equal(expanded.end, input.indexOf("\n    }", expanded.start) + "\n    }".length);
});
