import * as vscode from 'vscode';
import * as utils from './utils';
import { BookmarkController } from './bookmark-controller';

let bookmarksController: BookmarkController;
export function activate(context: vscode.ExtensionContext) {
  utils.setContext(context);
  bookmarksController = new BookmarkController();
}

export function deactivate() {
  if (bookmarksController) {
    bookmarksController.dispose();
  }
}
