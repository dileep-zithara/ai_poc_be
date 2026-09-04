import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

// Imported from the merchant's Meta ad performance export (zithara_dev.json
// style) so Ad Source Context can search real ads instead of free-typing
// an ad ID blind.
export const AdCatalogEntry = sequelize.define("AdCatalogEntry", {
  adId: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: true },
  adsetName: { type: DataTypes.STRING, allowNull: true },
  campaignId: { type: DataTypes.STRING, allowNull: true },
  creativeId: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: true },
  spend: { type: DataTypes.FLOAT, allowNull: true },
  roas: { type: DataTypes.FLOAT, allowNull: true },
  // Full Meta export record. The structured fields above support list/search;
  // this preserves every available field for the ad-detail and mapping views.
  rawData: { type: DataTypes.JSON, allowNull: true },
});
