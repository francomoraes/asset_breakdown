import { AppDataSource } from "../config/data-source";
import { Asset } from "../models/asset";
import { getBRLtoUSDRate } from "./get-brl-to-usd-rate";
import { ensureDataSource } from "../utils/ensure-data-source";
import { FixedIncomeAsset } from "../models/fixed-income-asset";
import { NotFoundError } from "errors/app-error";

export async function recalculatePortfolio(userId?: number) {
  await ensureDataSource();

  const assetRepository = AppDataSource.getRepository(Asset);
  const fixedIncomeAssets = AppDataSource.getRepository(FixedIncomeAsset);

  const getAllAssets = async (userId?: number) => {
    if (userId) {
      const assets = assetRepository.findBy({ userId });
      const fixedIncome = fixedIncomeAssets.findBy({ userId });
      return Promise.all([assets, fixedIncome]).then(([a, f]) => [...a, ...f]);
    }

    throw new NotFoundError("User ID is required to recalculate portfolio");
  };

  const allAssets = await getAllAssets(userId);

  const brlToUsdRate = await getBRLtoUSDRate();

  const assetsWithUsdValue = allAssets.map((asset) => {
    const usdValue =
      asset.currency === "BRL"
        ? asset.currentValueCents * brlToUsdRate
        : asset.currentValueCents;

    return {
      asset,
      usdValue,
    };
  });

  const totalUsdValue = assetsWithUsdValue.reduce(
    (sum, a) => sum + a.usdValue,
    0,
  );

  for (const { asset, usdValue } of assetsWithUsdValue) {
    asset.portfolioPercentage =
      totalUsdValue > 0
        ? Number(((usdValue / totalUsdValue) * 100).toFixed(2))
        : 0;
  }

  const regularAssets = allAssets.filter((a) => a instanceof Asset);
  const fixedIncomeAssetsList = allAssets.filter(
    (a) => a instanceof FixedIncomeAsset,
  );

  if (regularAssets.length > 0) {
    await assetRepository.save(regularAssets);
  }

  if (fixedIncomeAssetsList.length > 0) {
    await fixedIncomeAssets.save(fixedIncomeAssetsList);
  }
}
