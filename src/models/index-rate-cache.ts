import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum IndexType {
  CDI = "CDI",
  SELIC = "SELIC",
  IPCA = "IPCA",
}

/**
 * Cache para armazenar taxas de índices econômicos (CDI, IPCA, Selic)
 * Evita requisições desnecessárias à API do Banco Central
 */
@Entity("index_rate_cache")
@Index(["indexType", "date"], { unique: true })
export class IndexRateCache {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: "text",
    enum: IndexType,
  })
  indexType!: IndexType;

  @Column("date")
  date!: Date;

  @Column("decimal", { precision: 10, scale: 6 })
  value!: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
