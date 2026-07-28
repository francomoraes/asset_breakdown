import { config } from "../config/environment";
import { ConcurrencyLimiter } from "./concurrency-limiter";

type Task<T> = () => Promise<T>;

const limiter = new ConcurrencyLimiter(Math.max(1, config.yahooMaxConcurrency));

export function runYahooTask<T>(task: Task<T>): Promise<T> {
  return limiter.run(task);
}
