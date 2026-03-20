import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("exchange_rate_cache")
export class ExchangeRateCache {
  @PrimaryColumn("text")
  pair!: string;

  @Column("double precision")
  value!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
