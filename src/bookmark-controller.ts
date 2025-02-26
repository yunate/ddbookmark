import * as vscode from 'vscode';
import * as utils from './utils';
import * as icons from './icons';
import { BookmarkItem, BookmarkModel } from "./bookmark-model";
import { BookmarkTreeView } from "./bookmark-view";

export class BookmarkController {
  model = new BookmarkModel();
  view = new BookmarkTreeView(this.model);

  constructor() {
    utils.getSettings().load();
    const currentVersion = utils.getSettings().version;
    if (currentVersion !== utils.getSettings().version) {
      utils.getSettings().version = currentVersion;
      utils.getSettings().saveImmediatly();

      // Maybe we can clear all bookmarks if the extension is updated.
      // But now we just load the bookmarks.
      this.model.load();
    } else {
      this.model.load();
    }
    vscode.workspace.onDidChangeTextDocument(
      (e) => this.onDidChangeTextDocument(e)
    );
    vscode.workspace.onDidRenameFiles((e) => this.onDidRenameFiles(e));
    vscode.workspace.onDidDeleteFiles((e) => this.onDidDeleteFiles(e));
    vscode.workspace.onDidCreateFiles((e) => this.onDidCreateFiles(e));
    vscode.window.onDidChangeVisibleTextEditors(
      (e) => this.onDidChangeVisibleTextEditors(e)
    );

    utils.registerSideBarView(this.view.treeView);
    utils.registerCommand('ddbookmark.toggle', () => this.toggle());
    utils.registerCommand('ddbookmark.addFolder', (i) => this.addFolder(i));
    utils.registerCommand('ddbookmark.addFolderWithNoParent',
      () => this.addFolder());
    utils.registerCommand('ddbookmark.clearAll', () => this.clearAll());
    utils.registerCommand('ddbookmark.refresh', () => this.refresh());
    utils.registerCommand('ddbookmark.rename', (i) => this.rename(i));
    utils.registerCommand('ddbookmark.delete', (i) => this.delete(i));
    utils.registerCommand('ddbookmark.setGutterIconColor',
      (i) => this.setGutterIconColor());

    this.refresh();
  }

  dispose() {
    vscode.window.visibleTextEditors.forEach(editor => {
      if(this.decorationType) {
        editor.setDecorations(this.decorationType, []);
      }
    });

    utils.unRegisterSideBarView(this.view.treeView);
  }

  public toggle() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      utils.showTip("No active text editor found");
      return;
    }

    const filePath = editor.document.fileName.toLowerCase();
    const lineNumber = editor.selection.active.line + 1;
    const item = BookmarkItem.createBookmark(filePath, lineNumber);
    if (this.model.find(item)) {
      this.model.removeBookmark(item);
    } else {
      let multipleSelected: boolean = false;
      let selectedFolder: BookmarkItem | undefined = undefined;
      this.view.selectedItems.forEach(i => {
        if (i.isFolder) {
          if (!selectedFolder) {
            selectedFolder = i;
          } else {
            multipleSelected = true;
          }
        }
      });
      if (selectedFolder && !multipleSelected) {
        item.parentFolderName = (selectedFolder as BookmarkItem).key();
      }
      this.model.addBookmark(item);
    }

    this.view.refresh();
    this.updateLineDecoration();
    this.model.saveLazy();
  }

  public addFolder(parent?: BookmarkItem) {
    vscode.window.showInputBox({
      placeHolder: 'Enter a folder name'
    }).then(name => {
      if (!name) {
        return;
      }

      name = name.trim();
      if (name.length <= 0) {
        return;
      }

      if (this.model.isFolderNameUsed(name)) {
        utils.showTip(`Folder name [${name}] already exists. Use another one!`);
        return;
      }

      this.model.addBookmark(BookmarkItem.createBookmarkFolder(name,
        parent?.key()));
      if (parent) {
        parent.isExpanded = true;
      }
      this.view.refresh();
      this.model.saveLazy();
    });
  }

  public async clearAll() {
    if (await utils.showConfirmDialog()) {
      this.model.clear();
      this.view.refresh();
      this.updateLineDecoration();
      this.model.saveLazy();
    }
  }

  public refresh() {
    this.updateLineDecoration();
    this.retrieveBookmarkStatus();
  }

  public delete(bookmark: BookmarkItem) {
    if (!bookmark) {
      return;
    }

    this.model.removeBookmark(bookmark);
    this.view.refresh();
    this.updateLineDecoration();
    this.model.saveLazy();
  }

  public rename(bookmark: BookmarkItem) {
    if (!bookmark) {
      if (this.view.selectedItems.length !== 1) {
        return;
      }
      bookmark = this.view.selectedItems[0];
    }

    vscode.window.showInputBox({
      placeHolder: 'Enter a new label',
      value: bookmark.label
    }).then(newLabel => {
      newLabel = newLabel?.trim();
      if (bookmark.isFolder && !newLabel) {
        utils.showTip(`The folder name cannot be empty!`);
        return;
      }

      if (bookmark.isFolder && this.model.isFolderNameUsed(newLabel!)) {
        utils.showTip(`[${newLabel}] already exists. Use another one!`);
        return;
      }

      if (bookmark.isFolder) {
        this.model.getDirectChildren(bookmark).forEach(i => {
          i.parentFolderName = newLabel;
        });
      }

      bookmark.label = newLabel;
      this.view.refresh();
      this.model.saveLazy();
    });
  }

  decorationType?: vscode.TextEditorDecorationType;
  public updateLineDecoration() {
    const color =  utils.getSettings().gutterColor;
    const preDecorationType = this.decorationType;
    this.decorationType = vscode.window.createTextEditorDecorationType({
      // gutterIconPath: utils.asAbsolutePath('image/bookmark-gutter.svg'),
      // backgroundColor: color,
      // isWholeLine: true,
      gutterIconPath: icons.getIconUri('lineGutter', 16, 16, color),
      gutterIconSize: 'auto',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      overviewRulerColor: color
    });

    vscode.window.visibleTextEditors.forEach(editor => {
      if (!editor) {
        return;
      }

      let ranges: vscode.Range[] = [];
      this.model.bookmarks.forEach(bookmark => {
        if (
          !BookmarkItem.isValidBookmark(bookmark) ||
          bookmark.isFolder ||
          editor.document.fileName.toLocaleLowerCase() !== bookmark.filePath ||
          editor.document.lineCount < bookmark.lineNumber!
        ) {
          return;
        }

        const lineNumber = bookmark.lineNumber! - 1;
        ranges.push(new vscode.Range(lineNumber, 0, lineNumber, 0));
      });
      if (preDecorationType) {
        editor.setDecorations(preDecorationType, []);
      }
      editor.setDecorations(this.decorationType!, ranges);
    });
  }

  public setGutterIconColor() {
    vscode.window.showInputBox({
      placeHolder: '#123456 or rgba(0, 0, 0, 1)'
    }).then(color => {
      if (!color) {
        utils.showTip('Please enter a valid color.');
        return;
      }

      color = color.trim();
      if (color.length <= 0 || !utils.isValidColor(color)) {
        utils.showTip('Please enter a valid color.');
        return;
      }

      color = utils.toRgbString(color);
      utils.getSettings().gutterColor = color;
      this.updateLineDecoration();
      utils.getSettings().saveLazy();
    });
  }

  public OnFileChanged(filePath: string, lineCount: number) {
    this.model.onFileChanged(filePath, lineCount);
    this.view.refresh();
    this.updateLineDecoration();
    this.model.saveLazy();
  }

  public onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    this.OnFileChanged(e.document.fileName, e.document.lineCount);
  }

  public async onDidRenameFiles(e: vscode.FileRenameEvent) {
    for (let i = 0; i < e.files.length; i++) {
      let f = e.files[i];
      this.model.onFileRenamed(f.oldUri.fsPath, f.newUri.fsPath);
      const lineCount = await utils.getFileLineCount(f.newUri.fsPath);
      this.OnFileChanged(f.newUri.fsPath, lineCount);
    }
  }

  public async onDidCreateFiles(e: vscode.FileCreateEvent) {
    for (let i = 0; i < e.files.length; i++) {
      let file = e.files[i];
      const lineCount = await utils.getFileLineCount(file.fsPath);
      this.OnFileChanged(file.fsPath, lineCount);
    }
  }

  public onDidDeleteFiles(e: vscode.FileDeleteEvent) {
    e.files.forEach(f => {
      this.model.onFileDelted(f.fsPath);
    });
    this.view.refresh();
    this.model.saveLazy();
  }

  public onDidChangeVisibleTextEditors(e: readonly vscode.TextEditor[]) {
    this.updateLineDecoration();
  }

  public async retrieveBookmarkStatus() {
    const needRefreshItem: BookmarkItem[] = [];
    const lineCountMap = new Map<string, number>();
    for (let i = 0; i < this.model.bookmarks.length; i++) {
      const bookmark = this.model.bookmarks[i];
      if (bookmark.isFolder) {
        continue;
      }

      let lineCount: number = -1;
      const tmp = lineCountMap.get(bookmark.filePath!);
      if (tmp) {
        lineCount = tmp;
      } else {
        lineCount = await utils.getFileLineCount(bookmark.filePath!);
        lineCountMap.set(bookmark.filePath!, lineCount);
      }

      const preState = bookmark.fileExistsStatus;
      if (lineCount === -1) {
        bookmark.fileExistsStatus = utils.FileExistsStatus.FileNotExist;
      } else if (bookmark.lineNumber! > lineCount) {
        bookmark.fileExistsStatus = utils.FileExistsStatus.LineNotExist;
      } else {
        bookmark.fileExistsStatus = utils.FileExistsStatus.LineExist;
      }

      if (preState !== bookmark.fileExistsStatus) {
        needRefreshItem.push(bookmark);
      }
    }

    this.view.refresh(needRefreshItem);
    this.model.saveLazy();
  }
}