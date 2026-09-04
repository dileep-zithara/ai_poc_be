import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

// Singleton row (id=1) holding which provider/model is primary. API keys
// live separately in ProviderCredential so switching the active provider
// never loses another provider's saved key (needed for failover).
export const ModelConfig = sequelize.define("ModelConfig", {
  provider: { type: DataTypes.STRING, allowNull: false, defaultValue: "claude" },
  model: { type: DataTypes.STRING, allowNull: false, defaultValue: "claude-sonnet-4-6" },
});

