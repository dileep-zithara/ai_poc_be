import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

export const WebSource = sequelize.define("WebSource", {
  url: { type: DataTypes.STRING, allowNull: false },
  pageLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
  status: { type: DataTypes.ENUM("pending", "done", "failed"), allowNull: false, defaultValue: "pending" },
  pagesFetched: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  error: { type: DataTypes.STRING, allowNull: true },
});
