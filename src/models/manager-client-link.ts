import { BaseEntity } from "models/base/base-entity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { User } from "./user";

export enum LinkStatus {
  PENDING = "pending",
  ACTIVE = "active",
  REJECTED = "rejected",
  REVOKED = "revoked",
}

export enum RevokeReason {
  MANUAL_BY_INVESTOR = "manual_by_investor",
  MANUAL_BY_MANAGER = "manual_by_manager",
  ROLE_REMOVED = "role_removed",
  SUPERSEDED = "superseded",
}

@Entity("manager_client_link")
@Index(["investorId", "managerId", "status"])
@Index(["managerId", "status"])
export class ManagerClientLink extends BaseEntity {
  @Column("int")
  investorId!: number;

  @Column("int")
  managerId!: number;

  @Column({ type: "enum", enum: LinkStatus, default: LinkStatus.PENDING })
  status!: LinkStatus;

  @Column("int")
  requestedByUserId!: number;

  @Column("int", { nullable: true })
  respondedByUserId!: number | null;

  @Column({ type: "timestamp", nullable: true })
  activatedAt!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  rejectedAt!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  revokedAt!: Date | null;

  @Column({ type: "enum", enum: RevokeReason, nullable: true })
  revokeReason!: RevokeReason | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "investorId" })
  investor!: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "managerId" })
  manager!: User;
}
