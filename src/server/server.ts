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
  DocumentHighlightParams,
  DocumentHighlight,
  Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { expandPawnFormatRange, formatPawn } from "../pawnFormatter";
import { scanPawnBraces } from "../braceScanner";
import { parseSnippets, doCompletion, doCompletionResolve, doGoToDef, doHover, doSignHelp, resetAutocompletes } from "./parser";

const useStdioTransport = process.argv.includes("--stdio");
const braceScanCache = new Map<string, { version: number; scan: ReturnType<typeof scanPawnBraces> }>();
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
    documentHighlightProvider: true,
    workspace: { workspaceFolders: { supported: true } },
  },
}));

function pawnPosition(document: TextDocument, offset: number) {
  return document.positionAt(offset);
}

function braceDiagnostics(document: TextDocument): Diagnostic[] {
  const text = document.getText();
  const cached = braceScanCache.get(document.uri);
  const scan = cached && cached.version === document.version ? cached.scan : scanPawnBraces(text);
  if (!cached || cached.version !== document.version) braceScanCache.set(document.uri, { version: document.version, scan });
  return scan.unmatched.map((item) => ({
    severity: DiagnosticSeverity.Error,
    range: { start: pawnPosition(document, item.offset), end: pawnPosition(document, item.offset + 1) },
    message: item.kind === "open" ? "Unmatched { : missing closing }." : "Unmatched } : no matching opening {.",
    source: "pawn-braces",
    code: item.kind === "open" ? "missing-close-brace" : "unmatched-close-brace",
  }));
}

connection.onDocumentHighlight((params: DocumentHighlightParams): DocumentHighlight[] => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) return [];
  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const cached = braceScanCache.get(document.uri);
  const scan = cached && cached.version === document.version ? cached.scan : scanPawnBraces(text);
  if (!cached || cached.version !== document.version) braceScanCache.set(document.uri, { version: document.version, scan });
  const pair = scan.pairAt(offset === text.length ? offset - 1 : offset);
  if (!pair) return [];
  return [
    { range: { start: pawnPosition(document, pair.open), end: pawnPosition(document, pair.open + 1) } },
    { range: { start: pawnPosition(document, pair.close), end: pawnPosition(document, pair.close + 1) } },
  ];
});

function publishBraceDiagnostics(document: TextDocument) {
  void connection.sendDiagnostics({ uri: document.uri, diagnostics: braceDiagnostics(document) });
}
connection.onNotification("revalidateAllOpenedDocuments", () => {
  resetAutocompletes();
  documents.all().forEach((doc) => parseSnippets(doc));
});

connection.onDidChangeConfiguration(() => {
  documents.all().forEach((doc) => parseSnippets(doc));
});

documents.onDidOpen((change) => { braceScanCache.delete(change.document.uri); publishBraceDiagnostics(change.document); });
documents.onDidChangeContent((change) => { braceScanCache.delete(change.document.uri); parseSnippets(change.document, false); publishBraceDiagnostics(change.document); });
documents.onDidSave((change) => { parseSnippets(change.document); publishBraceDiagnostics(change.document); });

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
  const expanded = expandPawnFormatRange(document.getText(), {
    start: document.offsetAt(params.range.start),
    end: document.offsetAt(params.range.end),
  });
  const formatRange = {
    start: document.positionAt(expanded.start),
    end: document.positionAt(expanded.end),
  };
  const formatted = await formatPawn(document.getText(formatRange));
  return [TextEdit.replace(formatRange, formatted)];
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
