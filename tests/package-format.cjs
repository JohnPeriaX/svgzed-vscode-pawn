const assert = require("node:assert/strict");
const { formatPawn } = require("../out/pawnFormatter.js");

(async () => {
  const input = `if (a) {\n    if (b) {\n        foo();\n    }\n\n    else {\n        bar();\n    }\n}\n`;
  const output = await formatPawn(input);
  assert.equal((output.match(/\{/g) || []).length, 2);
  assert.equal((output.match(/\}/g) || []).length, 2);
  assert.match(output, /else\s+bar\(\);/);

  const comment = await formatPawn("stock Foo() // keep comment\n{\n    return 1;\n}\n");
  assert.match(comment, /stock Foo\(\) \/\/ keep comment\n\{/);

  console.log("PACKAGE_FORMAT_OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
