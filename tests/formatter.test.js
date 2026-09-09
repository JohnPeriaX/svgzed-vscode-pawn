const assert = require("node:assert/strict");
const { test } = require("node:test");
const { expandPawnFormatRange, formatPawn } = require("../out/pawnFormatter.js");

const sample = [
  "if(playerVariables[x][pBackup] != -1) {",
  "    if(IsPlayerConnectedEx(playerVariables[x][pBackup])) {",
  "        return 1;",
  "    }",
  "    else {",
  "        SendClientMessage(x, COLOR_GREY, \"test\");",
  "        DisablePlayerCheckpoint(x);",
  "    }",
  "}",
  "",
].join("\n");

test("compact format reduces safe single-statement blocks", async () => {
  const formatted = await formatPawn("if(playerid == INVALID_PLAYER_ID) {\n    return 0;\n}\n");
  assert.match(formatted, /if\s*\([^\n]+\)\s+return 0;/);
  assert.doesNotMatch(formatted, /return 0;\n\s*}/);
});

test("nested if/else keeps every remaining brace", async () => {
  const formatted = await formatPawn(sample);
  const opens = (formatted.match(/\{/g) || []).length;
  const closes = (formatted.match(/\}/g) || []).length;
  assert.equal(opens, 3);
  assert.equal(closes, 3);
  assert.match(formatted, /else\s*\{/);
  assert.match(formatted, /if\s*\([^\n]+\)\s*\{\s*\n\s+return 1;/);
});

test("brace indentation is normalized to the owning scope", async () => {
  const input = [
    "if(playerVariables[x][pBackup] != -1) {",
    "    if(IsPlayerConnectedEx(playerVariables[x][pBackup])) {",
    "        return 1;",
    "    }",
    "    else {",
    "        SendClientMessage(x, COLOR_GREY, \"test\");",
    "    }",
    "        }",
  ].join("\n") + "\n";
  const formatted = await formatPawn(input);
  assert.match(formatted, /\n    } else \{/);
  assert.match(formatted, /\n}\s*$/);
  assert.doesNotMatch(formatted, /\n\s{8}\}$/);
});

test("range expansion selects only the enclosing inner Pawn block", () => {
  const start = sample.indexOf("if(IsPlayerConnectedEx");
  const end = start + sample.slice(start).indexOf("return 1;") + "return 1;".length;
  const expanded = expandPawnFormatRange(sample, { start, end });
  const expectedStart = sample.indexOf("    if(IsPlayerConnectedEx");
  const expectedEnd = sample.indexOf("\n    }\n    else") + "\n    }".length;
  assert.equal(expanded.start, expectedStart);
  assert.equal(expanded.end, expectedEnd);
});

test("multiline new declarations align continuation names", async () => {
  const input = `if(playerVariables[x][pBackup] != -1) {\n    new\n        backupVehicle = GetPlayerVehicleID(playerVariables[x][pBackup]),\n        Float:backupX,\n        Float:backupY;\n}`;
  const formatted = await formatPawn(input);
  assert.match(formatted, /new backupVehicle = .*,$/m);
  assert.match(formatted, /^        Float:backupX,$/m);
  assert.match(formatted, /^        Float:backupY;$/m);
});
