import * as utils from './utils';

export class BookmarkItem {
  private _filePath?: string;
  private _lineNumber?: number;
  private _label?: string;
  private _parentFolderName?: string;
  private _isFolder!: boolean;
  private _isExpanded?: boolean;
  toJSON() {
    return {
      filePath: this._filePath,
      lineNumber: this._lineNumber,
      label: this._label,
      parentFolderName: this._parentFolderName,
      isFolder: this._isFolder,
      isExpanded: this._isExpanded
    };
  }

  get filePath(): string | undefined {
    return this._filePath;
  }
  set filePath(value: string | undefined) {
    this._filePath = value;
    this.calculateProperties();
  }

  get lineNumber(): number | undefined {
    return this._lineNumber;
  }
  set lineNumber(value: number | undefined) {
    this._lineNumber = value;
    this.calculateProperties();
  }

  get label(): string | undefined {
    return this._label;
  }
  set label(value: string | undefined) {
    this._label = value;
    this.calculateProperties();
  }

  get parentFolderName(): string | undefined {
    return this._parentFolderName;
  }
  set parentFolderName(value: string | undefined) {
    this._parentFolderName = value;
    this.calculateProperties();
  }

  get isFolder(): boolean {
    return this._isFolder;
  }
  set isFolder(value: boolean) {
    this._isFolder = value;
  }

  get isExpanded(): boolean | undefined {
    return this._isExpanded;
  }
  set isExpanded(value: boolean | undefined) {
    this._isExpanded = value;
  }

  static createBookmark(
    filePath: string,
    lineNumber: number,
    parentFolderName?: string,
    label?: string
  ) {
    const bookmark = new BookmarkItem();
    bookmark._filePath = filePath;
    bookmark._lineNumber = lineNumber;
    bookmark._parentFolderName = parentFolderName;
    bookmark._label = label;
    bookmark._isFolder = false;
    bookmark.calculateProperties();
    return bookmark;
  }

  static createBookmarkFolder(
    name: string,
    parentFolderName?: string,
    isExpanded?: boolean
  ) {
    const bookmark = new BookmarkItem();
    bookmark._label = name;
    bookmark._parentFolderName = parentFolderName;
    bookmark._isFolder = true;
    bookmark._isExpanded = isExpanded;
    bookmark.calculateProperties();
    return bookmark;
  }

  static compare(a: BookmarkItem, b: BookmarkItem): number {
    if (a.isFolder && !b.isFolder) {
      return -1;
    } else if (!a.isFolder && b.isFolder) {
      return 1;
    }
    return 0;
  }

  static isValidBookmark(item: BookmarkItem) {
    if (item.isFolder) {
      return !!item.label;
    } else {
      return !!item.filePath && !!item.lineNumber;
    }
  }

  // calculated properties
  calculatedKey!: string;
  calculatedDescription!: string;
  calculatedLabel!: string;
  fileExistsStatus: utils.FileExistsStatus = utils.FileExistsStatus.LineExist;

  public key(): string {
    return this.calculatedKey;
  }

  public description(): string {
    return this.calculatedDescription;
  }

  public toString(): string {
    return this.calculatedLabel;
  }

  private calculateProperties() {
    this.calculateKey();
    this.calculateDescription();
    this.calculateLabel();
  }

  private calculateKey() {
    if(!this.isFolder) {
      this.calculatedKey = `${utils.relativePath(this.filePath!)}:${this.lineNumber!}`;
    } else {
      this.calculatedKey = this.label!;
    }
  }

  private calculateLabel() {
    if (this.isFolder) {
      this.calculatedLabel =  this.label!;
    } else {
      this.calculatedLabel =
        `${utils.baseName(this.filePath!)}:${this.lineNumber!}`;
      if (this.label) {
        this.calculatedLabel =  `${this.label} | ${this.calculatedLabel}`;
      }
    }
  }

  private calculateDescription() {
    if (this.isFolder) {
      this.calculatedDescription = '';
    } else {
      this.calculatedDescription = utils.relativePath(this.filePath!);
    }
  }
}

export class BookmarkModel {
  private static bookmarkKey = "ddbookmark.bookmark";

  bookmarks: Array<BookmarkItem>;

  constructor() {
    this.bookmarks = new Array();
  }

  public clear() {
    this.bookmarks.length = 0;
  }

  timeoutId?: NodeJS.Timeout;
  public saveLazy(doLazyWork: boolean = true) {
    if (this.timeoutId) {
      return;
    }
    this.timeoutId = setTimeout(() => {
      this.timeoutId = undefined;
      this.saveImmediatly();
    }, 300);
  }

  public saveImmediatly() {
    utils.dump(BookmarkModel.bookmarkKey, this.bookmarks);
  }

  public load() {
    let loadedBookmarks: any = utils.load(BookmarkModel.bookmarkKey);
    if (loadedBookmarks) {
      this.bookmarks.length = 0;
      for (let item of loadedBookmarks) {
        if (item.isFolder) {
          this.bookmarks.push(BookmarkItem.createBookmarkFolder(
            item.label,
            item.parentFolderName,
            item.isExpanded
          ));
        } else {
          this.bookmarks.push(BookmarkItem.createBookmark(
            item.filePath,
            item.lineNumber,
            item.parentFolderName,
            item.label
          ));
        }
      }
    }
  }

  public find(item: BookmarkItem): boolean {
    if (!BookmarkItem.isValidBookmark(item)) {
      return false;
    }
    return !!this.bookmarks.find((value) => value.key() === item.key());
  }

  public addBookmark(item: BookmarkItem) {
    if (!BookmarkItem.isValidBookmark(item)) {
      return;
    }

    if (this.find(item)) {
      this.removeBookmark(item);
    }

    this.bookmarks.push(item);
  }

  public removeBookmark(item: BookmarkItem) {
    if (!BookmarkItem.isValidBookmark(item)) {
      return;
    }

    this.bookmarks = this.bookmarks.filter((i) => i.key() !== item.key());
    if (item.isFolder) {
      let tmp = this.bookmarks.slice();
      for (let i = 0; i < tmp.length; i++) {
        if (tmp[i].parentFolderName === item.key()) {
          this.removeBookmark(tmp[i]);
        }
      }
    }
  }

  public isFolderNameUsed(name: string): boolean {
    return !!this.bookmarks.find((i) => i.label === name && i.isFolder);
  }

  public getDirectChildren(folder: BookmarkItem): BookmarkItem[] {
    if (!folder.isFolder) {
      return [];
    }
    return this.bookmarks.filter((i) => i.parentFolderName === folder.label);
  }

  public getAllChildren(folder: BookmarkItem): BookmarkItem[] {
    if (!folder.isFolder) {
      return [];
    }

    let children: BookmarkItem[] = [];
    let directChildren = this.getDirectChildren(folder);
    for (let i = 0; i < directChildren.length; i++) {
      children.push(directChildren[i]);
      if (directChildren[i].isFolder) {
        children = children.concat(this.getAllChildren(directChildren[i]));
      }
    }
    return children;
  }

  public getParent(bookmark: BookmarkItem): BookmarkItem | undefined {
    if (!bookmark.parentFolderName) {
      return undefined;
    }

    for (let i = 0; i < this.bookmarks.length; i++) {
      if (this.bookmarks[i].key() === bookmark.parentFolderName) {
        return this.bookmarks[i];
      }
    }
    return undefined;
  }

  public getParentList(bookmark: BookmarkItem): BookmarkItem[] {
    let list: BookmarkItem[] = [];
    let parent = this.getParent(bookmark);
    while (parent) {
      list.push(parent);
      parent = this.getParent(parent);
    }
    return list;
  }

  public moveBookmarkBefore(source: BookmarkItem, target: BookmarkItem) {
    if (!BookmarkItem.isValidBookmark(source) ||
        !BookmarkItem.isValidBookmark(target)) {
      return;
    }

    const targetIndex = this.bookmarks.indexOf(target);
    const sourceIndex = this.bookmarks.indexOf(source);
    if (targetIndex < 0 || sourceIndex < 0 || targetIndex === sourceIndex) {
      return;
    }

    this.bookmarks.splice(targetIndex, 0, source);
    if (sourceIndex > targetIndex) {
      this.bookmarks.splice(sourceIndex + 1, 1)[0];
    } else {
      this.bookmarks.splice(sourceIndex, 1)[0];
    }
  }

  public onFileDelted(filePath: string) {
    this.bookmarks.forEach((bookmark) => {
      if (!bookmark.isFolder && bookmark.filePath === filePath) {
        bookmark.fileExistsStatus = utils.FileExistsStatus.FileNotExist;
      }
    });
  }

  public onFileRenamed(oldFilePath: string, newFilePath: string) {
    this.bookmarks.forEach((bookmark) => {
      if (!bookmark.isFolder && bookmark.filePath === oldFilePath) {
        bookmark.filePath = newFilePath;
      }
    });
  }

  public onFileChanged(filePath: string, lineCount: number) {
    this.bookmarks.forEach((bookmark) => {
      if (!bookmark.isFolder && bookmark.filePath === filePath) {
        if (bookmark.lineNumber! > lineCount) {
          bookmark.fileExistsStatus = utils.FileExistsStatus.LineNotExist;
        } else {
          bookmark.fileExistsStatus = utils.FileExistsStatus.LineExist;
        }
      }
    });
  }
}