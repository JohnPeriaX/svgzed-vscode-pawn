import * as vscode from "vscode";
import { scanPawnBraces, PawnBracePair } from "../braceScanner";

let matchDecoration: vscode.TextEditorDecorationType | undefined;
let errorDecoration: vscode.TextEditorDecorationType | undefined;
const scanCache = new Map<string, { version: number; scan: ReturnType<typeof scanPawnBraces> }>();

function getScan(document: vscode.TextDocument) {
  const key = document.uri.toString();
  const cached = scanCache.get(key);
  if (cached && cached.version === document.version) return cached.scan;
  const scan = scanPawnBraces(document.getText());
  scanCache.set(key, { version: document.version, scan });
  return scan;
}

function ensureDecorations() {
  matchDecoration ??= vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.wordHighlightBackground"),
    border: "1px solid",
    borderColor: new vscode.ThemeColor("editor.wordHighlightBorder"),
  });
  errorDecoration ??= vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("inputValidation.errorBackground"),
    border: "1px solid",
    borderColor: new vscode.ThemeColor("inputValidation.errorBorder"),
  });
}

function braceRange(document: vscode.TextDocument, offset: number): vscode.Range {
  const start = document.positionAt(offset);
  return new vscode.Range(start, new vscode.Position(start.line, start.character + 1));
}

function diagnosticFor(document: vscode.TextDocument, unmatched: { kind: "open" | "close"; offset: number }): vscode.Diagnostic {
  const range = braceRange(document, unmatched.offset);
  const missing = unmatched.kind === "open" ? "}" : "{";
  const message = unmatched.kind === "open"
    ? `Unmatched { at this position. Expected closing }.`
    : `Unmatched } at this position. No matching { was found.`;
  const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
  diagnostic.code = `pawn-brace-missing-${missing}`;
  return diagnostic;
}

export function registerPawnBraceMatching(context: vscode.ExtensionContext): vscode.Disposable {
  ensureDecorations();
  const diagnostics = vscode.languages.createDiagnosticCollection("pawn-braces");
  const refresh = (editor: vscode.TextEditor | undefined, updateDiagnostics = false) => {
    if (!editor || editor.document.languageId !== "pawn") return;
    const scan = getScan(editor.document);
    const offset = editor.document.offsetAt(editor.selection.active);
    const textLength = editor.document.getText().length;
    const pair = scan.pairAt(offset === textLength ? Math.max(0, offset - 1) : offset);
    const ranges = pair ? [braceRange(editor.document, pair.open), braceRange(editor.document, pair.close)] : [];
    editor.setDecorations(matchDecoration!, ranges);
    if (updateDiagnostics) {
      const errors = scan.unmatched.map((item) => braceRange(editor.document, item.offset));
      editor.setDecorations(errorDecoration!, errors);
      diagnostics.set(editor.document.uri, scan.unmatched.map((item) => diagnosticFor(editor.document, item)));
    }
  };

  const disposables = [
    diagnostics,
    vscode.window.onDidChangeActiveTextEditor((editor) => refresh(editor, true)),
    vscode.window.onDidChangeTextEditorSelection((event) => refresh(event.textEditor)),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "pawn") {
        scanCache.delete(event.document.uri.toString());
        refresh(vscode.window.visibleTextEditors.find((e) => e.document === event.document), true);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.languageId === "pawn") {
        scanCache.delete(document.uri.toString());
        diagnostics.delete(document.uri);
      }
    }),
    matchDecoration!,
    errorDecoration!,
  ];
  refresh(vscode.window.activeTextEditor, true);
  return vscode.Disposable.from(...disposables);
}

export function findPawnBracePair(text: string, offset: number): PawnBracePair | undefined {
  return scanPawnBraces(text).pairAt(offset);
}
