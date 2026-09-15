// Import the application error class used for controlled validation errors.
const AppError = require('../utils/AppError');

// Import the centralized API response helper used throughout the backend.
const api = require('../utils/api-response');

// Import the same creator-role check used by Property creation, so only
// the roles allowed to create a Property are allowed to upload for one.
const { validatePropertyCreatorRole } = require('../validators/property.validator');

// Build the public URL for an uploaded file based on where Multer saved it.
// Multer's `req.file`/`req.files` objects don't include a servable URL by
// default — only the on-disk path — so this reconstructs the URL that
// matches the static routes mounted in app.js.
const buildPublicUrl = (req, subfolder, filename) => {
  return `${req.protocol}://${req.get('host')}/uploads/${subfolder}/${filename}`;
};

// Handle a Property image upload request. Expects the upload middleware
// to have already run and populated req.files.
exports.uploadPropertyImages = async (req, res, next) => {
  try {
    // Only the roles allowed to create a Property may upload images for one.
    const roleCheck = validatePropertyCreatorRole(req.user?.role);

    if (!roleCheck.valid) {
      return next(new AppError(roleCheck.message, 403));
    }

    // Reject the request if no files were actually attached.
    if (!req.files || req.files.length === 0) {
      return next(new AppError('At least one image file is required', 400));
    }

    // Build the public URL for each uploaded image.
    const imageUrls = req.files.map((file) =>
      buildPublicUrl(req, 'properties', file.filename),
    );

    // Return the uploaded image URLs to the client.
    return api.success(
      res,
      { images: imageUrls },
      'Images uploaded successfully',
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};

// Handle a Property document upload request. Expects the upload middleware
// to have already run and populated req.files.
exports.uploadPropertyDocuments = async (req, res, next) => {
  try {
    // Only the roles allowed to create a Property may upload documents for one.
    const roleCheck = validatePropertyCreatorRole(req.user?.role);

    if (!roleCheck.valid) {
      return next(new AppError(roleCheck.message, 403));
    }

    // Reject the request if no files were actually attached.
    if (!req.files || req.files.length === 0) {
      return next(new AppError('At least one document file is required', 400));
    }

    // Build the public URL for each uploaded document.
    const documentUrls = req.files.map((file) =>
      buildPublicUrl(req, 'documents', file.filename),
    );

    // Return the uploaded document URLs to the client.
    return api.success(
      res,
      { documents: documentUrls },
      'Documents uploaded successfully',
    );
  } catch (error) {
    // Pass unexpected errors to the global error handler.
    next(error);
  }
};