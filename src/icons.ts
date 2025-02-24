import * as utils from './utils';
import * as vscode from 'vscode';

const SVG_ICONS: Record<string, string> = {
  lineGutter: `
    <svg t="1740384815908" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <path 
        d="M214.558118 60.235294v931.177412l282.262588-196.969412L783.058824 990.810353V60.235294H214.558118zM722.823529 876.483765l-226.243764-155.286589-221.726118 154.684236V120.470588H722.823529v756.013177z"
        fill="#000000"
      ></path>
    </svg>
  `,
};

export function getIconUri(id: string, w?: number, h?: number, color?: string) {
  let svg = SVG_ICONS[id];
  if (!svg) {
    return undefined;
  }

  if (w && h) {
    svg = svg.replace(/width="(\d+)"/, `width="${w}"`);
    svg = svg.replace(/height="(\d+)"/, `height="${h}"`);
  }

  if (color) {
    svg = svg.replace(/fill="#([0-9a-fA-F]+)"/, `fill="${color}"`);
  }

  return utils.svgToUri(svg);
}

const THEME_ICONS: Record<string, vscode.ThemeIcon> = {
  file:    new vscode.ThemeIcon('file'),
  folder:  new vscode.ThemeIcon('folder'),
  warning: new vscode.ThemeIcon('warning'),
  error:   new vscode.ThemeIcon('error'),
};

export function getThemeIcon(id: string) : vscode.ThemeIcon {
  return THEME_ICONS[id];
}