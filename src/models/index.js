import { Sequelize } from "sequelize";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;
const isPostgres = Boolean(databaseUrl);

// Production uses PostgreSQL (with pgvector enabled at startup). SQLite is
// retained only for frictionless local development when DATABASE_URL is absent.
export const sequelize = isPostgres
  ? new Sequelize(databaseUrl, { dialect: "postgres", logging: false, dialectOptions: { ssl: process.env.DATABASE_SSL === "true" ? { require: true, rejectUnauthorized: false } : false } })
  : new Sequelize({ dialect: "sqlite", storage: path.join(__dirname, "../../ai-layer.sqlite"), logging: false });

export const databaseCapabilities = { isPostgres };
