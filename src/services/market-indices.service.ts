import YahooFinance from "yahoo-finance2";
import { AppDataSource } from "../config/data-source";
import { config } from "../config/environment";
import { MarketIndexCache } from "../models/market-index-cache";
import { ensureDataSource } from "../utils/ensure-data-source";
import { logger } from "../utils/logger";
import { Between, Repository } from "typeorm";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

interface HistoricalDataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

const SP500_SYMBOL = "SP500";

export class MarketIndicesService {
  private cacheRepo: Repository<MarketIndexCache>;

  constructor() {
    this.cacheRepo = AppDataSource.getRepository(MarketIndexCache);
  }

  private normalizeRange(startDate: Date, endDate: Date) {
    return startDate.getTime() <= endDate.getTime()
      ? { start: startDate, end: endDate }
      : { start: endDate, end: startDate };
  }

  private toDateKey(value: Date): string {
    return value.toISOString().split("T")[0];
  }

  private fromDateKey(value: string): Date {
    return new Date(`${value}T12:00:00.000Z`);
  }

  private isTtlValid(fetchedAt: Date): boolean {
    const ttlMs = config.marketIndicesTtlHours * 60 * 60 * 1000;
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    return ageMs < ttlMs;
  }

  private async getCachedRange(startDate: Date, endDate: Date) {
    const startKey = this.toDateKey(startDate);
    const endKey = this.toDateKey(endDate);

    const cached = await this.cacheRepo.find({
      where: {
        symbol: SP500_SYMBOL,
        date: Between(this.fromDateKey(startKey), this.fromDateKey(endKey)),
      },
      order: { date: "ASC" },
    });

    return cached;
  }

  private async fetchAndCacheRange(startDate: Date, endDate: Date) {
    const queryOptions = {
      period1: startDate,
      period2: endDate,
      interval: "1d" as const,
    };

    const result = await yahooFinance.chart("^GSPC", queryOptions);
    const quotes = result.quotes ?? [];
    const fetchedAt = new Date();

    const entries = quotes
      .filter((item) => item.close !== null && item.date)
      .map((item) => {
        const dateKey = item.date.toISOString().split("T")[0];
        return {
          symbol: SP500_SYMBOL,
          date: this.fromDateKey(dateKey),
          value: Number(item.close),
          fetchedAt,
        };
      });

    if (entries.length > 0) {
      await this.cacheRepo.upsert(entries, ["symbol", "date"]);
    }

    return this.getCachedRange(startDate, endDate);
  }

  /**
   * Busca dados históricos do S&P500 via Yahoo Finance
   */
  async getSP500Historical(
    startDate: Date,
    endDate: Date,
  ): Promise<HistoricalDataPoint[]> {
    await ensureDataSource();

    const { start, end } = this.normalizeRange(startDate, endDate);

    const lastFetched = await this.cacheRepo.findOne({
      where: { symbol: SP500_SYMBOL },
      order: { fetchedAt: "DESC" },
    });

    const cachedInRange = await this.getCachedRange(start, end);

    if (
      lastFetched?.fetchedAt &&
      this.isTtlValid(lastFetched.fetchedAt) &&
      cachedInRange.length > 0
    ) {
      logger.info(
        `SP500 em cache (TTL ${config.marketIndicesTtlHours}h), sem chamada ao Yahoo.`,
      );

      return cachedInRange.map((item) => ({
        date: this.toDateKey(new Date(item.date)),
        value: Number(item.value),
      }));
    }

    try {
      const refreshed = await this.fetchAndCacheRange(start, end);

      logger.info("SP500 atualizado via Yahoo e persistido em cache.");

      return refreshed.map((item) => ({
        date: this.toDateKey(new Date(item.date)),
        value: Number(item.value),
      }));
    } catch (error) {
      logger.error("Error fetching S&P500 data from Yahoo Finance", error);

      if (cachedInRange.length > 0) {
        logger.warn("Falha no Yahoo. Retornando SP500 em cache (fallback).");
        return cachedInRange.map((item) => ({
          date: this.toDateKey(new Date(item.date)),
          value: Number(item.value),
        }));
      }

      return [];
    }
  }

  /**
   * Normaliza dados para retornar apenas o primeiro dia do mês
   */
  normalizeToMonthly(data: HistoricalDataPoint[]): HistoricalDataPoint[] {
    const monthlyData = new Map<string, HistoricalDataPoint>();

    data.forEach((point) => {
      const date = new Date(point.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          date: monthKey,
          value: point.value,
        });
      }
    });

    return Array.from(monthlyData.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }
}

export const marketIndicesService = new MarketIndicesService();
