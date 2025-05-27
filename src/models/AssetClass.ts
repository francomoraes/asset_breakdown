import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { AssetType } from "./AssetType";

@Entity("asset_class")
export class AssetClass {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  name!: string;

  @OneToMany(() => AssetType, (type) => type.assetClass)
  types!: AssetType[];
}
