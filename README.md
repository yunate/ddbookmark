# ddbookmark README

This is a VSCode bookmark plugin that supports a sidebar with a tree structure and drag-and-drop functionality.

![](https://github.com/yunate/ddbookmark/blob/main/screenshot/bookmark-features.png)

## Commands

- ddbookmark.toggle

  If the current line does not have a bookmark, add one; otherwise, remove the existing bookmark. If a directory is currently selected, add it as a subdirectory. You can use drag-and-drop to modify the parent-child relationships of folder and bookmark.

- ddbookmark.addFolder

  Add a directory. If a directory is currently selected, add it as a subdirectory. You can use drag-and-drop to modify the parent-child relationships of folder and bookmark.

- ddbookmark.clearAll

  Remove all folders and bookmarks.

- ddbookmark.rename

  Give a new name to a folder or give a new label to a bookmark.

- ddbookmark.delete

  Delete a folder or bookmark. If delete a folder, its children folders and bookmark will be deleted too.

- ddbookmark.setGutterIconColor
  Set the gutter icon's color.