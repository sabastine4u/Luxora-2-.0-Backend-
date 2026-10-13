/**
 * LUXORA LEGACY MEDIA MIGRATION
 *
 * Default mode: preview only.
 *
 * Actual uploads and MongoDB changes happen only when
 * the script is run with the --execute argument.
 *
 * Original files are never deleted.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Property = require("./src/models/property.model");
const User = require("./src/models/user.model");

const {
  cloudinary,
  isCloudinaryConfigured,
} = require("./src/config/cloudinary");

const EXECUTE = process.argv.includes("--execute");

const uploadsRoot = path.join(__dirname, "uploads");

const backupDirectory = path.join(
  uploadsRoot,
  ".media-migration-backups"
);

const manifestPath = path.join(
  uploadsRoot,
  ".legacy-media-cloudinary-manifest.json"
);

const uploadTypes = ["properties", "documents", "users"];

/**
 * Recognize URLs pointing to the old local uploads folder.
 */
function parseUploadUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  let pathname;

  try {
    pathname = new URL(
      value.trim(),
      "http://localhost"
    ).pathname;

    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const match = pathname.match(
    /^\/uploads\/(properties|documents|users)\/(.+)$/i
  );

  if (!match) {
    return null;
  }

  const type = match[1].toLowerCase();

  const relativePath = match[2]
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (
    !relativePath ||
    relativePath.split("/").some(
      (part) => part === ".."
    )
  ) {
    return null;
  }

  return {
    type,
    relativePath,
    key: `${type}/${relativePath}`.toLowerCase(),
  };
}

/**
 * Resolve a local file safely within its upload folder.
 */
function resolveLocalFile(reference) {
  const base = path.resolve(
    uploadsRoot,
    reference.type
  );

  const filePath = path.resolve(
    base,
    ...reference.relativePath.split("/")
  );

  const relative = path.relative(base, filePath);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Unsafe media path: ${reference.relativePath}`
    );
  }

  return filePath;
}

/**
 * Collect all unique local-upload files referenced by MongoDB.
 */
function addReference(references, value) {
  const parsed = parseUploadUrl(value);

  if (!parsed) {
    return;
  }

  if (!references.has(parsed.key)) {
    references.set(parsed.key, parsed);
  }
}

/**
 * Build the list of media references from the database.
 */
async function inspectDatabase() {
  const [properties, users] = await Promise.all([
    Property.find({})
      .select(
        "_id images coverImage videoUrl virtualTourUrl brochureUrl floorPlans documents"
      )
      .lean(),

    User.find({
      avatar: { $exists: true, $ne: null },
    })
      .select("_id avatar")
      .lean(),
  ]);

  const references = new Map();

  for (const property of properties) {
    for (const field of ["images", "floorPlans"]) {
      for (const url of property[field] || []) {
        addReference(references, url);
      }
    }

    for (const field of [
      "coverImage",
      "videoUrl",
      "virtualTourUrl",
      "brochureUrl",
    ]) {
      addReference(references, property[field]);
    }

    for (const document of property.documents || []) {
      addReference(references, document?.url);
    }
  }

  for (const user of users) {
    addReference(references, user.avatar);
  }

  return {
    properties,
    users,
    references,
  };
}

/**
 * Read the saved upload manifest.
 *
 * The manifest allows the script to resume without re-uploading
 * files that have already been uploaded successfully.
 */
function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    return {
      version: 1,
      files: {},
    };
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  );

  if (
    !manifest.files ||
    typeof manifest.files !== "object"
  ) {
    throw new Error(
      "The saved migration manifest is invalid. Do not delete it; inspect it first."
    );
  }

  return manifest;
}

function saveManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
}

/**
 * Create a backup of media-related database fields.
 * No passwords, tokens, or other user secrets are included.
 */
function createBackup(snapshot) {
  fs.mkdirSync(backupDirectory, {
    recursive: true,
  });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const backupPath = path.join(
    backupDirectory,
    `media-backup-${timestamp}.json`
  );

  const backup = {
    createdAt: new Date().toISOString(),

    properties: snapshot.properties.map((property) => ({
      _id: String(property._id),
      images: property.images || [],
      coverImage: property.coverImage ?? null,
      videoUrl: property.videoUrl ?? null,
      virtualTourUrl: property.virtualTourUrl ?? null,
      brochureUrl: property.brochureUrl ?? null,
      floorPlans: property.floorPlans || [],
      documents: property.documents || [],
    })),

    users: snapshot.users.map((user) => ({
      _id: String(user._id),
      avatar: user.avatar ?? null,
    })),
  };

  fs.writeFileSync(
    backupPath,
    JSON.stringify(backup, null, 2),
    "utf8"
  );

  console.log(`Media reference backup saved:`);
  console.log(backupPath);

  return backupPath;
}

/**
 * Upload one file to the appropriate Cloudinary folder.
 *
 * "auto" lets Cloudinary identify the resource type.
 */
async function uploadReference(reference) {
  const filePath = resolveLocalFile(reference);

  const folders = {
    properties: "luxora/properties/legacy",
    documents: "luxora/properties/documents",
    users: "luxora/users/avatars",
  };

  const result = await cloudinary.uploader.upload(
    filePath,
    {
      folder: folders[reference.type],
      resource_type: "auto",
      use_filename: false,
      unique_filename: true,
    }
  );

  if (!result.secure_url) {
    throw new Error(
      `Cloudinary did not return a secure URL for ${reference.key}`
    );
  }

  return {
    secure_url: result.secure_url,
    public_id: result.public_id || null,
    resource_type: result.resource_type || null,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Replace an old local URL using the saved Cloudinary manifest.
 * All unrelated URLs remain unchanged.
 */
function replaceUrl(value, manifest) {
  const parsed = parseUploadUrl(value);

  if (!parsed) {
    return value;
  }

  const uploaded = manifest.files[parsed.key];

  if (!uploaded?.secure_url) {
    throw new Error(
      `No Cloudinary URL is recorded for ${parsed.key}`
    );
  }

  return uploaded.secure_url;
}

function replaceArray(values, manifest) {
  return (values || []).map((value) =>
    replaceUrl(value, manifest)
  );
}

/**
 * Update only media fields containing old local URLs.
 */
async function updateDatabase(manifest) {
  let updatedProperties = 0;
  let updatedUsers = 0;

  // Re-read records to avoid applying the initial audit snapshot.
  const properties = await Property.find({})
    .select(
      "_id images coverImage videoUrl virtualTourUrl brochureUrl floorPlans documents"
    )
    .lean();

  for (const property of properties) {
    const changes = {};

    for (const field of [
      "images",
      "floorPlans",
      "coverImage",
      "videoUrl",
      "virtualTourUrl",
      "brochureUrl",
    ]) {
      const original = property[field];

      if (Array.isArray(original)) {
        const replacement = replaceArray(
          original,
          manifest
        );

        if (
          JSON.stringify(original) !==
          JSON.stringify(replacement)
        ) {
          changes[field] = replacement;
        }
      } else if (typeof original === "string") {
        const replacement = replaceUrl(
          original,
          manifest
        );

        if (original !== replacement) {
          changes[field] = replacement;
        }
      }
    }

    if (Array.isArray(property.documents)) {
      const replacement = property.documents.map(
        (document) => ({
          ...document,
          url: replaceUrl(document?.url, manifest),
        })
      );

      if (
        JSON.stringify(property.documents) !==
        JSON.stringify(replacement)
      ) {
        changes.documents = replacement;
      }
    }

    if (Object.keys(changes).length > 0) {
      await Property.updateOne(
        { _id: property._id },
        { $set: changes }
      );

      updatedProperties += 1;
    }
  }

  const users = await User.find({
    avatar: { $exists: true, $ne: null },
  })
    .select("_id avatar")
    .lean();

  for (const user of users) {
    const replacement = replaceUrl(
      user.avatar,
      manifest
    );

    if (replacement !== user.avatar) {
      await User.updateOne(
        { _id: user._id },
        { $set: { avatar: replacement } }
      );

      updatedUsers += 1;
    }
  }

  return {
    updatedProperties,
    updatedUsers,
  };
}

async function main() {
  if (!process.env.DBSTRING) {
    throw new Error(
      "DBSTRING is missing from your backend .env file."
    );
  }

  if (EXECUTE && !isCloudinaryConfigured) {
    throw new Error(
      "Cloudinary is not configured. Check the three Cloudinary environment variables."
    );
  }

  console.log(
    EXECUTE
      ? "\nLUXORA MEDIA MIGRATION — EXECUTION MODE"
      : "\nLUXORA MEDIA MIGRATION — PREVIEW ONLY"
  );

  await mongoose.connect(process.env.DBSTRING);

  console.log("Connected to the Luxora database.");

  const snapshot = await inspectDatabase();
  const references = snapshot.references;

  const counts = {
    properties: 0,
    documents: 0,
    users: 0,
  };

  const missing = [];

  for (const reference of references.values()) {
    counts[reference.type] += 1;

    const filePath = resolveLocalFile(reference);

    if (!fs.existsSync(filePath)) {
      missing.push(reference.key);
    }
  }

  console.log("\nUnique local files referenced by MongoDB:");
  console.log(`Property media: ${counts.properties}`);
  console.log(`Documents: ${counts.documents}`);
  console.log(`Profile photos: ${counts.users}`);
  console.log(`Total: ${references.size}`);

  if (missing.length > 0) {
    console.error(
      "\nSTOP: The following referenced files are missing locally:"
    );

    for (const file of missing.slice(0, 30)) {
      console.error(`- ${file}`);
    }

    throw new Error(
      "No migration was started because some files are missing."
    );
  }

  console.log(
    "\nAll referenced local files exist."
  );

  if (!EXECUTE) {
    console.log("\nPREVIEW COMPLETE.");
    console.log(
      "No Cloudinary uploads, database updates, or file deletions were performed."
    );
    console.log(
      "Review this output before running execution mode."
    );

    return;
  }

  // Save a backup before making uploads or database changes.
  createBackup(snapshot);

  const manifest = readManifest();

  // Upload all files first. Record each success so the migration
  // can safely resume after an interruption.
  let uploadedCount = 0;
  let alreadyUploadedCount = 0;

  for (const reference of references.values()) {
    const existing = manifest.files[reference.key];

    if (existing?.secure_url) {
      alreadyUploadedCount += 1;
      continue;
    }

    console.log(
      `Uploading ${reference.key} ...`
    );

    const uploaded = await uploadReference(reference);

    manifest.files[reference.key] = uploaded;
    saveManifest(manifest);

    uploadedCount += 1;
  }

  console.log("\nCloudinary upload phase completed.");
  console.log(`New uploads: ${uploadedCount}`);
  console.log(
    `Already present in manifest: ${alreadyUploadedCount}`
  );

  // Update MongoDB only after every referenced upload has
  // a recorded Cloudinary URL.
  const result = await updateDatabase(manifest);

  console.log("\nDATABASE UPDATE COMPLETED.");
  console.log(
    `Properties updated: ${result.updatedProperties}`
  );
  console.log(
    `Users updated: ${result.updatedUsers}`
  );

  console.log(
    "\nOriginal local upload files were not deleted."
  );

  console.log(
    `Migration manifest: ${manifestPath}`
  );
}

main()
  .catch((error) => {
    console.error(
      "\nMIGRATION STOPPED:",
      error.message || error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });