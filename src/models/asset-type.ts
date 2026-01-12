import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
import { AssetClass } from "./asset-class";
import { Asset } from "./asset";
import { BaseEntity } from "models/base/base-entity";

@Entity("asset_type")
export class AssetType extends BaseEntity {
  @Column("text")
  name!: string;

  @Column("decimal", { precision: 5, scale: 2 })
  targetPercentage!: number;

  @Column("int")
  userId!: number;

  @ManyToOne(() => AssetClass, (assetClass) => assetClass.types, {
    eager: true,
  })
  assetClass!: AssetClass;

  @OneToMany(() => Asset, (asset) => asset.type)
  assets!: Asset[];
}
