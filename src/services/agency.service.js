const Agency = require('../models/agency.model');
const Agent = require('../models/agent.model');
const Property = require('../models/property.model');

const slugify = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const uniqueStrings = (values = []) =>
  Array.from(
    new Set(
      values
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

/**
 * Ensures every public Agency has a unique URL slug.
 *
 * Example:
 * Prime Realty Agency
 * Prime Realty Agency
 *
 * becomes:
 * prime-realty-agency-6cb9
 * prime-realty-agency-6cbb
 *
 * Agencies with unique names keep the clean slug:
 * sanfy
 * boarding-app
 */
const assignUniqueSlugs = (agencies = []) => {
  const slugCounts = new Map();

  agencies.forEach((agency) => {
    const baseSlug = slugify(agency.name);

    slugCounts.set(
      baseSlug,
      (slugCounts.get(baseSlug) || 0) + 1,
    );
  });

  return agencies.map((agency) => {
    const baseSlug = slugify(agency.name);

    if ((slugCounts.get(baseSlug) || 0) === 1) {
      return {
        ...agency,
        slug: baseSlug,
      };
    }

    return {
      ...agency,
      slug: `${baseSlug}-${String(agency.id).slice(-6)}`,
    };
  });
};

const buildPublicAgencySummary = async (agency) => {
  const [agents, properties] = await Promise.all([
    Agent.find({
      agency: agency._id,
      status: 'Active',
    })
      .select(
        'fullName email phone yearsOfExperience serviceStates neighborhoods coverageRadius specializations status createdAt',
      )
      .sort({ createdAt: -1 })
      .lean(),

    Property.find({
      agency: agency._id,
      status: 'Published',
    })
      .select(
        'city state propertyType propertyTypeNormalized featuredLevel listingTier createdAt',
      )
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const serviceAreas = uniqueStrings([
    ...properties.map((property) => property.city),
    ...properties.map((property) => property.state),
    ...agents.flatMap((agent) => agent.serviceStates || []),
    ...agents.flatMap((agent) => agent.neighborhoods || []),
  ]);

  const specializations = uniqueStrings(
    agents.flatMap((agent) => agent.specializations || []),
  );

  const propertyTypes = uniqueStrings(
    properties.map(
      (property) =>
        property.propertyTypeNormalized || property.propertyType,
    ),
  );

  return {
    id: agency._id,
    name: agency.name,
    contactPerson: agency.contactPerson,
    email: agency.email,
    phone: agency.phone || null,
    status: agency.status,
    createdAt: agency.createdAt,
    updatedAt: agency.updatedAt,

    // Real marketplace metrics.
    agentCount: agents.length,
    listingCount: properties.length,

    // Derived from real Agent + published Property data.
    serviceAreas,
    specializations,
    propertyTypes,
  };
};

const getPublicAgencies = async ({
  search,
  city,
  specialization,
  sort = 'listings',
  page = 1,
  limit = 9,
} = {}) => {
  const agencies = await Agency.find({
    status: 'Active',
  })
    .sort({ createdAt: -1 })
    .lean();

  const summaries = await Promise.all(
    agencies.map((agency) => buildPublicAgencySummary(agency)),
  );

  const normalizedSearch = search?.trim().toLowerCase();
  const normalizedCity = city?.trim().toLowerCase();
  const normalizedSpecialization =
    specialization?.trim().toLowerCase();

  let filtered = summaries.filter((agency) => {
    if (
      normalizedSearch &&
      !agency.name.toLowerCase().includes(normalizedSearch)
    ) {
      return false;
    }

    if (
      normalizedCity &&
      !agency.serviceAreas.some((area) =>
        area.toLowerCase().includes(normalizedCity),
      )
    ) {
      return false;
    }

    if (
      normalizedSpecialization &&
      !agency.specializations.some((item) =>
        item.toLowerCase().includes(normalizedSpecialization),
      )
    ) {
      return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    if (sort === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }

    if (sort === 'newest') {
      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
    }

    return b.listingCount - a.listingCount;
  });

  // Make slugs unique after filtering/sorting so the same
  // Agency names can safely coexist in the public directory.
  const agenciesWithUniqueSlugs =
    assignUniqueSlugs(filtered);

  const total = agenciesWithUniqueSlugs.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  return {
    agencies: agenciesWithUniqueSlugs.slice(
      skip,
      skip + limit,
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const getPublicAgencyBySlug = async (slug) => {
  const agencies = await Agency.find({
    status: 'Active',
  }).lean();

  const summaries = await Promise.all(
    agencies.map((agency) =>
      buildPublicAgencySummary(agency),
    ),
  );

  const agenciesWithUniqueSlugs =
    assignUniqueSlugs(summaries);

  const agency = agenciesWithUniqueSlugs.find(
    (item) => item.slug === slug,
  );

  if (!agency) {
    return null;
  }

  return agency;
};

module.exports = {
  slugify,
  getPublicAgencies,
  getPublicAgencyBySlug,
  buildPublicAgencySummary,
  assignUniqueSlugs,
};