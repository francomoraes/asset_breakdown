import { AppDataSource } from "../config/data-source.js";
import { Asset } from "../models/Asset.js";
import { getBRLtoUSDRate } from "./getBRLtoUSDRate.js";

export async function recalculatePortfolio() {
  const assetRepository = AppDataSource.getRepository(Asset);
  const allAssets = await assetRepository.find();

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

  await assetRepository.save(allAssets);
}
