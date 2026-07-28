import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("price_cache")
export class PriceCache {
  @PrimaryColumn("text")
  ticker!: string;

  @PrimaryColumn("text")
  currency!: string;

  @Column("int")
  value!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
