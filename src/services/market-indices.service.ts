import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

interface HistoricalDataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export class MarketIndicesService {
  /**
   * Busca dados históricos do S&P500 via Yahoo Finance
   */
  async getSP500Historical(
    startDate: Date,
    endDate: Date,
  ): Promise<HistoricalDataPoint[]> {
    try {
      const normalizedStartDate =
        startDate.getTime() <= endDate.getTime() ? startDate : endDate;
      const normalizedEndDate =
        startDate.getTime() <= endDate.getTime() ? endDate : startDate;

      const queryOptions = {
        period1: normalizedStartDate,
        period2: normalizedEndDate,
        interval: "1d" as const,
      };

      const result = await yahooFinance.chart("^GSPC", queryOptions);
      const quotes = result.quotes ?? [];

      return quotes
        .filter((item) => item.close !== null && item.date)
        .map((item) => ({
          date: item.date.toISOString().split("T")[0],
          value: Number(item.close),
        }));
    } catch (error) {
      console.error("Error fetching S&P500 data from Yahoo Finance:", error);
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
