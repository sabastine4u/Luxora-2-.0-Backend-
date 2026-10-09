// Import Node's path module to safely build file extensions and destinations.
const path = require('path');

const fs = require('fs');
// Import Multer, the library that handles multipart/form-data file uploads.
const multer = require('multer');

// Import the application error class so rejected uploads produce a
// consistent, predictable API error rather than an unhandled crash.
const AppError = require('../utils/AppError');

// Define the maximum allowed size per uploaded file, in bytes.
// 10MB is generous enough for high-resolution property photos and scanned
// documents without allowing an accidental multi-hundred-megabyte upload.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Define the maximum number of files accepted in a single upload request.
const MAX_FILES_PER_REQUEST = 20;

// Define the image MIME types Luxora accepts for Property photos.
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

// Define the document MIME types Luxora accepts for Property documents
// (e.g. title deeds, survey plans, tax clearance certificates).
const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

// Build a Multer disk storage engine that saves uploaded files into the
// given subfolder of /uploads, using a collision-safe filename.
const buildDiskStorage = (subfolder) =>
  multer.diskStorage({
    // Choose the destination folder on disk for this upload.
    destination: (req, file, cb) => {
  const destination = path.join(
    __dirname,
    '..',
    '..',
    'uploads',
    subfolder
  );

  fs.mkdir(destination, { recursive: true }, (error) => {
    if (error) return cb(error);
    cb(null, destination);
  });
},

    // Build a unique filename so two people uploading "photo.jpg" at the
    // same time can never overwrite each other's file.
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const extension = path.extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
    },
  });

// Build a Multer file filter that only accepts the given list of MIME types,
// rejecting anything else with a clear, predictable error instead of a crash.
const buildFileFilter = (allowedMimeTypes) => (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  return cb(
    new AppError(
      `Unsupported file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`,
      400,
    ),
  );
};

// Middleware for uploading Property images. Accepts multiple files under
// the field name "images".
const uploadPropertyImages = multer({
  storage: buildDiskStorage('properties'),
  fileFilter: buildFileFilter(ALLOWED_IMAGE_MIME_TYPES),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
}).array('images', MAX_FILES_PER_REQUEST);

// Middleware for uploading Property documents. Accepts multiple files under
// the field name "documents".
const uploadPropertyDocuments = multer({
  storage: buildDiskStorage('documents'),
  fileFilter: buildFileFilter(ALLOWED_DOCUMENT_MIME_TYPES),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
}).array('documents', MAX_FILES_PER_REQUEST);

// Middleware for uploading a single authenticated user's profile picture.
const uploadUserAvatar = multer({
  storage: buildDiskStorage('users'),
  fileFilter: buildFileFilter(ALLOWED_IMAGE_MIME_TYPES),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
}).single('avatar');

// Export all upload middleware used by the application.
module.exports = {
  uploadPropertyImages,
  uploadPropertyDocuments,
  uploadUserAvatar,
};