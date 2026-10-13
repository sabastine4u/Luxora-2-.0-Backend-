/**
 * LUXORA LEGACY MEDIA AUDIT
 *
 * This script only inspects files and database references.
 * It does not upload, update, or delete anything.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Property = require("./src/models/property.model");
const User = require("./src/models/user.model");

const projectRoot = __dirname;
const uploadsRoot = path.join(projectRoot, "uploads");

const uploadTypes = ["properties", "documents", "users"];

// Recognize URLs pointing to old local upload files.
function parseUploadUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  let pathname;

  try {
    pathname = new URL(value.trim(), "http://localhost").pathname;
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
    relativePath.split("/").some((part) => part === "..")
  ) {
    return null;
  }

  return {
    type,
    relativePath,
    key: `${type}/${relativePath}`.toLowerCase(),
  };
}

// Find the files currently present in each local upload folder.
function getLocalFiles(type) {
  const base = path.join(uploadsRoot, type);

  if (!fs.existsSync(base)) {
    return [];
  }

  const result = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path
          .relative(base, absolutePath)
          .split(path.sep)
          .join("/");

        result.push({
          type,
          relativePath,
          key: `${type}/${relativePath}`.toLowerCase(),
          absolutePath,
        });
      }
    }
  }

  walk(base);

  return result;
}

// Record each old upload URL found in MongoDB.
function recordReference(
  value,
  entityType,
  entityId,
  field,
  references
) {
  const parsed = parseUploadUrl(value);

  if (!parsed) {
    return;
  }

  const existing = references.get(parsed.key) || {
    type: parsed.type,
    relativePath: parsed.relativePath,
    key: parsed.key,
    occurrences: 0,
    examples: [],
  };

  existing.occurrences += 1;

  if (existing.examples.length < 3) {
    existing.examples.push({
      entityType,
      entityId: String(entityId),
      field,
      url: value,
    });
  }

  references.set(parsed.key, existing);
}

async function main() {
  if (!process.env.DBSTRING) {
    throw new Error(
      "DBSTRING is missing. Check that the backend .env file exists in the project root."
    );
  }

  console.log("Connecting to the Luxora database...");

  await mongoose.connect(process.env.DBSTRING);

  console.log("Database connected. Inspecting media references...\n");

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

  // Inspect property media fields.
  for (const property of properties) {
    for (const field of ["images", "floorPlans"]) {
      for (const url of property[field] || []) {
        recordReference(
          url,
          "Property",
          property._id,
          field,
          references
        );
      }
    }

    for (const field of [
      "coverImage",
      "videoUrl",
      "virtualTourUrl",
      "brochureUrl",
    ]) {
      recordReference(
        property[field],
        "Property",
        property._id,
        field,
        references
      );
    }

    for (
      let i = 0;
      i < (property.documents || []).length;
      i += 1
    ) {
      recordReference(
        property.documents[i]?.url,
        "Property",
        property._id,
        `documents[${i}].url`,
        references
      );
    }
  }

  // Inspect user profile photos.
  for (const user of users) {
    recordReference(
      user.avatar,
      "User",
      user._id,
      "avatar",
      references
    );
  }

  // Compare database references with files on this computer.
  const localFiles = uploadTypes.flatMap(getLocalFiles);

  const localFileKeys = new Set(
    localFiles.map((file) => file.key)
  );

  const countsByType = Object.fromEntries(
    uploadTypes.map((type) => [
      type,
      {
        referenced: 0,
        matched: 0,
        missing: 0,
      },
    ])
  );

  const missing = [];
  let referenceOccurrences = 0;

  for (const reference of references.values()) {
    referenceOccurrences += reference.occurrences;

    countsByType[reference.type].referenced += 1;

    if (localFileKeys.has(reference.key)) {
      countsByType[reference.type].matched += 1;
    } else {
      countsByType[reference.type].missing += 1;
      missing.push(reference);
    }
  }

  console.log("\n========== LUXORA MEDIA AUDIT ==========\n");

  console.log(`Property records scanned: ${properties.length}`);
  console.log(`Users with avatar values scanned: ${users.length}`);
  console.log(`Local upload files found: ${localFiles.length}`);

  console.log(
    `Unique old media files referenced by MongoDB: ${references.size}`
  );

  console.log(
    `Total old URL references across fields: ${referenceOccurrences}`
  );

  console.log("\nReferenced files by folder:");

  for (const type of uploadTypes) {
    const onDisk = localFiles.filter(
      (file) => file.type === type
    ).length;

    const stats = countsByType[type];

    console.log(
      `- ${type}: ${onDisk} local files; ` +
      `${stats.referenced} referenced; ` +
      `${stats.matched} matched; ` +
      `${stats.missing} missing locally`
    );
  }

  if (missing.length > 0) {
    console.log("\nMissing local files (up to 25 shown):");

    for (const item of missing.slice(0, 25)) {
      const example = item.examples[0];

      console.log(
        `- ${item.type}/${item.relativePath} ` +
        `(${item.occurrences} reference(s)); ` +
        `example: ${example.entityType} ` +
        `${example.entityId} ${example.field}`
      );
    }

    if (missing.length > 25) {
      console.log(
        `... plus ${missing.length - 25} more missing references.`
      );
    }

    console.log(
      "\nDo not migrate anything yet. Review the missing files first."
    );
  } else if (references.size > 0) {
    console.log(
      "\nAll referenced old media paths match files currently on disk."
    );

    console.log(
      "Ready to plan the separate Cloudinary migration."
    );
  } else {
    console.log(
      "\nNo old local-upload URLs were found in the selected fields."
    );
  }

  console.log(
    "\nAUDIT COMPLETE: No uploads, database updates, or file deletions were performed."
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(
    "\nMedia audit failed:",
    error.message || error
  );

  try {
    await mongoose.disconnect();
  } catch {}

  process.exitCode = 1;
});