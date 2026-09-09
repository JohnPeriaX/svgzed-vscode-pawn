const fs = require("node:fs");
const assert = require("node:assert/strict");
const { formatPawn } = require("../out/pawnFormatter.js");

(async () => {
  const file = process.env.PAWN_CUSTOMER_FILE;
  if (!file) {
    console.log("CUSTOMER_FORMAT_GATE_SKIPPED (set PAWN_CUSTOMER_FILE)");
    return;
  }
  const input = fs.readFileSync(file, "utf8");
  const output = await formatPawn(input);
  const opens = (output.match(/\{/g) || []).length;
  const closes = (output.match(/\}/g) || []).length;
  assert.equal(opens, closes, `brace mismatch ${opens}/${closes}`);
  assert.doesNotMatch(output, /\/\/[^\n]*\{\s*\n/);
  assert.match(output, /if\s*\(playerVariables\[playerid\]\[pStatus\]/);
  console.log(`CUSTOMER_FORMAT_GATE_OK ${input.length}->${output.length} braces=${opens}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
