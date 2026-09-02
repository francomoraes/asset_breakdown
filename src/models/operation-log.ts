import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "models/base/base-entity";
import { OperationLogAction } from "enums/operation-log-action.enum";
import {
  OPERATION_LOG_ACTOR_ROLES,
  OperationLogActorRole,
} from "enums/operation-log-actor-role.enum";

@Entity("operation_log")
@Index(["clientId", "createdAt"])
export class OperationLog extends BaseEntity {
  @Column("int")
  clientId!: number;

  @Column("int", { nullable: true })
  actorUserId!: number | null;

  @Column("text")
  actorEmail!: string;

  @Column({ type: "enum", enum: OPERATION_LOG_ACTOR_ROLES })
  actorRole!: OperationLogActorRole;

  @Column({ type: "enum", enum: OperationLogAction })
  action!: OperationLogAction;

  @Column("text", { nullable: true })
  entityType!: string | null;

  @Column("int", { nullable: true })
  entityId!: number | null;

  @Column("jsonb", { nullable: true })
  beforeValue!: Record<string, unknown> | null;

  @Column("jsonb", { nullable: true })
  afterValue!: Record<string, unknown> | null;
}
