const Service = require("../models/service.model");

const formatRequest = (request) => ({
  id: request.recordId,
  customerId: request.customerId,
  customerName: request.customerName,
  category: request.category,
  description: request.description,
  location: request.location,
  priority: request.priority,
  status: request.status,
  assignedProviderId: request.assignedProviderId
    ? request.assignedProviderId.toString()
    : undefined,
  assignedProviderName:
    request.assignedProviderName || undefined,
  createdAt: request.createdAt,
});

const formatProvider = (provider) => ({
  id: provider.recordId,
  name: provider.name,
  category: provider.category,
  rating: provider.rating,
  reviews: provider.reviews,
  completedJobs: provider.completedJobs,
  revenue: provider.revenue,
  status: provider.status,
  verificationStatus:
    provider.verificationStatus,
  contactEmail: provider.contactEmail,
  contactPhone: provider.contactPhone,
});

exports.getOverview = async () => {
  const [
    totalMonthlyRevenue,
    activeProviders,
    pendingRequests,
    jobsCompleted,
    activeCategories,
  ] = await Promise.all([
    Service.aggregate([
      {
        $match: {
          recordType: "transaction",
          transactionType: "Revenue",
          transactionStatus: "Completed",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]),

    Service.countDocuments({
      recordType: "provider",
      status: "Active",
    }),

    Service.countDocuments({
      recordType: "request",
      status: "Pending",
    }),

    Service.countDocuments({
      recordType: "booking",
      status: "Completed",
    }),

    Service.countDocuments({
      recordType: "category",
      status: "Active",
    }),
  ]);

  const recentRequests =
    await Service.find({
      recordType: "request",
    })
      .sort({
        createdAt: -1,
      })
      .limit(4)
      .lean();

  const topProviders =
    await Service.find({
      recordType: "provider",
      status: "Active",
    })
      .sort({
        rating: -1,
        completedJobs: -1,
      })
      .limit(4)
      .lean();

  return {
    summary: {
      totalMonthlyRevenue:
        totalMonthlyRevenue[0]?.total || 0,

      activeProviders,

      pendingRequests,

      jobsCompleted,

      activeCategories,
    },

    recentRequests:
      recentRequests.map(formatRequest),

    topProviders:
      topProviders.map(formatProvider),
  };
};

const buildRequestId = () =>
  `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

exports.getServiceRequests = async (filters = {}) => {
  const query = {
    recordType: "request",
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.priority) {
    query.priority = filters.priority;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  const requests = await Service.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return requests.map(formatRequest);
};

exports.createServiceRequest = async (data, userId) => {
  if (
    !data.customerName ||
    !data.category ||
    !data.description ||
    !data.location
  ) {
    const error = new Error(
      "customerName, category, description and location are required",
    );

    error.statusCode = 400;
    throw error;
  }

  const request = await Service.create({
    recordType: "request",
    recordId: buildRequestId(),

    customerId: data.customerId || null,
    customerName: data.customerName,

    category: data.category,
    description: data.description,
    location: data.location,

    priority: data.priority || "Low",

    status: "Pending",

    notes: data.notes || "",

    createdBy: userId || null,
  });

  return formatRequest(request);
};

exports.assignServiceRequest = async (
  requestId,
  data,
  userId,
) => {
  if (!data.providerId) {
    const error = new Error(
      "providerId is required",
    );

    error.statusCode = 400;
    throw error;
  }

  const [request, provider] = await Promise.all([
    Service.findOne({
      recordType: "request",
      recordId: requestId,
    }),

    Service.findOne({
      recordType: "provider",
      recordId: data.providerId,
      status: "Active",
      verificationStatus: "Verified",
    }),
  ]);

  if (!request) {
    const error = new Error(
      "Service request not found",
    );

    error.statusCode = 404;
    throw error;
  }

  if (!provider) {
    const error = new Error(
      "Verified active provider not found",
    );

    error.statusCode = 404;
    throw error;
  }

  request.assignedProviderId = provider._id;
  request.assignedProviderName = provider.name;
  request.status = "Assigned";
  request.updatedBy = userId || null;

  if (data.notes) {
    request.notes = data.notes;
  }

  await request.save();

  return formatRequest(request);
};

exports.rejectServiceRequest = async (
  requestId,
  userId,
  reason,
) => {
  const request =
    await Service.findOne({
      recordType: "request",
      recordId: requestId,
    });

  if (!request) {
    const error = new Error(
      "Service request not found",
    );

    error.statusCode = 404;
    throw error;
  }

  request.status = "Cancelled";
  request.updatedBy = userId || null;

  if (reason) {
    request.notes = reason;
  }

  await request.save();

  return formatRequest(request);
};

const buildProviderId = () =>
  `PRV-${Date.now()}-${Math.floor(
    Math.random() * 1000,
  )}`;

exports.getServiceProviders = async (filters = {}) => {
  const query = {
    recordType: "provider",
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.verificationStatus) {
    query.verificationStatus =
      filters.verificationStatus;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  const providers = await Service.find(query)
    .sort({
      createdAt: -1,
    })
    .lean();

  return providers.map(formatProvider);
};

exports.createServiceProvider = async (
  data,
  userId,
) => {
  if (
    !data.name ||
    !data.category
  ) {
    const error = new Error(
      "name and category are required",
    );

    error.statusCode = 400;
    throw error;
  }

  const provider =
    await Service.create({
      recordType: "provider",

      recordId:
        buildProviderId(),

      name:
        data.name.trim(),

      category:
        data.category,

      contactEmail:
        data.contactEmail
          ? data.contactEmail
              .trim()
              .toLowerCase()
          : "",

      contactPhone:
        data.contactPhone
          ? data.contactPhone.trim()
          : "",

      /*
       * New providers enter onboarding
       * as pending.
       */
      status: "Pending",

      verificationStatus:
        "Pending",

      rating: 0,
      reviews: 0,
      completedJobs: 0,
      revenue: 0,

      createdBy:
        userId || null,
    });

  return formatProvider(provider);
};

exports.approveServiceProvider = async (
  providerId,
  userId,
) => {
  const provider =
    await Service.findOne({
      recordType: "provider",
      recordId: providerId,
    });

  if (!provider) {
    const error = new Error(
      "Service provider not found",
    );

    error.statusCode = 404;
    throw error;
  }

  provider.verificationStatus =
    "Verified";

  provider.status =
    "Active";

  provider.updatedBy =
    userId || null;

  await provider.save();

  return formatProvider(provider);
};

exports.suspendServiceProvider = async (
  providerId,
  userId,
) => {
  const provider =
    await Service.findOne({
      recordType: "provider",
      recordId: providerId,
    });

  if (!provider) {
    const error = new Error(
      "Service provider not found",
    );

    error.statusCode = 404;
    throw error;
  }

  provider.status =
    "Inactive";

  provider.updatedBy =
    userId || null;

  await provider.save();

  return formatProvider(provider);
};

const formatBooking = (booking) => {
  const scheduledDate = booking.scheduledAt
    ? new Date(booking.scheduledAt)
    : null;

  return {
    id: booking.recordId,

    customerId: booking.customerId
      ? booking.customerId.toString()
      : "",

    customerName:
      booking.customerName || "",

    providerId: booking.providerId
      ? booking.providerId.toString()
      : "",

    providerName:
      booking.providerName || "",

    category:
      booking.category || "",

    date: scheduledDate
      ? scheduledDate.toISOString().split("T")[0]
      : "",

    time: scheduledDate
      ? scheduledDate.toLocaleTimeString(
          "en-NG",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          },
        )
      : "",

    status:
      booking.status || "Scheduled",

    amount:
      booking.amount || 0,
  };
};

exports.getServiceBookings = async (
  filters = {},
) => {
  const query = {
    recordType: "booking",
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  const bookings = await Service.find(query)
    .sort({
      scheduledAt: 1,
      createdAt: -1,
    })
    .lean();

  return bookings.map(formatBooking);
};

exports.updateServiceBookingStatus = async (
  bookingId,
  status,
  userId,
) => {
  const allowedStatuses = [
    "Scheduled",
    "In Progress",
    "Completed",
    "Cancelled",
  ];

  if (!allowedStatuses.includes(status)) {
    const error = new Error(
      "Invalid booking status",
    );

    error.statusCode = 400;
    throw error;
  }

  const booking =
    await Service.findOne({
      recordType: "booking",
      recordId: bookingId,
    });

  if (!booking) {
    const error = new Error(
      "Booking not found",
    );

    error.statusCode = 404;
    throw error;
  }

  booking.status = status;
  booking.updatedBy =
    userId || null;

  await booking.save();

  return formatBooking(booking);
};

const buildBookingId = () =>
  `BKG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

exports.createBookingFromRequest = async (
  requestId,
  data,
  userId,
) => {
  const request = await Service.findOne({
    recordType: "request",
    recordId: requestId,
  });

  if (!request) {
    const error = new Error(
      "Service request not found",
    );

    error.statusCode = 404;
    throw error;
  }

  if (!request.assignedProviderId) {
    const error = new Error(
      "A provider must be assigned before creating a booking",
    );

    error.statusCode = 400;
    throw error;
  }

  if (!data.scheduledAt) {
    const error = new Error(
      "scheduledAt is required",
    );

    error.statusCode = 400;
    throw error;
  }

  if (data.amount === undefined) {
    const error = new Error(
      "amount is required",
    );

    error.statusCode = 400;
    throw error;
  }

  const scheduledAt = new Date(
    data.scheduledAt,
  );

  if (Number.isNaN(scheduledAt.getTime())) {
    const error = new Error(
      "Invalid scheduledAt value",
    );

    error.statusCode = 400;
    throw error;
  }

  const existingBooking =
    await Service.findOne({
      recordType: "booking",
      requestId: request._id,
    });

  if (existingBooking) {
    const error = new Error(
      "A booking already exists for this service request",
    );

    error.statusCode = 409;
    throw error;
  }

  const booking = await Service.create({
    recordType: "booking",

    recordId: buildBookingId(),

    customerId:
      request.customerId || null,

    customerName:
      request.customerName,

    providerId:
      request.assignedProviderId,

    providerName:
      request.assignedProviderName,

    category:
      request.category,

    scheduledAt,

    amount:
      Number(data.amount),

    status:
      "Scheduled",

    createdBy:
      userId || null,
  });

  return formatBooking(booking);
};

const buildCategoryId = () =>
  `CAT-${Date.now()}-${Math.floor(
    Math.random() * 1000,
  )}`;

exports.getServiceCategories = async () => {
  const categories =
    await Service.find({
      recordType: "category",
    })
      .sort({
        createdAt: -1,
      })
      .lean();

  const enrichedCategories =
    await Promise.all(
      categories.map(async (category) => {
        const [
          activeProviders,
          activeRequests,
          revenueResult,
        ] = await Promise.all([
          Service.countDocuments({
            recordType: "provider",
            category: category.name,
            status: "Active",
          }),

          Service.countDocuments({
            recordType: "request",
            category: category.name,
            status: {
              $in: [
                "Pending",
                "Assigned",
                "In Progress",
              ],
            },
          }),

          Service.aggregate([
            {
              $match: {
                recordType: "transaction",
                transactionType: "Revenue",
                transactionStatus: "Completed",
                category: category.name,
              },
            },
            {
              $group: {
                _id: null,
                total: {
                  $sum: "$amount",
                },
              },
            },
          ]),
        ]);

        return {
          id: category.recordId,

          name: category.name,

          description:
            category.description || "",

          icon:
            category.icon || "",

          activeProviders,

          activeRequests,

          monthlyRevenue:
            revenueResult[0]?.total || 0,

          status:
            category.status,
        };
      }),
    );

  return enrichedCategories;
};

exports.createServiceCategory = async (
  data,
  userId,
) => {
  if (!data.name?.trim()) {
    const error = new Error(
      "Category name is required",
    );

    error.statusCode = 400;
    throw error;
  }

  const existingCategory =
    await Service.findOne({
      recordType: "category",
      name: data.name.trim(),
    });

  if (existingCategory) {
    const error = new Error(
      "A service category with this name already exists",
    );

    error.statusCode = 409;
    throw error;
  }

  const category =
    await Service.create({
      recordType: "category",

      recordId:
        buildCategoryId(),

      name:
        data.name.trim(),

      description:
        data.description
          ? data.description.trim()
          : "",

      icon:
        data.icon || "",

      status:
        "Active",

      createdBy:
        userId || null,
    });

  return {
    id: category.recordId,

    name: category.name,

    description:
      category.description,

    icon:
      category.icon || "",

    activeProviders: 0,

    activeRequests: 0,

    monthlyRevenue: 0,

    status:
      category.status,
  };
};

exports.updateServiceCategory = async (
  categoryId,
  data,
  userId,
) => {
  const category =
    await Service.findOne({
      recordType: "category",
      recordId: categoryId,
    });

  if (!category) {
    const error = new Error(
      "Service category not found",
    );

    error.statusCode = 404;
    throw error;
  }

  if (data.name?.trim()) {
    const duplicate =
      await Service.findOne({
        recordType: "category",
        name: data.name.trim(),
        _id: {
          $ne: category._id,
        },
      });

    if (duplicate) {
      const error = new Error(
        "A service category with this name already exists",
      );

      error.statusCode = 409;
      throw error;
    }

    category.name =
      data.name.trim();
  }

  if (
    data.description !==
    undefined
  ) {
    category.description =
      data.description
        ? data.description.trim()
        : "";
  }

  category.updatedBy =
    userId || null;

  await category.save();

  const [
    activeProviders,
    activeRequests,
    revenueResult,
  ] = await Promise.all([
    Service.countDocuments({
      recordType: "provider",
      category: category.name,
      status: "Active",
    }),

    Service.countDocuments({
      recordType: "request",
      category: category.name,
      status: {
        $in: [
          "Pending",
          "Assigned",
          "In Progress",
        ],
      },
    }),

    Service.aggregate([
      {
        $match: {
          recordType: "transaction",
          transactionType: "Revenue",
          transactionStatus: "Completed",
          category: category.name,
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]),
  ]);

  return {
    id: category.recordId,

    name: category.name,

    description:
      category.description || "",

    icon:
      category.icon || "",

    activeProviders,

    activeRequests,

    monthlyRevenue:
      revenueResult[0]?.total || 0,

    status:
      category.status,
  };
};

exports.toggleServiceCategory = async (
  categoryId,
  userId,
) => {
  const category =
    await Service.findOne({
      recordType: "category",
      recordId: categoryId,
    });

  if (!category) {
    const error = new Error(
      "Service category not found",
    );

    error.statusCode = 404;
    throw error;
  }

  category.status =
    category.status === "Active"
      ? "Inactive"
      : "Active";

  category.updatedBy =
    userId || null;

  await category.save();

  return {
    id: category.recordId,

    name: category.name,

    description:
      category.description || "",

    icon:
      category.icon || "",

    status:
      category.status,
  };
};

const formatTransaction = (transaction) => ({
  id: transaction.recordId,

  date: transaction.transactionDate
    ? transaction.transactionDate
        .toISOString()
        .split("T")[0]
    : "",

  description:
    transaction.transactionDescription || "",

  type:
    transaction.transactionType || "",

  amount:
    transaction.amount || 0,

  status:
    transaction.transactionStatus || "",
});

exports.getFinancials = async () => {
  const [
    revenueResult,
    payoutResult,
    transactions,
  ] = await Promise.all([
    Service.aggregate([
      {
        $match: {
          recordType: "transaction",
          transactionType: "Revenue",
          transactionStatus: "Completed",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]),

    Service.aggregate([
      {
        $match: {
          recordType: "transaction",
          transactionType: "Payout",
          transactionStatus: "Completed",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]),

    Service.find({
      recordType: "transaction",
    })
      .sort({
        transactionDate: -1,
        createdAt: -1,
      })
      .limit(10)
      .lean(),
  ]);

  return {
    summary: {
      totalRevenue:
        revenueResult[0]?.total || 0,

      providerPayouts:
        payoutResult[0]?.total || 0,

      /*
       * There is currently no subscription
       * data source in the Home Services domain.
       * Keep this empty rather than inventing
       * an active subscription count.
       */
      activeSubscriptions: null,
    },

    transactions:
      transactions.map(formatTransaction),
  };
};

const buildTransactionId = () =>
  `TXN-${Date.now()}-${Math.floor(
    Math.random() * 1000,
  )}`;

exports.createRevenueTransactionFromBooking =
  async (bookingId, userId) => {
    const booking =
      await Service.findOne({
        recordType: "booking",
        recordId: bookingId,
      });

    if (!booking) {
      const error = new Error(
        "Booking not found",
      );

      error.statusCode = 404;
      throw error;
    }

    if (booking.status !== "Completed") {
      const error = new Error(
        "A financial transaction can only be created from a completed booking",
      );

      error.statusCode = 400;
      throw error;
    }

    const existingTransaction =
      await Service.findOne({
        recordType: "transaction",
        bookingId: booking._id,
        transactionType: "Revenue",
      });

    if (existingTransaction) {
      return formatTransaction(
        existingTransaction,
      );
    }

    const transaction =
      await Service.create({
        recordType: "transaction",

        recordId:
          buildTransactionId(),

        bookingId:
          booking._id,

        category:
          booking.category,

        amount:
          booking.amount,

        transactionDate:
          new Date(),

        transactionDescription:
          `Revenue from completed ${booking.category} service booking ${booking.recordId}`,

        transactionType:
          "Revenue",

        transactionStatus:
          "Completed",

        period:
          new Date()
            .toISOString()
            .slice(0, 7),

        createdBy:
          userId || null,
      });

    return formatTransaction(
      transaction,
    );
  };

  exports.getAnalytics = async () => {
  const [
    requestCategoryData,
    providerRatingData,
    requestCompletionData,
    revenueTrendData,
  ] = await Promise.all([
    /*
     * Requests grouped by category.
     */
    Service.aggregate([
      {
        $match: {
          recordType: "request",
        },
      },
      {
        $group: {
          _id: "$category",
          requests: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          requests: -1,
        },
      },
    ]),

    /*
     * Average rating of active and verified providers.
     */
    Service.aggregate([
      {
        $match: {
          recordType: "provider",
          status: "Active",
          verificationStatus: "Verified",
          rating: {
            $gt: 0,
          },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: {
            $avg: "$rating",
          },
        },
      },
    ]),

    /*
     * Request completion rate.
     *
     * Only Completed and Cancelled requests
     * are considered finalised.
     */
    Service.aggregate([
      {
        $match: {
          recordType: "request",
          status: {
            $in: [
              "Completed",
              "Cancelled",
            ],
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
    ]),

    /*
     * Revenue grouped by month.
     */
    Service.aggregate([
      {
        $match: {
          recordType: "transaction",
          transactionType: "Revenue",
          transactionStatus: "Completed",
          transactionDate: {
            $ne: null,
          },
        },
      },
      {
        $group: {
          _id: {
            year: {
              $year: "$transactionDate",
            },
            month: {
              $month: "$transactionDate",
            },
          },
          revenue: {
            $sum: "$amount",
          },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]),
  ]);

  /*
   * Most requested category.
   */
  const totalRequests =
    requestCategoryData.reduce(
      (total, item) =>
        total + item.requests,
      0,
    );

  const categoryDistribution =
    requestCategoryData.map(
      (item) => ({
        category:
          item._id || "Uncategorized",

        requests:
          item.requests,

        percentage:
          totalRequests > 0
            ? Number(
                (
                  (item.requests /
                    totalRequests) *
                  100
                ).toFixed(1),
              )
            : 0,
      }),
    );

  const mostRequestedCategory =
    categoryDistribution[0] || null;

  /*
   * Average provider rating.
   */
  const averageProviderRating =
    providerRatingData[0]?.averageRating;

  /*
   * Completion rate.
   */
  const completedRequests =
    requestCompletionData.find(
      (item) =>
        item._id === "Completed",
    )?.count || 0;

  const cancelledRequests =
    requestCompletionData.find(
      (item) =>
        item._id === "Cancelled",
    )?.count || 0;

  const finalisedRequests =
    completedRequests +
    cancelledRequests;

  const completionRate =
    finalisedRequests > 0
      ? Number(
          (
            (completedRequests /
              finalisedRequests) *
            100
          ).toFixed(1),
        )
      : null;

  /*
   * Revenue trend formatting.
   */
  const revenueTrends =
    revenueTrendData.map((item) => {
      const month = String(
        item._id.month,
      ).padStart(2, "0");

      return {
        period: `${item._id.year}-${month}`,
        revenue: item.revenue || 0,
      };
    });

  return {
    summary: {
      mostRequested: mostRequestedCategory
        ? {
            category:
              mostRequestedCategory.category,

            requests:
              mostRequestedCategory.requests,

            percentage:
              mostRequestedCategory.percentage,
          }
        : null,

      averageProviderRating:
        averageProviderRating !==
        undefined
          ? Number(
              averageProviderRating.toFixed(
                1,
              ),
            )
          : null,

      requestCompletionRate:
        completionRate,

      /*
       * No customer feedback/rating
       * data exists yet.
       */
      customerSatisfaction: null,
    },

    categoryDistribution,

    revenueTrends,
  };
};

const HOME_SERVICES_SETTINGS_ID =
  "HOME-SERVICES-SETTINGS";

const getOrCreateHomeServicesSettings =
  async (userId = null) => {
    let settings =
      await Service.findOne({
        recordType: "settings",
        recordId:
          HOME_SERVICES_SETTINGS_ID,
      });

    if (!settings) {
      settings = await Service.create({
        recordType: "settings",
        recordId:
          HOME_SERVICES_SETTINGS_ID,
        status: "Active",
        createdBy: userId || null,
        settings: {
          autoAssign: false,
          manualApproval: true,
          escalation: true,
          areas: [
            "Lagos",
            "Abuja",
            "Port Harcourt",
          ],
          notifications: {
            email: true,
            push: true,
            newRequests: true,
            providerOnboarding: true,
          },
        },
      });
    }

    return settings;
  };

exports.getHomeServicesSettings =
  async () => {
    const settings =
      await getOrCreateHomeServicesSettings();

    return {
      serviceConfig: {
        autoAssign:
          settings.settings?.autoAssign ??
          false,

        manualApproval:
          settings.settings?.manualApproval ??
          true,

        escalation:
          settings.settings?.escalation ??
          true,
      },

      areas:
        settings.settings?.areas || [],

      notifications: {
        email:
          settings.settings?.notifications
            ?.email ?? true,

        push:
          settings.settings?.notifications
            ?.push ?? true,

        newRequests:
          settings.settings?.notifications
            ?.newRequests ?? true,

        providerOnboarding:
          settings.settings?.notifications
            ?.providerOnboarding ?? true,
      },
    };
  };

exports.updateHomeServicesSettings =
  async (data, userId) => {
    const settings =
      await getOrCreateHomeServicesSettings(
        userId,
      );

    if (
      data.serviceConfig &&
      typeof data.serviceConfig ===
        "object"
    ) {
      if (
        data.serviceConfig.autoAssign !==
        undefined
      ) {
        settings.settings.autoAssign =
          Boolean(
            data.serviceConfig.autoAssign,
          );
      }

      if (
        data.serviceConfig
          .manualApproval !==
        undefined
      ) {
        settings.settings.manualApproval =
          Boolean(
            data.serviceConfig
              .manualApproval,
          );
      }

      if (
        data.serviceConfig.escalation !==
        undefined
      ) {
        settings.settings.escalation =
          Boolean(
            data.serviceConfig.escalation,
          );
      }
    }

    if (Array.isArray(data.areas)) {
      settings.settings.areas =
        data.areas
          .filter(
            (area) =>
              typeof area === "string",
          )
          .map((area) => area.trim())
          .filter(Boolean);
    }

    if (
      data.notifications &&
      typeof data.notifications ===
        "object"
    ) {
      if (
        data.notifications.email !==
        undefined
      ) {
        settings.settings.notifications.email =
          Boolean(
            data.notifications.email,
          );
      }

      if (
        data.notifications.push !==
        undefined
      ) {
        settings.settings.notifications.push =
          Boolean(
            data.notifications.push,
          );
      }

      if (
        data.notifications.newRequests !==
        undefined
      ) {
        settings.settings.notifications.newRequests =
          Boolean(
            data.notifications
              .newRequests,
          );
      }

      if (
        data.notifications
          .providerOnboarding !==
        undefined
      ) {
        settings.settings.notifications.providerOnboarding =
          Boolean(
            data.notifications
              .providerOnboarding,
          );
      }
    }

    settings.updatedBy =
      userId || null;

    await settings.save();

    return {
      serviceConfig: {
        autoAssign:
          settings.settings.autoAssign,

        manualApproval:
          settings.settings.manualApproval,

        escalation:
          settings.settings.escalation,
      },

      areas:
        settings.settings.areas,

      notifications:
        settings.settings.notifications,
    };
  };

