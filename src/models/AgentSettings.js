import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

// Singleton row (id=1) — operational toggles for the chat agent, mirrors
// the real product's Customize tab.
export const AgentSettings = sequelize.define("AgentSettings", {
  aiEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // Shadow mode: AI still generates replies, but callers should treat them
  // as drafts, not send-to-customer — safe way to test before going live.
  shadowMode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  humanHandoffEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  productCatalogSearch: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  aiNudgeEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  nudgeDelayMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
  nudgeMessage: { type: DataTypes.TEXT, allowNull: false, defaultValue: "Hi, is there anything else I can help you with?" },
  agentName: { type: DataTypes.STRING, allowNull: false, defaultValue: "Tyaani" },
  agentGender: { type: DataTypes.STRING, allowNull: false, defaultValue: "female" },
  whatsappWabaIds: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
  instagramPageIds: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
});
