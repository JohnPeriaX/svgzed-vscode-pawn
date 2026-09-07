import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  CompletionItem,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  Hover,
  DefinitionParams,
  SignatureHelpParams,
  SignatureHelp,
  CompletionParams,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  TextEdit,
} from "vscode-languageserver/node";

import { format } from "astyle";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseSnippets, doCompletion, doCompletionResolve, doGoToDef, doHover, doSignHelp, resetAutocompletes } from "./parser";

export const connection = createConnection(ProposedFeatures.all);
export const documents = new TextDocuments(TextDocument);
documents.listen(connection);
connection.listen();

const formatPawn = async (content: string) => {
  const beforeFix = [
    [/\f|\v|\t*(new|static|const)\s*\n\s*((.|\s)*?)\s*;/gm, "$1 $2;"],
    [/case\s*(\S*)\s*:\s*(\w+\s*.*;)/gm, "case $1pawnd_switch_case_signle_line$2"],
    [/([^\s:]):([^\s:])(?=(?:[^"]*"[^"]*")*[^"]*$)/gm, "$1pawnd_tag_semicolon$2"],
    [/([^\s:])::([^\s:])(?=(?:[^"]*"[^"]*")*[^"]*$)/gm, "$1pawnd_tag_two_semicolon$2"],
    [/([^\s:])@([^\s:])(?=(?:[^"]*"[^"]*")*[^"]*$)/gm, "$1pawnd_tag_at$2"],
  ] as const;
  for (const [expr, replacement] of beforeFix) content = content.replace(expr, replacement);

  content = await format(content, [
    "--style=allman", "--indent-switches", "--indent-preproc-define",
    "--indent-col1-comments", "--indent-preproc-block", "--indent-after-parens",
    "--pad-comma", "--pad-oper", "--unpad-paren", "--pad-header", "--attach-return-type",
  ].join(" "));

  const afterFix = [
    [/case(.*)pawnd_switch_case_signle_line/gm, "case$1: "],
    [/pawnd_tag_semicolon/gm, ":"],
    [/pawnd_tag_two_semicolon/gm, "::"],
    [/pawnd_tag_at/gm, "@"],
    [/static(\s+)const/gm, "static const"],
    [/\.\s\./gm, ".."],
  ] as const;
  for (const [expr, replacement] of afterFix) content = content.replace(expr, replacement);
  return content;
};

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: { resolveProvider: true },
    definitionProvider: true,
    hoverProvider: true,
    signatureHelpProvider: { triggerCharacters: ["(", ","] },
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    workspace: { workspaceFolders: { supported: true } },
  },
}));

connection.onNotification("revalidateAllOpenedDocuments", () => {
  resetAutocompletes();
  documents.all().forEach((doc) => parseSnippets(doc));
});

connection.onDidChangeConfiguration(() => {
  documents.all().forEach((doc) => parseSnippets(doc));
});

documents.onDidChangeContent((change) => parseSnippets(change.document, false));
documents.onDidSave((change) => parseSnippets(change.document));

connection.onDefinition((params: DefinitionParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (doc === undefined) return;
  return doGoToDef(doc, params.position);
});

connection.onHover((params: TextDocumentPositionParams): Hover | undefined => {
  const doc = documents.get(params.textDocument.uri);
  if (doc === undefined) return;
  return doHover(doc, params.position);
});

connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | undefined => {
  const doc = documents.get(params.textDocument.uri);
  if (doc === undefined) return;
  return doSignHelp(doc, params.position);
});

connection.onCompletion(async (params: CompletionParams) => {
  const completionItems = await doCompletion(params);
  if (completionItems === undefined) return undefined;
  return { isIncomplete: false, items: completionItems };
});

connection.onCompletionResolve(async (item: CompletionItem): Promise<CompletionItem> => {
  return await doCompletionResolve(item);
});

connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) return [];
  const formatted = await formatPawn(document.getText());
  return [TextEdit.replace({ start: { line: 0, character: 0 }, end: document.positionAt(document.getText().length) }, formatted)];
});

connection.onDocumentRangeFormatting(async (params: DocumentRangeFormattingParams): Promise<TextEdit[]> => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) return [];
  const text = document.getText(params.range);
  const formatted = await formatPawn(text);
  return [TextEdit.replace(params.range, formatted)];
});
