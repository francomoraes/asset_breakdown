import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AssetClass } from "./AssetClass";
import { Asset } from "./Asset";

@Entity("asset_type")
export class AssetType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  name!: string;

  @Column("decimal", { precision: 5, scale: 2 })
  targetPercentage!: number;

  @ManyToOne(() => AssetClass, (assetClass) => assetClass.types, {
    eager: true,
  })
  assetClass!: AssetClass;

  @OneToMany(() => Asset, (asset) => asset.type)
  assets!: Asset[];
}
