import { logger } from "../utils/logger";
import { AppDataSource } from "../config/data-source";
import { calculateDerivedFields } from "../utils/calculate-derived-fields";
import { ensureDataSource } from "../utils/ensure-data-source";
import { getMarketPriceCents } from "../utils/get-market-price";
import { recalculatePortfolio } from "../utils/recalculate-portfolio";

async function updatePricesAndAssets() {
  await ensureDataSource();

  const assetRepository = AppDataSource.getRepository("Asset");
  const allAssets = await assetRepository.find();

  for (const asset of allAssets) {
    const currentPriceCents = await getMarketPriceCents(asset.ticker);

    const {
      currentValueCents,
      investedValueCents,
      resultCents,
      returnPercentage,
    } = calculateDerivedFields(
      asset.quantity,
      asset.averagePriceCents,
      currentPriceCents,
    );

    asset.currentPriceCents = currentPriceCents;
    asset.currentValueCents = currentValueCents;
    asset.investedValueCents = investedValueCents;
    asset.resultCents = resultCents;
    asset.returnPercentage = returnPercentage;
  }

  await assetRepository.save(allAssets);
  await recalculatePortfolio();
}

updatePricesAndAssets()
  .then(() => {
    logger.info("Prices and assets updated successfully.");
  })
  .catch((error) => {
    logger.error("Error updating prices and assets:", error);
  });
