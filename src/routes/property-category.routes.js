const router = require("express").Router();

const propertyCategoryController = require("../controllers/property-category.controller");

// Public endpoint.
// Property categories are part of the public marketplace and do not require authentication.
router.get(
  "/property-categories",
  propertyCategoryController.getPropertyCategories,
);

module.exports = router;