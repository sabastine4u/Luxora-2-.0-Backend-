const User = require("../models/user.model");
const Property = require("../models/property.model");
const Offer = require("../models/offer.model");
const Booking = require("../models/booking.model");
const Inquiry = require("../models/inquiry.model");
const Commission = require("../models/commission.model");
const Complaint = require("../models/complaint.model");
const { ROLES } = require("../config/constants");

const INTERNAL_ROLES = [
  ROLES.PROCUREMENT,
  ROLES.FINANCE,
  ROLES.ANALYST,
  ROLES.PROPERTY_MANAGER,
  ROLES.SERVICE_ADMIN,
];

function calculatePercentage(numerator, denominator) {
  if (!denominator) {
    return null;
  }

  return Math.round((numerator / denominator) * 100);
}

function formatDate(date) {
  if (!date) {
    return null;
  }

  return new Date(date).toISOString();
}

async function getManagementOverview() {
  const [
    workforce,
    properties,
    pendingReviewProperties,
    offers,
    bookings,
    inquiries,
    commissions,
    complaints,
    recentProperties,
    recentOffers,
    recentBookings,
    recentInquiries,
    recentComplaints,
  ] = await Promise.all([
    User.find({
      role: { $in: INTERNAL_ROLES },
    })
      .select(
        "_id fullName email role department isActive isVerified createdAt",
      )
      .sort({ createdAt: -1 })
      .lean(),

    Property.find({})
      .select(
        "_id title status verificationLevel createdBy createdByRole origin createdAt updatedAt",
      )
      .populate("createdBy", "fullName email role")
      .sort({ createdAt: -1 })
      .lean(),

    Property.find({
      status: "Pending Review",
    })
      .select(
        "_id title status createdBy createdByRole createdAt updatedAt",
      )
      .populate("createdBy", "fullName email role")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),

    Offer.find({})
      .select(
        "_id property buyer offerAmount status createdAt updatedAt",
      )
      .populate("property", "title")
      .populate("buyer", "fullName email")
      .sort({ createdAt: -1 })
      .lean(),

    Booking.find({})
      .select(
        "_id buyer property viewingDate viewingTime status createdAt updatedAt",
      )
      .populate("buyer", "fullName email")
      .populate("property", "title")
      .sort({ viewingDate: 1 })
      .lean(),

    Inquiry.find({})
      .select(
        "_id property fullName email status scheduledDate scheduledTime appointmentStatus activities createdAt updatedAt",
      )
      .populate("property", "title")
      .sort({ updatedAt: -1 })
      .lean(),

    Commission.find({})
      .select(
        "_id commissionId dealValue commissionPool agencyAmount status createdAt paidAt",
      )
      .sort({ createdAt: -1 })
      .lean(),

    Complaint.find({})
      .select(
        "_id ticketId type description targetType targetName status priority createdAt updatedAt resolvedAt",
      )
      .sort({ createdAt: -1 })
      .lean(),

    Property.find({})
      .select(
        "_id title status createdBy createdByRole createdAt updatedAt",
      )
      .populate("createdBy", "fullName role")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),

    Offer.find({})
      .select(
        "_id property buyer offerAmount status createdAt updatedAt",
      )
      .populate("property", "title")
      .populate("buyer", "fullName")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),

    Booking.find({})
      .select(
        "_id buyer property viewingDate viewingTime status createdAt updatedAt",
      )
      .populate("buyer", "fullName")
      .populate("property", "title")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),

    Inquiry.find({})
      .select(
        "_id property fullName status scheduledDate scheduledTime appointmentStatus createdAt updatedAt",
      )
      .populate("property", "title")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),

    Complaint.find({})
      .select(
        "_id ticketId type targetName status priority createdAt updatedAt resolvedAt",
      )
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const totalStaff = workforce.length;
  const activeStaff = workforce.filter(
    (member) => member.isActive,
  ).length;
  const inactiveStaff = totalStaff - activeStaff;
  const verifiedStaff = workforce.filter(
    (member) => member.isVerified,
  ).length;

  const totalProperties = properties.length;

  const liveProperties = properties.filter(
    (property) =>
      property.status === "Published" ||
      property.status === "Under Offer",
  ).length;

  const finalizedProperties = properties.filter(
    (property) =>
      property.status === "Sold" ||
      property.status === "Rented" ||
      property.status === "Leased",
  ).length;

  const pendingOffers = offers.filter(
    (offer) =>
      offer.status === "Submitted" ||
      offer.status === "Under Review" ||
      offer.status === "Counter Offer Received",
  ).length;

  const acceptedOffers = offers.filter(
    (offer) => offer.status === "Accepted",
  ).length;

  const totalInquiries = inquiries.length;

  const totalViewings = bookings.length;

  const totalComplaints = complaints.length;

  const resolvedComplaints = complaints.filter(
    (complaint) =>
      complaint.status === "Resolved" ||
      complaint.status === "Closed",
  ).length;

  const closedDealValue = commissions.reduce(
    (total, commission) =>
      total + Number(commission.dealValue || 0),
    0,
  );

  const agencyCommission = commissions.reduce(
    (total, commission) =>
      total + Number(commission.agencyAmount || 0),
    0,
  );

  const operationalEfficiency =
    totalProperties > 0
      ? calculatePercentage(
          liveProperties + finalizedProperties,
          totalProperties,
        )
      : null;

  const resourceUtilization =
    calculatePercentage(
      activeStaff,
      totalStaff,
    );

  const riskMitigation =
    calculatePercentage(
      resolvedComplaints,
      totalComplaints,
    );

  const departmentMap = new Map();

  workforce.forEach((member) => {
    const department =
      member.department || "Unassigned";

    if (!departmentMap.has(department)) {
      departmentMap.set(department, {
        department,
        total: 0,
        active: 0,
        verified: 0,
      });
    }

    const departmentData =
      departmentMap.get(department);

    departmentData.total += 1;

    if (member.isActive) {
      departmentData.active += 1;
    }

    if (member.isVerified) {
      departmentData.verified += 1;
    }
  });

  const departmentSummary =
    Array.from(departmentMap.values()).sort(
      (a, b) => b.total - a.total,
    );

  const approvalItems =
    pendingReviewProperties.map(
      (property) => ({
        id: String(property._id),
        title: property.title,
        requestedBy:
          property.createdBy?.fullName ||
          property.createdByRole ||
          "Unknown",
        type: "Property Review",
        priority: null,
        date: formatDate(property.createdAt),
      }),
    );

  const managementCalendar = [
    ...bookings
      .filter(
        (booking) =>
          booking.viewingDate &&
          !["Cancelled", "Rejected"].includes(
            booking.status,
          ),
      )
      .slice(0, 5)
      .map((booking) => ({
        title:
          booking.property?.title ||
          "Property Viewing",
        time: booking.viewingTime || null,
        type: "Viewing",
        attendees: 1,
        date: formatDate(
          booking.viewingDate,
        ),
      })),
  ];

  const recentActions = [
    ...recentProperties.map((property) => ({
      title: "Property activity",
      time: formatDate(property.updatedAt),
      desc: `${property.title} — ${property.status}`,
      type: "Property",
    })),

    ...recentOffers.map((offer) => ({
      title: "Offer activity",
      time: formatDate(offer.updatedAt),
      desc: `${
        offer.property?.title ||
        "Property"
      } — ${offer.status}`,
      type: "Offer",
    })),

    ...recentBookings.map((booking) => ({
      title: "Viewing activity",
      time: formatDate(booking.updatedAt),
      desc: `${
        booking.property?.title ||
        "Property"
      } — ${booking.status}`,
      type: "Viewing",
    })),

    ...recentInquiries.map((inquiry) => ({
      title: "Inquiry activity",
      time: formatDate(inquiry.updatedAt),
      desc: `${
        inquiry.property?.title ||
        "Property"
      } — ${inquiry.status}`,
      type: "Inquiry",
    })),

    ...recentComplaints.map((complaint) => ({
      title: "Complaint activity",
      time: formatDate(complaint.updatedAt),
      desc: `${complaint.ticketId} — ${complaint.status}`,
      type: "Complaint",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.time || 0).getTime() -
        new Date(a.time || 0).getTime(),
    )
    .slice(0, 8);

  return {
    summary: {
      totalStaff,
      activeStaff,
      inactiveStaff,
      verifiedStaff,

      totalProperties,
      liveProperties,
      finalizedProperties,

      totalOffers: offers.length,
      pendingOffers,
      acceptedOffers,

      totalInquiries,
      totalViewings,

      closedDealValue,
      agencyCommission,

      totalComplaints,
      resolvedComplaints,
    },

    organizationHealth: {
      operationalEfficiency,
      resourceUtilization,

      // No budget model exists yet.
      budgetAdherence: null,

      riskMitigation,

      basis: {
        operationalEfficiency:
          "Live and finalized property ratio",
        resourceUtilization:
          "Active internal staff ratio",
        budgetAdherence:
          "No budget data source is currently available",
        riskMitigation:
          "Resolved and closed complaint ratio",
      },
    },

    workforce: {
      totalStaff,
      activeStaff,
      inactiveStaff,
      verifiedStaff,
      departments: departmentSummary,
    },

    propertySnapshot: {
      draft: properties.filter(
        (property) =>
          property.status === "Draft",
      ).length,

      pendingReview:
        properties.filter(
          (property) =>
            property.status ===
            "Pending Review",
        ).length,

      approved: properties.filter(
        (property) =>
          property.status === "Approved",
      ).length,

      published: properties.filter(
        (property) =>
          property.status === "Published",
      ).length,

      underOffer: properties.filter(
        (property) =>
          property.status === "Under Offer",
      ).length,

      sold: properties.filter(
        (property) =>
          property.status === "Sold",
      ).length,

      rented: properties.filter(
        (property) =>
          property.status === "Rented",
      ).length,

      leased: properties.filter(
        (property) =>
          property.status === "Leased",
      ).length,

      archived: properties.filter(
        (property) =>
          property.status === "Archived",
      ).length,
    },

    approvals: {
      total: approvalItems.length,
      items: approvalItems,
    },

    dependencies: [
      {
        department: "Finance & Admin",
        impact: null,
        status: "No dependency data",
        progress: null,
        description:
          "Cross-department dependency tracking is not yet stored in the backend.",
      },
      {
        department: "Intelligence",
        impact: null,
        status: "No dependency data",
        progress: null,
        description:
          "Cross-department dependency tracking is not yet stored in the backend.",
      },
      {
        department: "Procurement",
        impact: null,
        status: "No dependency data",
        progress: null,
        description:
          "Cross-department dependency tracking is not yet stored in the backend.",
      },
    ],

    weeklyHighlights:
      departmentSummary.map(
        (department) => ({
          department:
            department.department,
          totalStaff:
            department.total,
          activeStaff:
            department.active,
          verifiedStaff:
            department.verified,
        }),
      ),

    goals: [],

    alerts: complaints
      .filter(
        (complaint) =>
          complaint.priority === "High" ||
          complaint.status === "Escalated",
      )
      .slice(0, 5)
      .map((complaint) => ({
        title: complaint.type,
        severity: complaint.priority,
        description:
          complaint.description ||
          `${complaint.ticketId} requires attention.`,
        status: complaint.status,
        date: formatDate(
          complaint.createdAt,
        ),
      })),

    calendar: managementCalendar,

    recentActions,
  };
}

module.exports = {
  getManagementOverview,
};