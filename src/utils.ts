import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from './settings';
import tinycolor from "tinycolor2";

export function showTip(log_str: string) {
  vscode.window.showInformationMessage(log_str);
}

export async function showConfirmDialog(): Promise<boolean> {
  const str = 'Enter "yes" to confirm.';
  let result = await vscode.window.showInputBox({
    placeHolder: str,
    value: str
  });
  if (result && result.toLowerCase() === 'yes') {
    return true;
  }
  return false;
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

export function relativePath(fullPath: string): string {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders!) {
      if (fullPath.startsWith(folder.uri.fsPath)) {
        return path.relative(folder.uri.fsPath, fullPath);
      }
    }
  }
  return fullPath;
}

export function baseName(fullPath: string): string {
  return path.basename(fullPath);
}

export function getUri(fullPath: string): vscode.Uri {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders!) {
      if (fullPath.startsWith(folder.uri.fsPath)) {
        return vscode.Uri.parse(folder.uri.scheme + "://" + folder.uri.authority +
          "/" + fullPath.replaceAll('\\', '/'));
      }
    }
  }
  return vscode.Uri.file(fullPath);
}

export enum FileExistsStatus {
  FileNotExist,
  LineNotExist,
  LineExist
}

export async function getFileLineCount(fullPath: string): Promise<number> {
  try {
    const uri = getUri(fullPath);
    const contentBytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(contentBytes).toString('utf-8');
    return content.split(/\r?\n/).length;
  } catch (e) {
    // File not exist
    return -1;
  }
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

export function getVersion(): string {
  return global.context.extension.packageJSON.version;
}