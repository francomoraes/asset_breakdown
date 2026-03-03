import { AppDataSource } from "config/data-source";
import { IndexRateCache, IndexType } from "models/index-rate-cache";
import { Repository } from "typeorm";

/**
 * Mapeamento dos tipos de índice para os códigos de série do BCB
 * CDI: 12, Selic: 11, IPCA: 433
 */
const BCB_SERIES: Record<IndexType, number> = {
  [IndexType.CDI]: 12,
  [IndexType.SELIC]: 11,
  [IndexType.IPCA]: 433,
};

interface BCBDataPoint {
  data: string;
  valor: string;
}

/**
 * Serviço para buscar dados de índices econômicos do Banco Central do Brasil
 * Documentação: https://dadosabertos.bcb.gov.br/
 */
export class BCBService {
  private cacheRepo: Repository<IndexRateCache>;
  private readonly BCB_API_BASE =
    "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

  constructor() {
    this.cacheRepo = AppDataSource.getRepository(IndexRateCache);
  }

  private normalizeDate(value: Date | string): Date {
    if (value instanceof Date) {
      return value;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T12:00:00.000Z`);
    }

    return new Date(value);
  }

  private dateKey(value: Date | string): string {
    return this.normalizeDate(value).toISOString().split("T")[0];
  }

  /**
   * Formata data para o formato do BCB (DD/MM/YYYY)
   */
  private formatDateForBCB(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Converte data do formato BCB (DD/MM/YYYY) para Date
   */
  private parseBCBDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split("/");
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
    );
  }

  /**
   * Busca dados do índice na API do BCB
   */
  private async fetchFromBCB(
    indexType: IndexType,
    startDate: Date,
    endDate: Date,
  ): Promise<BCBDataPoint[]> {
    const seriesCode = BCB_SERIES[indexType];
    const startDateStr = this.formatDateForBCB(startDate);
    const endDateStr = this.formatDateForBCB(endDate);

    const url = `${this.BCB_API_BASE}.${seriesCode}/dados?formato=json&dataInicial=${startDateStr}&dataFinal=${endDateStr}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`BCB API error: ${response.statusText}`);
      }

      const data = (await response.json()) as BCBDataPoint[];
      return data;
    } catch (error) {
      console.error(`Error fetching ${indexType} data from BCB:`, error);
      throw new Error(`Failed to fetch ${indexType} data from BCB`);
    }
  }

  /**
   * Obtém dados do índice, usando cache quando disponível
   * @param indexType Tipo do índice (CDI, SELIC, IPCA)
   * @param startDate Data inicial
   * @param endDate Data final
   * @returns Array de objetos com data e valor
   */
  async getIndexData(
    indexType: IndexType,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: Date; value: number }>> {
    const cachedData = await this.cacheRepo.find({
      where: {
        indexType,
      },
      order: {
        date: "ASC",
      },
    });

    const cachedDates = new Set(
      cachedData.map((d) => this.dateKey(d.date as Date | string)),
    );

    const startDateStr = this.dateKey(startDate);
    const endDateStr = this.dateKey(endDate);

    const needsFetch =
      !cachedData.length ||
      startDateStr < this.dateKey(cachedData[0].date as Date | string) ||
      endDateStr >
        this.dateKey(cachedData[cachedData.length - 1].date as Date | string);

    if (needsFetch) {
      const bcbData = await this.fetchFromBCB(indexType, startDate, endDate);

      const newEntries: IndexRateCache[] = [];

      for (const dataPoint of bcbData) {
        const date = this.parseBCBDate(dataPoint.data);
        const dateStr = this.dateKey(date);

        if (!cachedDates.has(dateStr)) {
          const entry = this.cacheRepo.create({
            indexType,
            date,
            value: parseFloat(dataPoint.valor),
          });
          newEntries.push(entry);
          cachedDates.add(dateStr);
        }
      }

      if (newEntries.length > 0) {
        await this.cacheRepo.save(newEntries);
      }

      cachedData.push(...newEntries);
      cachedData.sort(
        (a, b) =>
          this.normalizeDate(a.date as Date | string).getTime() -
          this.normalizeDate(b.date as Date | string).getTime(),
      );
    }

    const result = cachedData
      .filter((d) => {
        const dateStr = this.dateKey(d.date as Date | string);
        return dateStr >= startDateStr && dateStr <= endDateStr;
      })
      .map((d) => ({
        date: this.normalizeDate(d.date as Date | string),
        value: Number(d.value),
      }));

    return result;
  }

  /**
   * Calcula o valor acumulado de um índice em um período
   * @param indexType Tipo do índice
   * @param startDate Data inicial
   * @param endDate Data final
   * @returns Fator de acumulação (ex: 1.05 = 5% de acumulação)
   */
  async getAccumulatedIndex(
    indexType: IndexType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const data = await this.getIndexData(indexType, startDate, endDate);

    if (data.length === 0) {
      return 1.0;
    }

    if (indexType === IndexType.IPCA) {
      return data.reduce((acc, point) => acc * (1 + point.value / 100), 1.0);
    }

    return data.reduce((acc, point) => acc * (1 + point.value / 100), 1.0);
  }
}

export const bcbService = new BCBService();
