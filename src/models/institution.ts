import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Asset } from "models/asset";
import { BaseEntity } from "models/base/base-entity";

@Entity("institution")
export class Institution extends BaseEntity {
  @Column("text")
  name!: string;

  @Column("int")
  userId!: number;

  @OneToMany(() => Asset, (asset) => asset.institution)
  assets!: Asset[];
}
