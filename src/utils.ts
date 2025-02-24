import * as vscode from 'vscode';
import tinycolor from "tinycolor2";

export function showTip(log_str: string) {
  vscode.window.showInformationMessage(log_str);
}

export function getLineText(lineNumber: number): string {
   const editor = vscode.window.activeTextEditor;
    if (!editor) {
      showTip("No active text editor found");
      return '';
    }
    return editor.document.lineAt(lineNumber).text;
}

class Global {
  context!: vscode.ExtensionContext;
}

export const global = new Global();

export function setContext(context: vscode.ExtensionContext) {
  global.context = context;
}

export function dump(key: string, value: any) {
  global.context.workspaceState.update(key, value);
}

export function load(key: string) {
  return global.context.workspaceState.get(key);
}

export function registerCommand(
  command: string,
  callback: (...args: any[]) => any, thisArg?: any
) {
  global.context.subscriptions.push(
    vscode.commands.registerCommand(command, callback)
  );
}

export function registerSideBarView<T>(view: vscode.TreeView<T>) {
  global.context.subscriptions.push(view);
}

export enum FileExistsStatus {
  FileNotExist,
  LineNotExist,
  LineExist
}
export async function fileStatus(path: string, lineNumber: number):
  Promise<FileExistsStatus> {
  let status: FileExistsStatus = FileExistsStatus.FileNotExist;
  try {
    const uri = vscode.Uri.file(path);
    await vscode.workspace.fs.stat(uri);
    status = FileExistsStatus.LineNotExist;
    const contentBytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(contentBytes).toString('utf-8');
    const lines = content.split(/\r?\n/);
    if (lines.length >= lineNumber) {
      status = FileExistsStatus.LineExist;
    }
  } catch {
    return status;
  }

  return status;
}

export function svgToUri(svg: string): vscode.Uri {
  const svgData = Buffer.from(svg).toString('base64');
  return vscode.Uri.parse(`data:image/svg+xml;base64,${svgData}`);
}

export function asAbsolutePath(path: string): string {
  return global.context.asAbsolutePath(path);
}

export function isValidColor(color: string): boolean {
  return tinycolor(color).isValid();
}

export function toRgbString(color: string): string {
  return tinycolor(color).toRgbString();
}
