const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");

const server = spawn(process.execPath, [path.resolve("out/server/server.js"), "--stdio"], { stdio: ["pipe", "pipe", "pipe"] });
let buffer = Buffer.alloc(0);
const sample = "if(playerVariables[x][pBackup] != -1) {\n    if(IsPlayerConnectedEx(playerVariables[x][pBackup])) {\n        return 1;\n    }\n    else {\n        SendClientMessage(x, COLOR_GREY, \"test\");\n        DisablePlayerCheckpoint(x);\n    }\n}\n";

function send(id, method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  server.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}
function waitResponse(id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("LSP response timeout")), 10000);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"));
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString();
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) return;
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const message = JSON.parse(buffer.subarray(start, start + length).toString());
      buffer = buffer.subarray(start + length);
      if (message.id !== id) return;
      clearTimeout(timer); server.stdout.off("data", onData); resolve(message);
    };
    server.stdout.on("data", onData);
  });
}

(async () => {
  send(1, "initialize", { processId: null, rootUri: null, capabilities: {} });
  const initialized = await waitResponse(1);
  assert.equal(initialized.error, undefined);
  server.stdin.write('Content-Length: 52\r\n\r\n{"jsonrpc":"2.0","method":"initialized","params":{}}');
  const uri = "file:///format-smoke.pwn";
  server.stdin.write(`Content-Length: ${Buffer.byteLength(JSON.stringify({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri, languageId: "pawn", version: 1, text: sample } } }))}\r\n\r\n${JSON.stringify({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri, languageId: "pawn", version: 1, text: sample } } })}`);
  const start = sample.indexOf("if(IsPlayerConnectedEx");
  const end = start + sample.indexOf("return 1;") - start + "return 1;".length;
  const linesToOffset = (offset) => { const before = sample.slice(0, offset).split("\n"); return { line: before.length - 1, character: before[before.length - 1].length }; };
  send(2, "textDocument/rangeFormatting", { textDocument: { uri }, range: { start: linesToOffset(start), end: linesToOffset(end) }, options: {} });
  const response = await waitResponse(2);
  assert.equal(response.error, undefined);
  assert.equal(response.result.length, 1);
  const edit = response.result[0];
  assert.equal(edit.range.start.line, 1);
  assert.equal(edit.range.end.line, 3);
  assert.match(edit.newText, /if\s*\([^\n]+\)\s+return 1;/);
  console.log("LSP_RANGE_FORMAT_OK");
  server.kill();
})().catch((error) => { server.kill(); console.error(error); process.exitCode = 1; });
