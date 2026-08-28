import { BaseEntity } from "models/base/base-entity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { User } from "./user";
import { ManagerClientLink } from "./manager-client-link";

export enum HistoryCycleStatus {
  ACTIVE = "active",
  CLOSED = "closed",
}

@Entity("manager_client_history")
@Index(["investorId", "managerId", "status"])
export class ManagerClientHistory extends BaseEntity {
  @Column("int")
  investorId!: number;

  @Column("int")
  managerId!: number;

  @Column("int")
  linkId!: number;

  @Column({ type: "enum", enum: HistoryCycleStatus, default: HistoryCycleStatus.ACTIVE })
  status!: HistoryCycleStatus;

  @Column({ type: "timestamp" })
  cycleStartAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  cycleEndAt!: Date | null;

  @Column("bigint")
  initialWealthCents!: number;

  @Column("bigint", { nullable: true })
  finalWealthCents!: number | null;

  @Column("bigint", { nullable: true })
  currentWealthCents!: number | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "investorId" })
  investor!: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "managerId" })
  manager!: User;

  @ManyToOne(() => ManagerClientLink, { onDelete: "CASCADE" })
  @JoinColumn({ name: "linkId" })
  link!: ManagerClientLink;
}
