// Create an Express router for Property media upload endpoints.
const router = require("express").Router();

// Import the upload controller that handles saved-file responses.
const uploadController = require("../controllers/upload.controller");

// Import the Multer middleware that actually processes the incoming files.
const {
  uploadPropertyImages,
  uploadPropertyDocuments,
} = require("../middleware/upload.middleware");

// Import the authentication middleware used to protect upload endpoints.
const { protect } = require("../middleware/auth.middleware");

// Upload one or more Property images. Multer runs first (parses the
// multipart/form-data and saves the files to disk), then the controller
// checks the creator role and builds the response URLs.
router.post(
  "/uploads/properties/images",
  protect,
  uploadPropertyImages,
  uploadController.uploadPropertyImages,
);

// Upload one or more Property documents (title deed, survey plan, etc.).
router.post(
  "/uploads/properties/documents",
  protect,
  uploadPropertyDocuments,
  uploadController.uploadPropertyDocuments,
);

// Export the upload router so it can be mounted by the Express application.
module.exports = router;