import * as vscode from "vscode";
import * as fs from "fs";
import { task } from "./task";

const noWorkSpaceError = "you can use this command inside your workspace only";

export const runPawnBuild = async function () {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    await vscode.window.showInformationMessage(noWorkSpaceError);
    return;
  }

  let workspacePath: string | undefined;
  if (folders.length === 1) workspacePath = folders[0].uri.fsPath;
  else workspacePath = (await vscode.window.showWorkspaceFolderPick())?.uri.fsPath;
  if (!workspacePath) return;

  const pawnJsonPath = workspacePath + "/pawn.json";
  const currentFile = vscode.window.activeTextEditor?.document;
  if (!currentFile) {
    await vscode.window.showInformationMessage("Open a Pawn source file before building.");
    return;
  }

  const command = fs.existsSync(pawnJsonPath) ? "sampctl" : "pawncc";
  const args = command === "sampctl"
    ? ["build"]
    : [currentFile.fileName, "-Dgamemodes", "-;+"];

  const execution = new vscode.ShellExecution(command, args, { cwd: workspacePath });
  const buildTask = new vscode.Task(
    { type: "pawn", task: "build" },
    folders.find((folder) => folder.uri.fsPath === workspacePath) || folders[0],
    "Pawn: Build",
    "Pawn Development",
    execution,
    command === "pawncc" ? ["$pawncc"] : []
  );
  buildTask.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: false,
  };
  await vscode.tasks.executeTask(buildTask);
};

const BuildTaskHandler = async function () {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return vscode.window.showInformationMessage(noWorkSpaceError);
  const workspacePath = folders.length === 1
    ? folders[0].uri.fsPath
    : (await vscode.window.showWorkspaceFolderPick())?.uri.fsPath;
  if (!workspacePath) return;

  const vscodePath = workspacePath + "/.vscode";
  if (!fs.existsSync(vscodePath)) fs.mkdirSync(vscodePath);

  const tasksPath = vscodePath + "/tasks.json";
  if (!fs.existsSync(tasksPath)) fs.writeFileSync(tasksPath, task);

  const document = await vscode.workspace.openTextDocument(tasksPath);
  await vscode.window.showTextDocument(document, 1, false);
};

export default BuildTaskHandler;
