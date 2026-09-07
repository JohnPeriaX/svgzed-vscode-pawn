import BuildTaskHandler, { runPawnBuild } from "./buildTask";
import PawnDocumentFormattingEditProvider from "./formatter";
import * as vscode from "vscode";
import { initSnippetCollector } from "./commonFunc";
import path = require("path");
import { LanguageClient, LanguageClientOptions, ServerOptions, State, TransportKind } from "vscode-languageclient/node";
import { addToPawnIgnore, InitPawnIgnore } from "./whitelistedpaths";
import PawnFoldingProvider from "./FoldingProvider";

export let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.build", runPawnBuild));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.initTask", BuildTaskHandler));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.initScanDir", InitPawnIgnore));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.pawnignore", addToPawnIgnore));
  context.subscriptions.push(vscode.commands.registerCommand("pawn-development.reloadDefs", () => initSnippetCollector(true)));

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider({ scheme: "file", language: "pawn" }, new PawnFoldingProvider())
  );

  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider("pawn", PawnDocumentFormattingEditProvider));
  context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider("pawn", PawnDocumentFormattingEditProvider));

  vscode.workspace.onDidChangeWorkspaceFolders(() => initSnippetCollector(true));
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
