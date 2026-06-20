const { requireCustomer } = require("../rbac");
const { chatbotRateLimiter } = require("../middleware/rateLimits");
const { clientIp } = require("../auditLog");
const { sanitizeUserText } = require("../utils/intentParser");
const { processChatMessage } = require("../services/chatbot.service");
const { listChatMessages, insertChatMessage } = require("../services/chatMessages.schema");
const {
  getActiveBookings,
  cancelBookingForUser,
  cancelAllActiveBookingsForUser,
  parseReservationId,
} = require("../services/bookingChat.service");

/**
 * @param {import("express").Express} app
 * @param {object} deps
 */
function registerChatRoutes(app, { pool, apiError, logAudit }) {
  const internalApiBase = (
    process.env.CHATBOT_INTERNAL_API_URL ||
    `http://127.0.0.1:${process.env.PORT || 5000}`
  ).replace(/\/$/, "");

  app.get("/api/chat/history", requireCustomer, async (req, res) => {
    try {
      const messages = await listChatMessages(pool, req.authUserId, 200);
      return res.json({ ok: true, messages });
    } catch (err) {
      return res.status(500).json({ ok: false, error: apiError(err) });
    }
  });

  app.get("/api/chat/bookings/active", requireCustomer, async (req, res) => {
    try {
      const bookings = await getActiveBookings(pool, req.authUserId);
      return res.json({ ok: true, bookings });
    } catch (err) {
      return res.status(500).json({ ok: false, error: apiError(err) });
    }
  });

  app.patch("/api/chat/bookings/:id/cancel", requireCustomer, async (req, res) => {
    try {
      const id = parseReservationId(req.params.id);
      if (!id) {
        return res.status(400).json({ ok: false, error: "Invalid booking ID.", code: "INVALID_ID" });
      }
      const out = await cancelBookingForUser(pool, req.authUserId, id, logAudit);
      if (!out.ok) {
        const status = out.code === "FORBIDDEN" ? 403 : out.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ ok: false, error: out.error, code: out.code });
      }
      return res.json({
        ok: true,
        message: out.message,
        reservationId: out.reservationId,
        slotNo: out.slotNo,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: apiError(err) });
    }
  });

  app.patch("/api/chat/bookings/cancel-all", requireCustomer, async (req, res) => {
    try {
      const out = await cancelAllActiveBookingsForUser(pool, req.authUserId, logAudit);
      return res.json({
        ok: true,
        cancelledCount: out.cancelledCount,
        message: out.message,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: apiError(err) });
    }
  });

  app.post("/api/chat/message", chatbotRateLimiter, requireCustomer, async (req, res) => {
    try {
      const raw =
        req.body && typeof req.body.message === "string" ? req.body.message : "";
      const message = sanitizeUserText(raw);
      if (!message) {
        return res.status(400).json({
          ok: false,
          error: "Message is required.",
          code: "EMPTY_MESSAGE",
        });
      }

      let clientContext =
        req.body && typeof req.body.context === "object" && req.body.context !== null
          ? req.body.context
          : {};
      if (typeof clientContext !== "object" || Array.isArray(clientContext)) {
        clientContext = {};
      }

      const authHeader =
        req.headers.authorization &&
        String(req.headers.authorization).startsWith("Bearer ")
          ? req.headers.authorization
          : null;

      const userMessage = await insertChatMessage(pool, {
        userId: req.authUserId,
        senderType: "user",
        content: message,
        reservationId: clientContext.pendingCancel?.reservationId || null,
      });

      const out = await processChatMessage({
        pool,
        userId: req.authUserId,
        role: req.authRole || "user",
        message,
        clientContext,
        authorizationHeader: authHeader,
        internalApiBase,
        logAudit,
        clientIp: clientIp(req),
      });

      const botMessage = await insertChatMessage(pool, {
        userId: req.authUserId,
        senderType: "bot",
        content: out.reply || "",
        reservationId:
          out.context?.lastCancelledId ||
          out.context?.pendingCancel?.reservationId ||
          null,
      });

      return res.json({
        ok: true,
        reply: out.reply,
        quickReplies: out.quickReplies || [],
        context: out.context || {},
        userMessage,
        botMessage,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: apiError(err) });
    }
  });
}

module.exports = { registerChatRoutes };
