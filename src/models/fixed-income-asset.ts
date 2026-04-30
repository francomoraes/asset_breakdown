import { AssetType } from "models/asset-type";
import { BaseEntity } from "models/base/base-entity";
import { Institution } from "models/institution";
import { Column, Entity, ManyToOne } from "typeorm";

export enum IndexationMode {
  PRE_FIXED = "PRE",
  POST_CDI = "CDI",
  POST_SELIC = "SELIC",
  POST_IPCA = "IPCA",
}

@Entity("fixed_income_asset")
export class FixedIncomeAsset extends BaseEntity {
  @Column("int")
  userId!: number;

  @ManyToOne(() => AssetType, (type) => type.assets, { eager: true })
  type!: AssetType;

  @Column("text")
  description!: string;

  @Column({ nullable: true })
  startDate!: Date;

  @Column({ nullable: true })
  maturityDate!: Date;

  @Column({
    type: "text",
    default: "PRE",
  })
  indexationMode!: IndexationMode;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  interestRate!: number;

  @Column("int")
  investedValueCents!: number;

  @Column("int")
  currentValueCents!: number;

  @Column("int")
  resultCents!: number;

  @Column("decimal", { precision: 12, scale: 2 })
  returnPercentage!: number;

  @Column("decimal", { precision: 12, scale: 2 })
  portfolioPercentage!: number;

  @Column({ default: false })
  manualMode!: boolean;

  @ManyToOne(() => Institution, (institution) => institution.assets, {
    eager: true,
  })
  institution!: Institution;

  @Column("text")
  currency!: string;
}
