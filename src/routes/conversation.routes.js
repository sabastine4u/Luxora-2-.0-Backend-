const express = require("express");
const conversationController = require("../controllers/conversation.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.get("/", conversationController.listConversations);
router.post("/", conversationController.createConversation);
router.get("/:conversationId", conversationController.getConversation);
router.patch(
  "/:conversationId/archive",
  conversationController.archiveConversation,
);
router.patch(
  "/:conversationId/unarchive",
  conversationController.unarchiveConversation,
);

module.exports = router;
