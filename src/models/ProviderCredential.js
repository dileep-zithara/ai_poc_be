import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

// One row per provider — keys persist independently of which provider is
// "active", so switching the active model never loses a previously-saved
// key, and the fallback chain has something to actually fail over to.
export const ProviderCredential = sequelize.define("ProviderCredential", {
  provider: { type: DataTypes.STRING, allowNull: false, unique: true },
  apiKey: { type: DataTypes.STRING, allowNull: true },
  baseURL: { type: DataTypes.STRING, allowNull: true },
});
