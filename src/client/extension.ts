import BuildTaskHandler, { runPawnBuild, selectPawnBuildTool, resetPawnBuildTool } from "./buildTask";
import PawnDocumentFormattingEditProvider, { getBraceStyle } from "./formatter";
import { expandPawnFormatRange, formatPawn } from "../pawnFormatter";
import * as vscode from "vscode";
import { initSnippetCollector } from "./commonFunc";
import path = require("path");
import { LanguageClient, LanguageClientOptions, ServerOptions, State, TransportKind } from "vscode-languageclient/node";
import { addToPawnIgnore, InitPawnIgnore } from "./whitelistedpaths";
import PawnFoldingProvider from "./FoldingProvider";
import { registerPawnBraceMatching } from "./braceMatching";

const SAMP_COLOR_PATTERNS = [
  /\{([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\}/g,
  /\b0[xX]([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b/g,
];

class PawnColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
    const colors: vscode.ColorInformation[] = [];
    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line).text;
      for (const pattern of SAMP_COLOR_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          const hex = match[1];
          const rgb = hex.slice(0, 6);
          const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
          const color = new vscode.Color(
            parseInt(rgb.slice(0, 2), 16) / 255,
            parseInt(rgb.slice(2, 4), 16) / 255,
            parseInt(rgb.slice(4, 6), 16) / 255,
            alpha
          );
          const start = new vscode.Position(line, match.index);
          const end = new vscode.Position(line, match.index + match[0].length);
          colors.push(new vscode.ColorInformation(new vscode.Range(start, end), color));
        }
      }
    }
    return colors;
  }

  provideColorPresentations(color: vscode.Color): vscode.ColorPresentation[] {
    const toHex = (value: number) => Math.round(value * 255).toString(16).padStart(2, "0").toUpperCase();
    const r = toHex(color.red);
    const g = toHex(color.green);
    const b = toHex(color.blue);
    const a = toHex(color.alpha);
    const text = color.alpha < 1 ? `{${r}${g}${b}${a}}` : `{${r}${g}${b}}`;
    return [new vscode.ColorPresentation(text)];
  }
}

export let client: LanguageClient;

let applyingPasteFormat = false;

async function formatPastedPawnChange(change: vscode.TextDocumentChangeEvent) {
  if (applyingPasteFormat || change.document.languageId !== "pawn") return;
  if (!vscode.workspace.getConfiguration("pawn.format").get<boolean>("autoFormatOnPaste", true)) return;
  if (change.contentChanges.length !== 1) return;

  const edit = change.contentChanges[0];
  if (!edit.text) return;
  const looksLikeCodePaste = edit.text.includes("\n") || !edit.range.isEmpty;
  if (!looksLikeCodePaste) return;

  applyingPasteFormat = true;
  try {
    const clipboard = await vscode.env.clipboard.readText();
    if (!clipboard || clipboard !== edit.text) return;

    const start = change.document.offsetAt(edit.range.start);
    const pastedEnd = start + edit.text.length;
    const expanded = expandPawnFormatRange(change.document.getText(), { start, end: pastedEnd });
    const formatRange = new vscode.Range(change.document.positionAt(expanded.start), change.document.positionAt(expanded.end));
    const formatted = await formatPawn(change.document.getText(formatRange), getBraceStyle());
    const current = change.document.getText(formatRange);
    if (formatted === current) return;

    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.replace(change.document.uri, formatRange, formatted);
    await vscode.workspace.applyEdit(workspaceEdit);
  } finally {
    applyingPasteFormat = false;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.build", runPawnBuild));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.selectBuildTool", selectPawnBuildTool));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.resetBuildTool", resetPawnBuildTool));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.initTask", BuildTaskHandler));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.initScanDir", InitPawnIgnore));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.pawnignore", addToPawnIgnore));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.reloadDefs", () => initSnippetCollector(true)));

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider({ scheme: "file", language: "pawn" }, new PawnFoldingProvider())
  );

  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider("pawn", PawnDocumentFormattingEditProvider));
  context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider("pawn", PawnDocumentFormattingEditProvider));
  context.subscriptions.push(registerPawnBraceMatching(context));
  if (vscode.workspace.getConfiguration("pawn.language").get<boolean>("enableSampColorPicker", true)) {
    context.subscriptions.push(vscode.languages.registerColorProvider("pawn", new PawnColorProvider()));
  }

  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((change) => void formatPastedPawnChange(change)));
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => initSnippetCollector(true)));
  vscode.workspace.onDidRenameFiles(() => initSnippetCollector(true));
  vscode.workspace.onDidSaveTextDocument((e) => {
    if (path.basename(e.fileName) === ".pawnignore") initSnippetCollector(true);
  });

  const serverModule = context.asAbsolutePath(path.join("out", "server", "server.js"));
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "pawn" }],
    synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher("**/.pwn") },
  };

  client = new LanguageClient("Pawn Client", "Pawn Server", serverOptions, clientOptions);
  client.start();
  client.onDidChangeState((e) => {
    if (e.newState === State.Running) initSnippetCollector();
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}
