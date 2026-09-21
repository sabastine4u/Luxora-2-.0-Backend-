const router = require("express").Router();

const marketplaceController = require("../controllers/marketplace.controller");

router.get(
  "/marketplace/summary",
  marketplaceController.getPublicMarketplaceSummary,
);

router.get(
  "/marketplace/investment-intelligence",
  marketplaceController.getPublicInvestmentIntelligence,
);

module.exports = router;