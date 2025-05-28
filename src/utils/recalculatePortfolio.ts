import { AppDataSource } from "config/data-source";
import { Asset } from "models/Asset";
import { getBRLtoUSDRate } from "./getBRLtoUSDRate";
import { ensureDataSource } from "utils/ensureDataSource";

export async function recalculatePortfolio(userId?: string) {
  await ensureDataSource();

  const assetRepository = AppDataSource.getRepository(Asset);
  const allAssets = userId
    ? await assetRepository.findBy({ userId })
    : await assetRepository.find();

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
