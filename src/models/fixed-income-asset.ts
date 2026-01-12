import { AssetType } from "models/asset-type";
import { BaseEntity } from "models/base/base-entity";
import { Institution } from "models/institution";
import { Column, Entity, ManyToOne } from "typeorm";

@Entity("fixed_income_asset")
export class FixedIncomeAsset extends BaseEntity {
  @Column("int")
  userId!: number;

  @ManyToOne(() => AssetType, (type) => type.assets, { eager: true })
  type!: AssetType;

  @Column("text")
  description!: string;

  @Column()
  maturityDate!: Date;

  @Column("decimal", { precision: 10, scale: 2 })
  interestRate!: number;

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
}
