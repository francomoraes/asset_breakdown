import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Asset } from "./asset";
import { BaseEntity } from "models/base/base-entity";
import { AssetTransactionType } from "enums/asset-transaction-type.enum";
import { decimalColumnTransformer } from "../utils/decimal-column.transformer";

@Entity("asset_transaction")
@Index(["userId", "date"])
@Index(["assetId", "date"])
export class AssetTransaction extends BaseEntity {
  @Column("int")
  assetId!: number;

  @Column("int")
  userId!: number;

  @Column({ type: "enum", enum: AssetTransactionType })
  type!: AssetTransactionType;

  @Column("date")
  date!: string;

  @Column("decimal", {
    precision: 18,
    scale: 8,
    nullable: true,
    transformer: decimalColumnTransformer,
  })
  quantity!: number | null;

  @Column("int", { nullable: true })
  unitPriceCents!: number | null;

  @Column("int", { default: 0 })
  feesCents!: number;

  @Column("int")
  totalAmountCents!: number;

  @ManyToOne(() => Asset, { onDelete: "CASCADE" })
  @JoinColumn({ name: "assetId" })
  asset!: Asset;
}
