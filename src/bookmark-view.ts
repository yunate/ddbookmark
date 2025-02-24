import * as vscode from 'vscode';
import * as utils from './utils';
import * as icons from './icons';
import { BookmarkItem, BookmarkModel } from './bookmark-model';

type TreeDataChangedEvent = BookmarkItem | BookmarkItem[] | undefined | null | void;
export class BookmarkTreeView implements
  vscode.TreeDataProvider<BookmarkItem>,
  vscode.TreeDragAndDropController<BookmarkItem> {
  model!: BookmarkModel;
  selectedItems: BookmarkItem[] = [];
  treeView!: vscode.TreeView<BookmarkItem>;
  constructor(model: BookmarkModel) {
    this.model = model;

    this.treeView = vscode.window.createTreeView('ddbookmark-treeview', {
      treeDataProvider: this,
      dragAndDropController: this,
      canSelectMany: true
    });

    this.treeView.onDidExpandElement(event => {
      event.element.isExpanded = true;
      this.model.saveLazy();
    });
    this.treeView.onDidCollapseElement(event => {
      event.element.isExpanded = false;
      this.model.saveLazy();
    });
    this.treeView.onDidChangeSelection(event => {
      this.selectedItems = event.selection.slice();
    });
  }

  getTreeItem(bookmark: BookmarkItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(bookmark.toString());
    treeItem.description = bookmark.description();
    if (bookmark.isFolder) {
      treeItem.contextValue = 'folder';
      if (bookmark.isExpanded) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      } else {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      }
      treeItem.tooltip = vscode.workspace.asRelativePath(bookmark.toString());
      treeItem.iconPath = icons.getThemeIcon('folder');
    } else {
      treeItem.contextValue = 'bookmark';
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
      treeItem.command = {
        command: 'ddbookmark.jumpTo',
        title: 'Jump to bookmark',
        arguments: [bookmark]
      };
      let status = bookmark.fileExistsStatus;
      if (status === utils.FileExistsStatus.LineExist) {
        treeItem.iconPath = icons.getThemeIcon('file');
        treeItem.tooltip = vscode.workspace.asRelativePath(bookmark.filePath!);
      } else if (status === utils.FileExistsStatus.LineNotExist) {
        treeItem.iconPath = icons.getThemeIcon('warning');
        treeItem.tooltip = 'Line not exist';
      } else {
        treeItem.iconPath = icons.getThemeIcon('error');
        treeItem.tooltip = 'File not exist';
      }
    }
    return treeItem;
  }

  getChildren(bookmark?: BookmarkItem): BookmarkItem[] {
    let children: BookmarkItem[] = [];
    if (bookmark === undefined) {
      children = this.model.bookmarks.filter(item => {
        return !item.parentFolderName;
      });
    } else if (bookmark.isFolder) {
      children = this.model.bookmarks.filter(item =>{
        return item.parentFolderName === bookmark.key();
      });
    }

    children.sort((a, b) => {
      return BookmarkItem.compare(a, b);
    });
    return children;
  }

  // getParent(bookmark: BookmarkItem): BookmarkItem | undefined {
  //   return this.model.getParent(bookmark);
  // }

  private _onTreeDataChanged: vscode.EventEmitter<TreeDataChangedEvent>
    = new vscode.EventEmitter<TreeDataChangedEvent>();
  readonly onDidChangeTreeData: vscode.Event<TreeDataChangedEvent>
    = this._onTreeDataChanged.event;
  refreshImmediatly(): void {
    this._onTreeDataChanged.fire();
    // vscode.commands.executeCommand(
    //   'workbench.actions.treeView.ddbookmark-treeview.collapseAll');
    // this.model.bookmarks.forEach(i => {
    //   if (i.isFolder && i.isExpanded) {
    //     this.treeView.reveal(i, { expand: true });
    //   }
    // });
  }

  timeoutId?: NodeJS.Timeout;
  public refresh(doLazyWork: boolean = true) {
    if (this.timeoutId) {
      return;
    }
    this.timeoutId = setTimeout(() => {
      this.timeoutId = undefined;
      this.refreshImmediatly();
    }, 30);
  }

  // Drag and drop support
  dropMimeTypes = ['application/vnd.code.tree.ddbookmark'];
  dragMimeTypes = ['application/vnd.code.tree.ddbookmark'];
  public async handleDrop(
    target: BookmarkItem | undefined,
    sourcesData: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const sources: BookmarkItem[] =
      sourcesData.get(this.dropMimeTypes[0])!.value;
    if (!sources) {
      return;
    }

    let targetFolder = target;
    if (target && !target.isFolder) {
      // If the target is not a folder, use its parent instead.
      targetFolder = this.model.getParent(target);
    }

    if (!targetFolder) {
      sources.map((item) => item.parentFolderName = undefined);
    } else {
      const parentList = this.model.getParentList(targetFolder);
      const tmp = sources.filter(item => { return parentList.includes(item); });
      if (tmp.length > 0) {
        utils.showTip('The target cannot be the children of any source.');
        return;
      } else {
        sources.map((item) => item.parentFolderName = targetFolder.key());
      }
    }

    if (target && !target.isFolder) {
      sources.map((item) => this.model.moveBookmarkBefore(item, target));
    }
    this.refresh();
    this.model.saveLazy();
  }

  public async handleDrag(
    sources: BookmarkItem[],
     treeDataTransfer: vscode.DataTransfer,
      token: vscode.CancellationToken
  ): Promise<void> {
    treeDataTransfer.set(this.dropMimeTypes[0],
      new vscode.DataTransferItem(sources));
  }
}