const express = require("express");
const messageController = require("../controllers/message.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.get(
  "/conversations/:conversationId/messages",
  messageController.listMessages,
);
router.post(
  "/conversations/:conversationId/messages",
  messageController.sendMessage,
);
router.patch(
  "/conversations/:conversationId/read",
  messageController.markConversationRead,
);

module.exports = router;
