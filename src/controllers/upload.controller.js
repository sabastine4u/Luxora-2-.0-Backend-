// Import the application error class used for controlled validation errors.
const AppError = require('../utils/AppError');

// Import the centralized API response helper.
const api = require('../utils/api-response');

// Import the same creator-role validation used by Property creation.
const {
  validatePropertyCreatorRole,
} = require('../validators/property.validator');

// Import the configured Cloudinary client.
const {
  cloudinary,
  isCloudinaryConfigured,
} = require('../config/cloudinary');

// Import filesystem promises so the temporary Multer files can be removed.
const fs = require('fs/promises');

/**
 * Upload one temporary Multer file to Cloudinary.
 *
 * Multer still handles the incoming multipart/form-data request and
 * temporarily stores the file on disk. Cloudinary becomes the permanent
 * media storage location.
 */
const uploadFileToCloudinary = async (
  file,
  folder,
) => {
  if (!isCloudinaryConfigured) {
    throw new AppError(
      'Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      500,
    );
  }

  return cloudinary.uploader.upload(
    file.path,
    {
      folder,
      resource_type: 'auto',
      use_filename: false,
      unique_filename: true,
    },
  );
};

/**
 * Remove the temporary file created by Multer.
 *
 * A cleanup failure should not turn an otherwise successful upload
 * into a failed API response.
 */
const removeTemporaryFile = async (
  file,
) => {
  if (!file?.path) {
    return;
  }

  try {
    await fs.unlink(file.path);
  } catch {
    // Ignore cleanup failures.
  }
};

/**
 * Upload Property images.
 *
 * Existing frontend contract remains:
 * POST /uploads/properties/images
 * multipart field: images
 */
exports.uploadPropertyImages = async (
  req,
  res,
  next,
) => {
  try {
    const roleCheck =
      validatePropertyCreatorRole(
        req.user?.role,
      );

    if (!roleCheck.valid) {
      return next(
        new AppError(
          roleCheck.message,
          403,
        ),
      );
    }

    if (
      !req.files ||
      req.files.length === 0
    ) {
      return next(
        new AppError(
          'At least one image file is required',
          400,
        ),
      );
    }

    const uploadedResults = [];

    try {
      for (const file of req.files) {
        const result =
          await uploadFileToCloudinary(
            file,
            'luxora/properties/images',
          );

        uploadedResults.push(result);
      }
    } finally {
      await Promise.all(
        req.files.map(
          removeTemporaryFile,
        ),
      );
    }

    const imageUrls =
      uploadedResults.map(
        (result) =>
          result.secure_url,
      );

    return api.success(
      res,
      {
        images: imageUrls,
      },
      'Images uploaded successfully',
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Property documents.
 *
 * Existing frontend contract remains:
 * POST /uploads/properties/documents
 * multipart field: documents
 */
exports.uploadPropertyDocuments =
  async (
    req,
    res,
    next,
  ) => {
    try {
      const roleCheck =
        validatePropertyCreatorRole(
          req.user?.role,
        );

      if (!roleCheck.valid) {
        return next(
          new AppError(
            roleCheck.message,
            403,
          ),
        );
      }

      if (
        !req.files ||
        req.files.length === 0
      ) {
        return next(
          new AppError(
            'At least one document file is required',
            400,
          ),
        );
      }

      const uploadedResults = [];

      try {
        for (const file of req.files) {
          const result =
            await uploadFileToCloudinary(
              file,
              'luxora/properties/documents',
            );

          uploadedResults.push(result);
        }
      } finally {
        await Promise.all(
          req.files.map(
            removeTemporaryFile,
          ),
        );
      }

      const documentUrls =
        uploadedResults.map(
          (result) =>
            result.secure_url,
        );

      return api.success(
        res,
        {
          documents: documentUrls,
        },
        'Documents uploaded successfully',
      );
    } catch (error) {
      next(error);
    }
  };