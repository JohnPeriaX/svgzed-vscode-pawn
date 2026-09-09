import * as vscode from "vscode";
import { formatPawn, PawnBraceStyle } from "../pawnFormatter";

function getBraceStyle(): PawnBraceStyle {
  const value = vscode.workspace.getConfiguration().get<PawnBraceStyle>("pawn.language.brace_style", "Allman");
  return value === "K&R" || value === "Stroustrup" || value === "Google" ? value : "Allman";
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
    const content = await formatPawn(document.getText(range), getBraceStyle());
    return [new vscode.TextEdit(range, content)];
  },
};

export default PawnDocumentFormattingEditProvider;
