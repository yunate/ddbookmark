import { basename } from 'path';
import * as utils from './utils';

export class BookmarkItem {
  filePath?: string;
  lineNumber?: number;
  label?: string;
  parentFolderName?: string;
  isFolder!: boolean;
  isExpanded?: boolean;

  static createBookmark(
    filePath: string,
    lineNumber: number,
    parentFolderName?: string,
    label?: string
  ) {
    const bookmark = new BookmarkItem();
    bookmark.filePath = filePath;
    bookmark.lineNumber = lineNumber;
    bookmark.parentFolderName = parentFolderName;
    bookmark.label = label;
    bookmark.isFolder = false;
    return bookmark;
  }

  static createBookmarkFolder(
    name: string,
    parentFolderName?: string,
    isExpanded?: boolean
  ) {
    const bookmark = new BookmarkItem();
    bookmark.label = name;
    bookmark.parentFolderName = parentFolderName;
    bookmark.isFolder = true;
    bookmark.isExpanded = isExpanded;
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

  public key() : string {
    if(!this.isFolder) {
      return `${basename(this.filePath!)}:${this.lineNumber!}`;
    } else {
      return this.label!;
    }
  }

  public toString() : string {
    if (!this.isFolder && this.label) {
      return `${this.label} | ${this.key()}`;
    }
    return this.key();
  }
}

export class BookmarkModel {
  private static bookmarkKey = "ddbookmark.bookmark";
  private static gutterColorKey = "ddbookmark.gutterColorKey";

  bookmarks: Array<BookmarkItem>;
  gutterColor: string = '#1afa29';

  constructor() {
    this.bookmarks = new Array();
  }

  public clear() {
    this.bookmarks.length = 0;
  }

  public save() {
    utils.dump(BookmarkModel.bookmarkKey, this.bookmarks);
    utils.dump(BookmarkModel.gutterColorKey, this.gutterColor);
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

    this.gutterColor = utils.load(BookmarkModel.gutterColorKey) as string;
    if (!this.gutterColor) {
      this.gutterColor = '#1afa29';
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
}