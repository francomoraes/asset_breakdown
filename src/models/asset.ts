import { Column, Entity, ManyToOne } from "typeorm";
import { AssetType } from "./asset-type";
import { Institution } from "models/institution";
import { BaseEntity } from "models/base/base-entity";

@Entity("asset")
export class Asset extends BaseEntity {
  @Column("int")
  userId!: number;

  @ManyToOne(() => AssetType, (type) => type.assets, { eager: true })
  type!: AssetType;

  @Column("text")
  ticker!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  quantity!: number;

  @Column("int")
  averagePriceCents!: number;

  @Column("int")
  currentPriceCents!: number;

  @Column("int")
  investedValueCents!: number;

  @Column("int")
  currentValueCents!: number;

  @Column("int")
  resultCents!: number;

  @Column("decimal", { precision: 5, scale: 2 })
  returnPercentage!: number;

  @Column("decimal", { precision: 5, scale: 2 })
  portfolioPercentage!: number;

  @ManyToOne(() => Institution, (institution) => institution.assets, {
    eager: true,
  })
  institution!: Institution;

  @Column("text")
  currency!: string;

  @Column({ default: false })
  priceUnavailable!: boolean;
}
