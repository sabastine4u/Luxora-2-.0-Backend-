const Agent = require('../models/agent.model');
const Property = require('../models/property.model');
const Agency = require('../models/agency.model');

const { slugify } = require('./agency.service');

const uniqueStrings = (values = []) =>
  Array.from(
    new Set(
      values
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

const buildPublicAgentSummary = async (agent) => {
  const [properties, agency] = await Promise.all([
    Property.find({
      agent: agent._id,
      status: 'Published',
    })
      .select(
        'city state propertyType propertyTypeNormalized createdAt',
      )
      .sort({ createdAt: -1 })
      .lean(),

    Agency.findById(agent.agency)
      .select('name status')
      .lean(),
  ]);

  return {
    id: agent._id,
    slug: slugify(agent.fullName),
    name: agent.fullName,
    email: agent.email,
    phone: agent.phone || null,

    // Agent profile picture is stored on the linked User.
    avatar:
      agent.user && typeof agent.user === 'object'
        ? agent.user.avatar || null
        : null,

    verified:
      agent.status === 'Active' &&
      agent.user &&
      typeof agent.user === 'object'
        ? agent.user.isVerified === true
        : false,

    status: agent.status,
    yearsOfExperience: agent.yearsOfExperience || 0,
    level: agent.level || null,
    department: agent.department || null,
    branch: agent.branch || null,

    specializations: uniqueStrings(
      agent.specializations || [],
    ),

    serviceStates: uniqueStrings(
      agent.serviceStates || [],
    ),

    neighborhoods: uniqueStrings(
      agent.neighborhoods || [],
    ),

    coverageRadius: agent.coverageRadius || null,

    createdAt: agent.createdAt,

    agency: agency
      ? {
          id: agency._id,
          name: agency.name,
          status: agency.status,
        }
      : null,

    // Real published listing count.
    listingCount: properties.length,

    activeMarkets: uniqueStrings([
      ...properties.map((property) => property.city),
      ...properties.map((property) => property.state),
      ...(agent.serviceStates || []),
      ...(agent.neighborhoods || []),
    ]),

    propertyTypes: uniqueStrings(
      properties.map(
        (property) =>
          property.propertyTypeNormalized ||
          property.propertyType,
      ),
    ),
  };
};

const getPublicAgents = async ({
  search,
  agencyId,
  sort = 'listings',
  page = 1,
  limit = 12,
} = {}) => {
  const filter = {
    status: 'Active',
  };

  if (agencyId) {
    filter.agency = agencyId;
  }

  const agents = await Agent.find(filter)
    .populate({
      path: 'user',
      select: 'avatar isVerified',
    })
    .sort({ createdAt: -1 })
    .lean();

  const summaries = await Promise.all(
    agents.map((agent) =>
      buildPublicAgentSummary(agent),
    ),
  );

  const normalizedSearch =
    search?.trim().toLowerCase();

  let filtered = summaries.filter((agent) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      agent.name
        .toLowerCase()
        .includes(normalizedSearch) ||
      agent.agency?.name
        ?.toLowerCase()
        .includes(normalizedSearch) ||
      agent.specializations.some((item) =>
        item.toLowerCase().includes(normalizedSearch),
      )
    );
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

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  return {
    agents: filtered.slice(skip, skip + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const getPublicAgentBySlug = async (slug) => {
  const agents = await Agent.find({
    status: 'Active',
  })
    .populate({
      path: 'user',
      select: 'avatar isVerified',
    })
    .lean();

  const agent = agents.find(
    (item) =>
      slugify(item.fullName) === slugify(slug),
  );

  if (!agent) {
    return null;
  }

  return buildPublicAgentSummary(agent);
};

module.exports = {
  getPublicAgents,
  getPublicAgentBySlug,
  buildPublicAgentSummary,
};