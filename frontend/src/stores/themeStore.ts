import { makeAutoObservable, runInAction } from 'mobx';

export type ColorTheme = 'green-red' | 'red-green';

const STORAGE_KEY = 'axis-color-theme';

export class ThemeStore {
  colorTheme: ColorTheme = 'green-red';

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'red-green' && stored) {
      this.colorTheme = 'red-green';
    }
    makeAutoObservable(this);
  }

  toggle(): void {
    runInAction(() => {
      this.colorTheme = this.colorTheme === 'green-red' ? 'red-green' : 'green-red';
      localStorage.setItem(STORAGE_KEY, this.colorTheme);
    });
  }

  setGreenUp(): void {
    runInAction(() => {
      this.colorTheme = 'green-red';
      localStorage.setItem(STORAGE_KEY, this.colorTheme);
    });
  }

  setRedUp(): void {
    runInAction(() => {
      this.colorTheme = 'red-green';
      localStorage.setItem(STORAGE_KEY, this.colorTheme);
    });
  }
}
