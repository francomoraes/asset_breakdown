import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AssetType } from "./asset-type";
import { Institution } from "models/institution";

@Entity("asset")
export class Asset {
  @PrimaryGeneratedColumn()
  id!: number;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
