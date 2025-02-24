import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from './settings';
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
  settings = new settings.Settings();
}

export const global = new Global();

export function setContext(context: vscode.ExtensionContext) {
  global.context = context;
}

export function getSettings(): settings.Settings {
  return global.settings;
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

export function unRegisterSideBarView<T>(view: vscode.TreeView<T>) {
  const index = global.context.subscriptions.indexOf(view);
  if (index !== -1) {
    global.context.subscriptions.splice(index, 1);
  }
  view.dispose();
}

export async function getFileLineCount(fullPath: string): Promise<number> {
  try {
    const uri = vscode.Uri.file(fullPath);
    await vscode.workspace.fs.stat(uri);
    const contentBytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(contentBytes).toString('utf-8');
    return content.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

export enum FileExistsStatus {
  FileNotExist,
  LineNotExist,
  LineExist
}
export async function fileStatus(fullPath: string, lineNumber: number):
  Promise<FileExistsStatus> {
  let status: FileExistsStatus = FileExistsStatus.FileNotExist;
  try {
    const uri = vscode.Uri.file(fullPath);
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

export function asAbsolutePath(fullPath: string): string {
  return global.context.asAbsolutePath(fullPath);
}

export function isValidColor(color: string): boolean {
  return tinycolor(color).isValid();
}

export function toRgbString(color: string): string {
  return tinycolor(color).toRgbString();
}

export function relativePath(fullPath: string): string {
  return vscode.workspace.asRelativePath(fullPath);
}

export function baseName(fullPath: string): string {
  return path.basename(fullPath);
}

export function getVersion(): string {
  return global.context.extension.packageJSON.version;
}