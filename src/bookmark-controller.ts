import * as vscode from 'vscode';
import * as utils from './utils';
import * as icons from './icons';
import { BookmarkItem, BookmarkModel } from "./bookmark-model";
import { BookmarkTreeView } from "./bookmark-view";

interface DoubleClickContext {
  key: string;
  timestamp: number;
}

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
    utils.registerCommand('ddbookmark.jumpTo', (i) => this.jumpTo(i));
    utils.registerCommand('ddbookmark.addFolder', (i) => this.addFolder(i));
    utils.registerCommand('ddbookmark.addFolderWithNoParent',
      () => this.addFolder());
    utils.registerCommand('ddbookmark.clearAll', () => this.clearAll());
    utils.registerCommand('ddbookmark.rename', (i) => this.rename(i));
    utils.registerCommand('ddbookmark.delete', (i) => this.delete(i));
    utils.registerCommand('ddbookmark.setGutterIconColor',
      (i) => this.setGutterIconColor());

    this.lazyRetrieveBookmarkStatus();
    this.updateLineDecoration();
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

    const filePath = editor.document.fileName;
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

  doubleClickContext: DoubleClickContext = { key: '', timestamp: 0 };
  doubleClick(bookmark: BookmarkItem): boolean {
    if (!bookmark) {
      this.doubleClickContext.key = '';
      this.doubleClickContext.timestamp = 0;
      return false;
    }

    if (this.doubleClickContext.key !== bookmark.key()) {
      this.doubleClickContext.key = bookmark.key();
      this.doubleClickContext.timestamp = Date.now();
      return false;
    }

    let now = Date.now();
    if (now - this.doubleClickContext.timestamp < 300) {
      this.doubleClickContext.key = '';
      this.doubleClickContext.timestamp = 0;
      return true;
    }

    this.doubleClickContext.timestamp = now;
    return false;
  }

  private async jumpTo(bookmark: BookmarkItem) {
    if (!this.doubleClick(bookmark)) {
      return;
    }

    if (bookmark.isFolder) {
      return;
    }

    let path = vscode.Uri.file(bookmark.filePath!);
    if (bookmark.filePath!.startsWith("Untitled")) {
      path = vscode.Uri.parse("untitled:" + bookmark.filePath);
    }

    vscode.window.showTextDocument(path, {
      preview: false,
      preserveFocus: false
    }).then(textEditor => {
        try {
          let lineNumber = bookmark.lineNumber!;
          if (textEditor.document.lineCount < lineNumber) {
            utils.showTip("Error: Line number is out of range.");
            lineNumber = 1;
          }
          let range = new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0);
          textEditor.selection = new vscode.Selection(range.start, range.start);
          textEditor.revealRange(range);
        } catch (e) {
          utils.showTip("Error: Failed to navigate to bookmark: " + e);
          return;
        }
      },
      reject => {
        utils.showTip(
          "Error: Failed to navigate to bookmark: open the file failure.");
      }
    );
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

  public clearAll() {
    this.model.clear();
    this.view.refresh();
    this.updateLineDecoration();
    this.model.saveLazy();
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
          editor.document.fileName !== bookmark.filePath ||
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

  public onDidRenameFiles(e: vscode.FileRenameEvent) {
    e.files.forEach(async f => {
      this.model.onFileRenamed(f.oldUri.fsPath, f.newUri.fsPath);
      const lineCount = await utils.getFileLineCount(f.newUri.fsPath);
      this.OnFileChanged(f.newUri.fsPath, lineCount);
    });
  }

  public onDidCreateFiles(e: vscode.FileCreateEvent) {
    e.files.forEach(async file => {
      const lineCount = await utils.getFileLineCount(file.fsPath);
      this.OnFileChanged(file.fsPath, lineCount);
    });
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

  public async lazyRetrieveBookmarkStatus() {
    await this.model.retrieveBookmarkStatus();
    this.view.refresh();
    this.model.saveLazy();
  }
}