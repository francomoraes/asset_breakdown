import { BaseEntity } from "models/base/base-entity";
import { Column, Entity } from "typeorm";
import { UserRole } from "enums/role.enum";

@Entity("user")
export class User extends BaseEntity {
  @Column("text", { unique: true })
  email!: string;

  @Column("text")
  name!: string;

  @Column({ select: false })
  password!: string;

  @Column("text", { nullable: true })
  profilePictureUrl!: string | null;

  @Column("text", { nullable: true })
  locale!: string | null;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.INVESTOR,
  })
  role!: UserRole;

  @Column("int", { nullable: true })
  managerClientLimit!: number | null;

  @Column({ default: false })
  selfServiceEnabled!: boolean;
}
