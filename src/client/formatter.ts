import * as vscode from "vscode";
import { expandPawnFormatRange, formatPawn, PawnBraceStyle } from "../pawnFormatter";

export function getBraceStyle(): PawnBraceStyle {
  const value = vscode.workspace.getConfiguration().get<PawnBraceStyle>("pawn.language.brace_style", "K&R");
  return value === "K&R" || value === "Stroustrup" || value === "Google" || value === "Allman" ? value : "K&R";
}

const PawnDocumentFormattingEditProvider = {
  async provideDocumentFormattingEdits(document: vscode.TextDocument) {
    const content = await formatPawn(document.getText(), getBraceStyle());
    const range = new vscode.Range(
      new vscode.Position(0, 0),
      document.lineAt(document.lineCount - 1).range.end
    );
    return [new vscode.TextEdit(range, content)];
  },

  async provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range) {
    const expanded = expandPawnFormatRange(document.getText(), {
      start: document.offsetAt(range.start),
      end: document.offsetAt(range.end),
    });
    const formatRange = new vscode.Range(document.positionAt(expanded.start), document.positionAt(expanded.end));
    const content = await formatPawn(document.getText(formatRange), getBraceStyle());
    return [new vscode.TextEdit(formatRange, content)];
  },
};

export default PawnDocumentFormattingEditProvider;
