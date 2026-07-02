export type ScanJob = () => Promise<void> | void;

export type ScanSchedulerOptions = {
  batchSize: number;
  timeBudgetMs: number;
  scheduleNext?: (callback: () => void) => void;
  now?: () => number;
};

export class ScanScheduler {
  private readonly queue: ScanJob[] = [];
  private running = false;
  private readonly scheduleNext: (callback: () => void) => void;
  private readonly now: () => number;

  constructor(private readonly options: ScanSchedulerOptions) {
    this.scheduleNext = options.scheduleNext ?? ((callback) => window.setTimeout(callback, 0));
    this.now = options.now ?? (() => performance.now());
  }

  enqueue(job: ScanJob): void {
    this.queue.push(job);
    if (!this.running) {
      this.running = true;
      this.scheduleNext(() => void this.drain());
    }
  }

  pendingCount(): number {
    return this.queue.length;
  }

  private async drain(): Promise<void> {
    const startedAt = this.now();
    let processed = 0;

    while (this.queue.length > 0 && processed < this.options.batchSize) {
      const job = this.queue.shift();
      if (!job) break;

      await job();
      processed += 1;

      if (this.now() - startedAt >= this.options.timeBudgetMs) {
        break;
      }
    }

    if (this.queue.length > 0) {
      this.scheduleNext(() => void this.drain());
      return;
    }

    this.running = false;
  }
}
