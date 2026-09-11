const fs = require("node:fs");
const assert = require("node:assert/strict");
const { formatPawn } = require("../out/pawnFormatter.js");
const { scanPawnBraces } = require("../out/braceScanner.js");

(async () => {
  const file = process.env.PAWN_CUSTOMER_FILE;
  if (!file) {
    console.log("CUSTOMER_FORMAT_GATE_SKIPPED (set PAWN_CUSTOMER_FILE)");
    return;
  }
  const input = fs.readFileSync(file, "utf8");
  const output = await formatPawn(input);
  const inputScan = scanPawnBraces(input);
  const outputScan = scanPawnBraces(output);
  assert.equal(outputScan.unmatched.length, 0, "formatted source has unmatched braces");
  assert.equal(outputScan.pairs.length, inputScan.pairs.length, "formatted source changed brace-pair count");
  assert.equal(outputScan.unmatched.length, inputScan.unmatched.length, "formatted source changed unmatched-brace count");
  assert.match(output, /if\s*\(playerVariables\[playerid\]\[pStatus\]/);
  console.log(`CUSTOMER_FORMAT_GATE_OK ${input.length}->${output.length} pairs=${outputScan.pairs.length}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });