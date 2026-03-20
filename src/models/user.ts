import { BaseEntity } from "models/base/base-entity";
import { Column, Entity } from "typeorm";

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
}
