import { config } from "../config/environment";

type Task<T> = () => Promise<T>;

class ConcurrencyLimiter {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number) {}

  private next() {
    this.activeCount -= 1;
    const run = this.queue.shift();
    if (run) {
      run();
    }
  }

  async run<T>(task: Task<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.activeCount += 1;

    try {
      return await task();
    } finally {
      this.next();
    }
  }
}

const limiter = new ConcurrencyLimiter(Math.max(1, config.yahooMaxConcurrency));

export function runYahooTask<T>(task: Task<T>): Promise<T> {
  return limiter.run(task);
}
