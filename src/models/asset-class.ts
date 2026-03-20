import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { AssetType } from "./asset-type";
import { BaseEntity } from "models/base/base-entity";

@Entity("asset_class")
export class AssetClass extends BaseEntity {
  @Column("text")
  name!: string;

  @Column("int")
  userId!: number;

  @OneToMany(() => AssetType, (type) => type.assetClass)
  types!: AssetType[];
}
