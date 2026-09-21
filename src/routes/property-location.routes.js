const router = require("express").Router();

const propertyLocationController = require("../controllers/property-location.controller");

router.get(
  "/property-locations",
  propertyLocationController.getPropertyLocations,
);

module.exports = router;