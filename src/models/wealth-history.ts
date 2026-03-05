import { BaseEntity } from "models/base/base-entity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { User } from "./user";

@Entity("wealth_history")
@Index(["userId", "date"], { unique: true })
export class WealthHistory extends BaseEntity {
  @Column("int")
  userId!: number;

  @Column("date")
  date!: Date;

  @Column("decimal", { precision: 15, scale: 2 })
  totalWealthCents!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;
}
