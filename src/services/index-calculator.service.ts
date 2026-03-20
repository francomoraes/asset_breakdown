import { IndexType } from "models/index-rate-cache";
import { bcbService } from "./bcb.service";

export enum IndexationMode {
  PRE_FIXED = "PRE", // Taxa pré-fixada (ex: 12% a.a.)
  POST_CDI = "CDI", // CDI + taxa (ex: CDI + 2%)
  POST_SELIC = "SELIC", // Selic + taxa (ex: Selic + 1%)
  POST_IPCA = "IPCA", // IPCA + taxa (ex: IPCA + 5%)
}

/**
 * Serviço para calcular o rendimento de ativos de renda fixa
 * com diferentes tipos de indexação
 */
export class IndexCalculatorService {
  /**
   * Calcula o valor atual de um investimento de renda fixa
   *
   * @param investedValueCents Valor investido em centavos
   * @param indexationMode Modo de indexação (PRE, CDI, SELIC, IPCA)
   * @param interestRate Taxa de juros (em % ao ano)
   * @param startDate Data de início do investimento
   * @param currentDate Data atual (ou data de vencimento se já venceu)
   * @returns Objeto com currentValueCents, resultCents, returnPercentage
   */
  async calculateFixedIncomeValue(params: {
    investedValueCents: number;
    indexationMode: IndexationMode;
    interestRate: number;
    startDate: Date;
    currentDate: Date;
  }): Promise<{
    currentValueCents: number;
    resultCents: number;
    returnPercentage: number;
  }> {
    const {
      investedValueCents,
      indexationMode,
      interestRate,
      startDate,
      currentDate,
    } = params;

    let accumulationFactor = 1.0;

    // Para investimentos pré-fixados, usar juros compostos simples
    if (indexationMode === IndexationMode.PRE_FIXED) {
      accumulationFactor = this.calculatePreFixedFactor(
        interestRate,
        startDate,
        currentDate,
      );
    } else {
      // Para pós-fixados, buscar dados do índice
      const indexType = this.getIndexType(indexationMode);
      const indexFactor = await bcbService.getAccumulatedIndex(
        indexType,
        startDate,
        currentDate,
      );

      // Calcular fator da taxa adicional (spread)
      const additionalFactor = this.calculatePreFixedFactor(
        interestRate,
        startDate,
        currentDate,
      );

      // Combinar índice com spread: (1 + índice) * (1 + spread) - 1
      accumulationFactor = indexFactor * additionalFactor;
    }

    const currentValueCents = Math.round(
      investedValueCents * accumulationFactor,
    );
    const resultCents = currentValueCents - investedValueCents;
    const returnPercentage =
      investedValueCents > 0
        ? Number(((resultCents / investedValueCents) * 100).toFixed(2))
        : 0;

    return {
      currentValueCents,
      resultCents,
      returnPercentage,
    };
  }

  /**
   * Calcula o fator de acumulação para taxa pré-fixada
   * Usa juros compostos: (1 + i)^t onde t é em anos
   */
  private calculatePreFixedFactor(
    annualRate: number,
    startDate: Date,
    endDate: Date,
  ): number {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysElapsed = Math.floor(
      (endDate.getTime() - startDate.getTime()) / millisecondsPerDay,
    );

    // Converter taxa anual para taxa diária (juros compostos)
    const dailyRate = Math.pow(1 + annualRate / 100, 1 / 365) - 1;

    // Calcular fator de acumulação
    return Math.pow(1 + dailyRate, daysElapsed);
  }

  /**
   * Mapeia modo de indexação para tipo de índice
   */
  private getIndexType(mode: IndexationMode): IndexType {
    switch (mode) {
      case IndexationMode.POST_CDI:
        return IndexType.CDI;
      case IndexationMode.POST_SELIC:
        return IndexType.SELIC;
      case IndexationMode.POST_IPCA:
        return IndexType.IPCA;
      default:
        throw new Error(`Invalid indexation mode for index lookup: ${mode}`);
    }
  }
}

export const indexCalculatorService = new IndexCalculatorService();
