const ROLES = {
  BUYER: 'Buyer',
  OWNER: 'Owner',
  AGENT: 'Agent',
  AGENCY: 'Agency',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  PROCUREMENT: 'Procurement Officer',
  FINANCE: 'Finance Manager',
  ANALYST: 'Data Analyst',
  PROPERTY_MANAGER: 'Property Manager',
  SERVICE_ADMIN: 'Service Manager',
};

const PROPERTY_TYPES = [
  'Apartment',
  'Duplex',
  'Studio',
  'Mini Flat',
  'Self Contain',
  'Short Let',
  'Student Housing',
  'Affordable Rental',
  'Family House',
  'Land',
  'Warehouse',
  'Office Space',
];

// Communication constants are intentionally small at this stage.  They give
// future communication models and services one canonical vocabulary without
// activating every possible conversation workflow.
const COMMUNICATION = {
  CONVERSATION_TYPES: {
    PROPERTY_INQUIRY: "property_inquiry",
    DIRECT: "direct",
    SUPPORT: "support",
  },
  CONVERSATION_STATUSES: {
    ACTIVE: "active",
    CLOSED: "closed",
  },
};

const NOTIFICATION = {
  TYPES: [
    "inquiry_created",
    "message_received",
    "booking_created",
    "booking_confirmed",
    "booking_rejected",
    "offer_created",
    "offer_accepted",
    "offer_rejected",
    "property_assigned",
    "property_approved",
    "property_published",
  ],
  CATEGORIES: ["communication", "booking", "offer", "property", "workflow", "system"],
  PRIORITIES: ["low", "normal", "high", "urgent"],
  RESOURCE_TYPES: ["property", "inquiry", "booking", "offer", "conversation", "message"],
};

module.exports = {
  ROLES,
  PROPERTY_TYPES,
  COMMUNICATION,
  NOTIFICATION,
};
