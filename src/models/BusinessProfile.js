import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

// Singleton row (id=1). `prefilledFields` tracks which fields were
// auto-filled (via website import) vs manually typed, so the wizard UI can
// show "X of Y pre-filled" the way the real product does.
export const BusinessProfile = sequelize.define("BusinessProfile", {
  businessName: { type: DataTypes.STRING, allowNull: true },
  location: { type: DataTypes.TEXT, allowNull: true },
  productsServices: { type: DataTypes.TEXT, allowNull: true },
  contactInfo: { type: DataTypes.TEXT, allowNull: true },
  supportHours: { type: DataTypes.TEXT, allowNull: true },
  policies: { type: DataTypes.TEXT, allowNull: true },
  website: { type: DataTypes.STRING, allowNull: true },
  socialLinks: { type: DataTypes.TEXT, allowNull: true },
  aiInstructions: { type: DataTypes.TEXT, allowNull: true },
  prefilledFields: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" }, // JSON array of field names
  confirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});
