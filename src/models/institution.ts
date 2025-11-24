import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Asset } from "models/asset";

@Entity("institution")
export class Institution {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  name!: string;

  @Column("int")
  userId!: number;

  @OneToMany(() => Asset, (asset) => asset.institution)
  assets!: Asset[];
}
