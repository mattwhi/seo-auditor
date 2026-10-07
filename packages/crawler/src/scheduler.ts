export interface CrawlSchedulerOptions {
  concurrency: number;
  minDelayMs: number;
}

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export class CrawlScheduler {
  private active = 0;
  private lastStartedAt = 0;
  private readonly waiters: Array<() => void> = [];
  private startChain: Promise<void> = Promise.resolve();

  constructor(private readonly options: CrawlSchedulerOptions) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      throw new RangeError('concurrency must be a positive integer');
    }

    if (!Number.isFinite(options.minDelayMs) || options.minDelayMs < 0) {
      throw new RangeError('minDelayMs must be a non-negative number');
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      await this.waitForStartSlot();
      return await task();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.options.concurrency) {
      this.active += 1;
      return;
    }

    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active += 1;
  }

  private release(): void {
    this.active -= 1;
    this.waiters.shift()?.();
  }

  private async waitForStartSlot(): Promise<void> {
    const previous = this.startChain;
    let releaseStartSlot!: () => void;

    this.startChain = new Promise<void>((resolve) => {
      releaseStartSlot = resolve;
    });

    await previous;

    try {
      const elapsed = Date.now() - this.lastStartedAt;
      const remainingDelay = this.lastStartedAt === 0 ? 0 : this.options.minDelayMs - elapsed;

      if (remainingDelay > 0) {
        await sleep(remainingDelay);
      }

      this.lastStartedAt = Date.now();
    } finally {
      releaseStartSlot();
    }
  }
}
