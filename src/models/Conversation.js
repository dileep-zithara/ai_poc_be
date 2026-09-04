import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

export const Conversation = sequelize.define("Conversation", {
  sessionId: { type: DataTypes.STRING, allowNull: false, unique: true },
  channel: { type: DataTypes.STRING, allowNull: false, defaultValue: "web" },
  activeAdId: { type: DataTypes.STRING, allowNull: true },
  activeProductName: { type: DataTypes.STRING, allowNull: true },
  history: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" }, // JSON array of {role, content}
  handoffActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  handoffReason: { type: DataTypes.STRING, allowNull: true },
  sessionContext: { type: DataTypes.TEXT, allowNull: false, defaultValue: "{}" },
});

