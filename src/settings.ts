import * as utils from './utils';

export class Settings {
  version: string = '0.0.0';
  gutterColor: string = '#1afa29';

  private static gutterColorKey = "ddbookmark.gutterColorKey";
  timeoutId?: NodeJS.Timeout;
  public saveLazy(doLazyWork: boolean = true) {
    if (this.timeoutId) {
      return;
    }
    this.timeoutId = setTimeout(() => {
      this.timeoutId = undefined;
      this.saveImmediatly();
    }, 30);
  }

  public saveImmediatly() {
    utils.dump(Settings.gutterColorKey, this.gutterColor);
  }

  public load() {
    this.gutterColor = utils.load(Settings.gutterColorKey) as string;
    if (!this.gutterColor) {
      this.gutterColor = '#1afa29';
    }
  }
}
