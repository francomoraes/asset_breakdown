import { Column, Entity } from "typeorm";
import { BaseEntity } from "models/base/base-entity";
import { ConnectedAccountStatus } from "enums/connected-account-status.enum";

@Entity("mercado_bitcoin_account")
export class MercadoBitcoinAccount extends BaseEntity {
  @Column("int")
  userId!: number;

  @Column("text", { nullable: true })
  label!: string | null;

  @Column("int")
  institutionId!: number;

  @Column("int")
  assetTypeId!: number;

  // Id da conta na Mercado Bitcoin (GET /accounts), capturado na criação —
  // usado para dedup (409 DUPLICATE_CONNECTED_ACCOUNT) e para pular a
  // redescoberta de conta em cada sync subsequente. Não é credencial sensível.
  @Column("text")
  externalAccountId!: string;

  @Column({
    type: "enum",
    enum: ConnectedAccountStatus,
    default: ConnectedAccountStatus.ACTIVE,
  })
  status!: ConnectedAccountStatus;

  @Column({ type: "timestamp", nullable: true })
  lastSyncedAt!: Date | null;

  @Column("text", { nullable: true })
  lastSyncError!: string | null;

  // AES-256-GCM — ver crypto-credentials.ts. apiKey e apiSecret são
  // criptografados juntos num único ciphertext (JSON) para que iv/authTag
  // nunca sejam reusados entre dois segredos diferentes (GCM vaza o XOR de
  // dois plaintexts cifrados com o mesmo par chave+IV).
  @Column("text")
  credentialsEncrypted!: string;

  @Column("text")
  iv!: string;

  @Column("text")
  authTag!: string;
}
