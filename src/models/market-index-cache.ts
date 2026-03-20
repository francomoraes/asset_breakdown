import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("market_index_cache")
@Index(["symbol", "date"], { unique: true })
export class MarketIndexCache {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  symbol!: string;

  @Column("date")
  date!: Date;

  @Column("decimal", { precision: 12, scale: 4 })
  value!: number;

  @Column({ type: "timestamp" })
  fetchedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
