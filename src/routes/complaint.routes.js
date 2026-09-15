const express = require("express");

const complaintController = require("../controllers/complaint.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/complaints",
  protect,
  complaintController.createComplaint,
);

module.exports = router;