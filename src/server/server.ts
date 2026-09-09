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
  DocumentColorParams,
  ColorInformation,
  TextEdit,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { formatPawn } from "../pawnFormatter";
import { parseSnippets, doCompletion, doCompletionResolve, doGoToDef, doHover, doSignHelp, resetAutocompletes } from "./parser";

const useStdioTransport = process.argv.includes("--stdio");
export const connection = useStdioTransport
  ? createConnection(ProposedFeatures.all, process.stdin, process.stdout)
  : createConnection(ProposedFeatures.all);
export const documents = new TextDocuments(TextDocument);
documents.listen(connection);
connection.listen();

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Full,
    completionProvider: { resolveProvider: true },
    definitionProvider: true,
    hoverProvider: true,
    signatureHelpProvider: { triggerCharacters: ["(", ","] },
    documentFormattingProvider: true,
    documentRangeFormattingProvider: true,
    colorProvider: true,
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

const SAMP_COLOR_PATTERN = /(?:\{([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\}|\b0[xX]([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b)/g;

connection.onDocumentColor(async (params: DocumentColorParams): Promise<ColorInformation[]> => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) return [];

  const colors: ColorInformation[] = [];
  const lines = document.getText().split(/\r?\n/);
  for (let line = 0; line < lines.length; line++) {
    const text = lines[line];
    SAMP_COLOR_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SAMP_COLOR_PATTERN.exec(text)) !== null) {
      const hex = match[1] ?? match[2];
      const red = parseInt(hex.slice(0, 2), 16) / 255;
      const green = parseInt(hex.slice(2, 4), 16) / 255;
      const blue = parseInt(hex.slice(4, 6), 16) / 255;
      const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      colors.push({
        range: {
          start: { line, character: match.index },
          end: { line, character: match.index + match[0].length },
        },
        color: { red, green, blue, alpha },
      });
    }
  }
  return colors;
});
