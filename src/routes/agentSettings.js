import { Router } from "express";
import { AgentSettings } from "../models/AgentSettings.js";
import { Conversation } from "../models/Conversation.js";

const SINGLETON_ID = 1;
const BOOL_FIELDS = ["aiEnabled", "shadowMode", "humanHandoffEnabled", "productCatalogSearch", "aiNudgeEnabled"];
const NUDGE_MIN_DELAY = 1;
const NUDGE_MAX_DELAY = 10080;

const router = Router();

export async function getAgentSettings() {
  let row = await AgentSettings.findByPk(SINGLETON_ID);
  if (!row) row = await AgentSettings.create({ id: SINGLETON_ID });
  return row;
}

function serialize(row) {
  return {
    ...row.toJSON(),
    whatsappWabaIds: JSON.parse(row.whatsappWabaIds),
    instagramPageIds: JSON.parse(row.instagramPageIds),
  };
}

router.get("/", async (_req, res) => {
  res.json(serialize(await getAgentSettings()));
});

router.put("/", async (req, res) => {
  const row = await getAgentSettings();
  for (const f of BOOL_FIELDS) if (req.body[f] !== undefined) row[f] = req.body[f];
  if (req.body.nudgeDelayMinutes !== undefined) {
    const delay = Number(req.body.nudgeDelayMinutes);
    if (!Number.isInteger(delay) || delay < NUDGE_MIN_DELAY || delay > NUDGE_MAX_DELAY) {
      return res.status(400).json({ error: `Nudge delay must be between ${NUDGE_MIN_DELAY} minutes and ${NUDGE_MAX_DELAY} minutes.` });
    }
    row.nudgeDelayMinutes = delay;
  }
  if (req.body.nudgeMessage !== undefined) {
    const message = String(req.body.nudgeMessage).trim();
    if (!message) return res.status(400).json({ error: "Nudge message cannot be empty." });
    row.nudgeMessage = message;
  }
  if (req.body.agentName !== undefined) {
    const name = String(req.body.agentName || "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: "Agent name cannot be empty." });
    row.agentName = name;
  }
  if (req.body.agentGender !== undefined) {
    const gender = String(req.body.agentGender || "").toLowerCase();
    if (!["female", "male", "neutral"].includes(gender)) {
      return res.status(400).json({ error: "Gender must be female, male, or neutral." });
    }
    row.agentGender = gender;
  }
  if (req.body.whatsappWabaIds) row.whatsappWabaIds = JSON.stringify(req.body.whatsappWabaIds);
  if (req.body.instagramPageIds) row.instagramPageIds = JSON.stringify(req.body.instagramPageIds);
  await row.save();
  res.json(serialize(row));
});

/** Conversations currently handed off to a human — mirrors the real product's "AI Handoffed conversations" queue. */
router.get("/handoffs", async (_req, res) => {
  const conversations = await Conversation.findAll({ where: { handoffActive: true }, order: [["updatedAt", "DESC"]] });
  const playground = conversations.filter((c) => String(c.sessionId).startsWith("playground-"));
  if (playground.length) {
    await Conversation.update(
      { handoffActive: false, handoffReason: null },
      { where: { sessionId: playground.map((c) => c.sessionId) } }
    );
  }
  res.json(
    conversations
      .filter((c) => !String(c.sessionId).startsWith("playground-"))
      .map((c) => ({ sessionId: c.sessionId, handoffReason: c.handoffReason, updatedAt: c.updatedAt }))
  );
});

router.post("/handoffs/:sessionId/resume", async (req, res) => {
  await Conversation.update(
    { handoffActive: false, handoffReason: null },
    { where: { sessionId: req.params.sessionId } }
  );
  res.json({ ok: true });
});

router.post("/handoffs/resume-all", async (_req, res) => {
  await Conversation.update({ handoffActive: false, handoffReason: null }, { where: { handoffActive: true } });
  res.json({ ok: true });
});

export default router;
