import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("price_cache")
export class PriceCache {
  @PrimaryColumn()
  ticker!: string;

  @Column("int")
  value!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
