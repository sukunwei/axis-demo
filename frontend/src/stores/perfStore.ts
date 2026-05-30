import { makeAutoObservable, runInAction } from 'mobx';

export class PerfStore {
  fps = 0;
  memoryUsedMb = 0;
  memoryTotalMb = 0;
  renders = 0;
  private rendersResetTimer: ReturnType<typeof setInterval> | null = null;

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

  incrementRenderCount(): void {
    this.renders++;
  }

  startRenderCounter(): void {
    if (this.rendersResetTimer) return;
    this.rendersResetTimer = setInterval(() => {
      runInAction(() => {
        this.renders = 0;
      });
    }, 1_000);
  }

  stopRenderCounter(): void {
    if (this.rendersResetTimer) {
      clearInterval(this.rendersResetTimer);
      this.rendersResetTimer = null;
    }
  }
}

export const perfStore = new PerfStore();
