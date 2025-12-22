import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("user")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
