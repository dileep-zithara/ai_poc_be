import { DataTypes } from "sequelize";
import { sequelize } from "./index.js";

/**
 * Maps a specific ad (and, for carousel ads, a specific card) to the
 * product it's advertising. This is necessarily manual — Meta's ad
 * performance API (see zithara_dev.json) exposes only a creative_id
 * reference, not the actual image/video/copy, so there's no automatic
 * way to know what an ad shows without this mapping.
 *
 * When a conversation starts from a CTWA ad or a customer references
 * "this one" / sends a screenshot of a known ad, this is what lets the
 * agent resolve the reference to an actual product instead of guessing.
 */
export const AdContext = sequelize.define("AdContext", {
  adId: { type: DataTypes.STRING, allowNull: false },
  cardId: { type: DataTypes.STRING, allowNull: true }, // for carousel ads
  label: { type: DataTypes.STRING, allowNull: false }, // e.g. "Darshi Polki Choker"
  productName: { type: DataTypes.STRING, allowNull: true },
  productPrice: { type: DataTypes.STRING, allowNull: true },
  productWeight: { type: DataTypes.STRING, allowNull: true },
  productNotes: { type: DataTypes.TEXT, allowNull: true },
  instructions: { type: DataTypes.TEXT, allowNull: true }, // e.g. "Don't quote old gold rates"
});
