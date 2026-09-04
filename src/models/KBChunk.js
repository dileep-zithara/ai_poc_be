import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

export const KBChunk = sequelize.define("KBChunk", {
  sourceDoc: { type: DataTypes.STRING, allowNull: false },
  section: { type: DataTypes.STRING, allowNull: true }, // nearest heading, for context
  type: { type: DataTypes.ENUM("qa", "prose"), allowNull: false },
  question: { type: DataTypes.TEXT, allowNull: true }, // set for type: qa
  content: { type: DataTypes.TEXT, allowNull: false }, // answer (qa) or full text (prose)
  // JSON array on SQLite; converted to a native `vector` column by the
  // pgvector migration when PostgreSQL is configured.
  embedding: { type: DataTypes.JSON, allowNull: true },
});
