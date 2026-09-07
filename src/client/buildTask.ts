import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { task } from "./task";

const noWorkSpaceError = "You can use this command inside a workspace only.";
const BUILD_TOOL_SETTING = "pawn.build.tool";
type BuildTool = "auto" | "sampctl" | "pawno" | "custom";

interface DetectedTools {
  pawnJson: string | undefined;
  pawnoDir: string | undefined;
  pawncc: string | undefined;
  pawndisasm: string | undefined;
  pawnc: string | undefined;
  customTasks: vscode.Task[];
}

interface BuildCandidate {
  tool: BuildTool;
  label: string;
  description: string;
}

const getWorkspaceFolder = async (): Promise<vscode.WorkspaceFolder | undefined> => {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    await vscode.window.showInformationMessage(noWorkSpaceError);
    return undefined;
  }
  if (folders.length === 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick();
};

const scanTools = async (workspacePath: string): Promise<DetectedTools> => {
  const pawnoDir = path.join(workspacePath, "pawno");
  const pawnJson = path.join(workspacePath, "pawn.json");
  const pawncc = path.join(pawnoDir, "pawncc.exe");
  const pawndisasm = path.join(pawnoDir, "pawndisasm.exe");
  const pawnc = path.join(pawnoDir, "pawnc.dll");

  let customTasks: vscode.Task[] = [];
  const customTasksPath = path.join(workspacePath, ".vscode", "tasks.json");
  if (fs.existsSync(customTasksPath)) {
    try {
      const tasks = await vscode.tasks.fetchTasks();
      customTasks = tasks.filter((item) => item.source === "Workspace" || item.source === "tasks.json" || String(item.source).includes(".vscode"));
    } catch {
      customTasks = [];
    }
  }

  return {
    pawnJson: fs.existsSync(pawnJson) ? pawnJson : undefined,
    pawnoDir: fs.existsSync(pawnoDir) ? pawnoDir : undefined,
    pawncc: fs.existsSync(pawncc) ? pawncc : undefined,
    pawndisasm: fs.existsSync(pawndisasm) ? pawndisasm : undefined,
    pawnc: fs.existsSync(pawnc) ? pawnc : undefined,
    customTasks,
  };
};
const getConfiguredTool = (): BuildTool => {
  const value = vscode.workspace.getConfiguration().get<string>(BUILD_TOOL_SETTING, "auto");
  if (value === "sampctl" || value === "pawno" || value === "custom") return value;
  return "auto";
};

const setConfiguredTool = async (tool: BuildTool): Promise<void> => {
  await vscode.workspace.getConfiguration().update(BUILD_TOOL_SETTING, tool, vscode.ConfigurationTarget.Workspace);
};

const hasPawnoToolset = (tools: DetectedTools): boolean =>
  Boolean(tools.pawnoDir && tools.pawncc && tools.pawndisasm && tools.pawnc);

const getCandidates = (tools: DetectedTools): BuildCandidate[] => {
  const candidates: BuildCandidate[] = [];
  if (tools.pawnJson) {
    candidates.push({ tool: "sampctl", label: "Sampctl", description: "pawn.json detected • sampctl build" });
  }
  if (hasPawnoToolset(tools)) {
    candidates.push({ tool: "pawno", label: "Pawno / PawnCC", description: "pawno\\pawncc.exe + pawndisasm.exe + pawnc.dll detected" });
  }
  if (tools.customTasks.length > 0) {
    candidates.push({ tool: "custom", label: "Custom (.vscode)", description: `${tools.customTasks.length} workspace task(s) available` });
  }
  return candidates;
};

const chooseCustomTask = async (tools: DetectedTools): Promise<vscode.Task | undefined> => {
  const candidates = tools.customTasks.filter((item) =>
    item.source && item.definition && item.scope &&
    (item.group === vscode.TaskGroup.Build || item.name.toLowerCase().includes("build"))
  );
  const list = candidates.length > 0 ? candidates : tools.customTasks;
  if (list.length === 0) {
    await vscode.window.showWarningMessage("No custom tasks were found in .vscode/tasks.json.");
    return undefined;
  }
  const selected = await vscode.window.showQuickPick(
    list.map((item) => ({ label: item.name, description: item.source ? `Source: ${item.source}` : undefined, task: item })),
    { placeHolder: "Select a custom build task from .vscode/tasks.json" }
  );
  return selected?.task;
};

const waitForTaskProcess = (execution: vscode.TaskExecution): Promise<number | undefined> =>
  new Promise((resolve) => {
    const subscription = vscode.tasks.onDidEndTaskProcess((event) => {
      if (event.execution === execution) {
        subscription.dispose();
        resolve(event.exitCode);
      }
    });
  });

const runTaskAndWait = async (buildTask: vscode.Task): Promise<number | undefined> => {
  let execution: vscode.TaskExecution | undefined;
  const exitPromise = new Promise<number | undefined>((resolve) => {
    const subscription = vscode.tasks.onDidEndTaskProcess((event) => {
      if (execution && event.execution === execution) {
        subscription.dispose();
        resolve(event.exitCode);
      }
    });
    void vscode.tasks.executeTask(buildTask).then((result) => {
      execution = result;
    }, () => {
      subscription.dispose();
      resolve(undefined);
    });
  });
  return exitPromise;
};

const makeShellTask = (
  folder: vscode.WorkspaceFolder,
  label: string,
  command: string,
  args: string[],
  cwd: string,
  problemMatcher: string[] = []
): vscode.Task => {
  const execution = new vscode.ShellExecution(command, args, { cwd });
  const buildTask = new vscode.Task(
    { type: "pawn", task: label },
    folder,
    label,
    "Pawn Development",
    execution,
    problemMatcher
  );
  buildTask.group = vscode.TaskGroup.Build;
  buildTask.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: false,
  };
  return buildTask;
};

const buildWithSampctl = async (folder: vscode.WorkspaceFolder): Promise<number | undefined> => {
  const buildTask = makeShellTask(folder, "Pawn: Build (sampctl)", "sampctl", ["build"], folder.uri.fsPath);
  return runTaskAndWait(buildTask);
};

const buildWithPawncc = async (folder: vscode.WorkspaceFolder, tools: DetectedTools, document: vscode.TextDocument): Promise<number | undefined> => {
  if (!tools.pawncc || !tools.pawnoDir) return undefined;
  const workspacePath = folder.uri.fsPath;
  const gamemodeDir = path.join(workspacePath, "gamemodes");
  const sourcePath = document.fileName;
  const outputBase = path.join(gamemodeDir, `${path.basename(sourcePath, path.extname(sourcePath))}.amx`);
  const args = [
    sourcePath,
    `-D${gamemodeDir}`,
    `-i${path.join(tools.pawnoDir, "include")}`,
    `-o${outputBase}`,
    "-;+",
    "-(+",
    "-v2",
  ];
  const buildTask = makeShellTask(folder, "Pawn: Build (Pawno / PawnCC)", tools.pawncc, args, tools.pawnoDir, ["$pawncc"]);
  return runTaskAndWait(buildTask);
};
export const runPawnBuild = async function () {
  const folder = await getWorkspaceFolder();
  if (!folder) return;

  const currentFile = vscode.window.activeTextEditor?.document;
  if (!currentFile) {
    await vscode.window.showInformationMessage("Open a Pawn source file before building.");
    return;
  }

  const workspacePath = folder.uri.fsPath;
  const tools = await scanTools(workspacePath);
  const detected = getCandidates(tools);
  const configured = getConfiguredTool();

  let selectedTool: BuildTool = configured;
  let customTask: vscode.Task | undefined;

  const configuredAvailable =
    (configured === "sampctl" && Boolean(tools.pawnJson)) ||
    (configured === "pawno" && hasPawnoToolset(tools)) ||
    (configured === "custom" && tools.customTasks.length > 0);

  if (configured === "auto" || !configuredAvailable) {
    if (configured !== "auto" && !configuredAvailable) {
      await vscode.window.showInformationMessage("The saved Pawn build tool is no longer available. Returning to Auto selection.");
    }

    if (detected.length === 0) {
      await vscode.window.showErrorMessage(
        "No Pawn build tool was detected. Add pawn.json, install a Pawno toolset, or configure a custom task in .vscode/tasks.json."
      );
      return;
    }

    if (detected.length === 1) {
      selectedTool = detected[0].tool;
    } else {
      const selected = await vscode.window.showQuickPick(detected, {
        placeHolder: "Select how to build this Pawn project",
        title: "Pawn Build",
      });
      if (!selected) return;
      selectedTool = selected.tool;
    }
  }

  if (selectedTool === "custom") {
    customTask = await chooseCustomTask(tools);
    if (!customTask) return;
  }

  let exitCode: number | undefined;
  if (selectedTool === "sampctl") {
    exitCode = await buildWithSampctl(folder);
  } else if (selectedTool === "pawno") {
    exitCode = await buildWithPawncc(folder, tools, currentFile);
  } else if (selectedTool === "custom" && customTask) {
    exitCode = await runTaskAndWait(customTask);
  }

  if (exitCode === 0 && configured === "auto") {
    const choice = await vscode.window.showInformationMessage(
      `Build succeeded with ${selectedTool === "pawno" ? "Pawno / PawnCC" : selectedTool === "sampctl" ? "sampctl" : "Custom"}. Set it as the default for this workspace?`,
      "Set as Default",
      "Keep Auto"
    );
    if (choice === "Set as Default") {
      await setConfiguredTool(selectedTool);
    }
  }
};

export const selectPawnBuildTool = async function () {
  const folder = await getWorkspaceFolder();
  if (!folder) return;
  const tools = await scanTools(folder.uri.fsPath);
  const candidates: BuildCandidate[] = [
    { tool: "auto", label: "Auto", description: "Detect pawn.json, Pawno, and .vscode custom tasks" },
    ...getCandidates(tools),
  ];
  const current = getConfiguredTool();
  const selected = await vscode.window.showQuickPick(
    candidates.map((item) => ({
      ...item,
      description: `${item.tool === current ? "Current • " : ""}${item.description}`,
    })),
    { placeHolder: "Select the default Pawn build tool for this workspace" }
  );
  if (!selected) return;
  await setConfiguredTool(selected.tool);
  await vscode.window.showInformationMessage(`Pawn build tool set to ${selected.label}.`);
};

export const resetPawnBuildTool = async function () {
  await setConfiguredTool("auto");
  await vscode.window.showInformationMessage("Pawn build tool reset to Auto.");
};

const BuildTaskHandler = async function () {
  const folder = await getWorkspaceFolder();
  if (!folder) return;
  const vscodePath = path.join(folder.uri.fsPath, ".vscode");
  if (!fs.existsSync(vscodePath)) fs.mkdirSync(vscodePath);
  const tasksPath = path.join(vscodePath, "tasks.json");
  if (!fs.existsSync(tasksPath)) fs.writeFileSync(tasksPath, task);
  const document = await vscode.workspace.openTextDocument(tasksPath);
  await vscode.window.showTextDocument(document, 1, false);
};

export default BuildTaskHandler;
