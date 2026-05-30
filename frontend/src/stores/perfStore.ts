import { makeAutoObservable, runInAction } from 'mobx';

export class PerfStore {
  fps = 0;
  memoryUsedMb = 0;
  memoryTotalMb = 0;

  constructor() {
    makeAutoObservable(this);
  }

  setFps(fps: number): void {
    runInAction(() => {
      this.fps = fps;
    });
  }

  setMemory(usedMb: number, totalMb: number): void {
    runInAction(() => {
      this.memoryUsedMb = usedMb;
      this.memoryTotalMb = totalMb;
    });
  }

  }
