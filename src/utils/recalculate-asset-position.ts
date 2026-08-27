import { EntityManager } from "typeorm";
import { AssetTransaction } from "../models/asset-transaction";
import { AssetTransactionType } from "enums/asset-transaction-type.enum";
import { ConflictError } from "../errors/app-error";

export interface AssetPosition {
  quantity: number;
  averagePriceCents: number;
  dividendsCentsAccumulated: number;
}

export async function recalculateAssetPosition(
  assetId: number,
  manager: EntityManager,
): Promise<AssetPosition> {
  const transactions = await manager.find(AssetTransaction, {
    where: { assetId },
    order: { date: "ASC", id: "ASC" },
  });

  let quantity = 0;
  let totalCostCents = 0;
  let dividendsCentsAccumulated = 0;

  for (const tx of transactions) {
    if (tx.type === AssetTransactionType.BUY) {
      totalCostCents += tx.quantity! * tx.unitPriceCents! + tx.feesCents;
      quantity += tx.quantity!;
    } else if (tx.type === AssetTransactionType.SELL) {
      if (tx.quantity! > quantity) {
        throw new ConflictError(
          `Quantidade insuficiente em ${tx.date.slice(0, 10)} para vender ${tx.quantity} unidades`,
          "INSUFFICIENT_QUANTITY_FOR_SALE",
        );
      }
      const averageCostCents = quantity > 0 ? totalCostCents / quantity : 0;
      totalCostCents -= tx.quantity! * averageCostCents;
      quantity -= tx.quantity!;
    } else {
      dividendsCentsAccumulated += tx.totalAmountCents;
    }
  }

  const averagePriceCents =
    quantity > 0 ? Math.round(totalCostCents / quantity) : 0;

  return { quantity, averagePriceCents, dividendsCentsAccumulated };
}
