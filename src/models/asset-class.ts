import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { AssetType } from "./asset-type";

@Entity("asset_class")
export class AssetClass {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  name!: string;

  @Column("int")
  userId!: number;

  @OneToMany(() => AssetType, (type) => type.assetClass)
  types!: AssetType[];
}
