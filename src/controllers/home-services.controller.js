const homeServicesService = require("../services/home-services.service");
const { success } = require("../utils/api-response");

exports.getOverview = async (
  req,
  res,
  next,
) => {
  try {
    const overview =
      await homeServicesService.getOverview();

    return success(
      res,
      {
        overview,
      },
      "Home Services overview retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.getServiceRequests = async (
  req,
  res,
  next,
) => {
  try {
    const requests =
      await homeServicesService.getServiceRequests(
        req.query,
      );

    return success(
      res,
      { requests },
      "Service requests retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.createServiceRequest = async (
  req,
  res,
  next,
) => {
  try {
    const request =
      await homeServicesService.createServiceRequest(
        req.body,
        req.user?._id,
      );

    return success(
      res,
      { request },
      "Service request created successfully",
      201,
    );
  } catch (error) {
    next(error);
  }
};

exports.assignServiceRequest = async (
  req,
  res,
  next,
) => {
  try {
    const request =
      await homeServicesService.assignServiceRequest(
        req.params.requestId,
        req.body,
        req.user?._id,
      );

    return success(
      res,
      { request },
      "Provider assigned successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.rejectServiceRequest = async (
  req,
  res,
  next,
) => {
  try {
    const request =
      await homeServicesService.rejectServiceRequest(
        req.params.requestId,
        req.user?._id,
        req.body?.reason,
      );

    return success(
      res,
      { request },
      "Service request rejected successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.getServiceProviders = async (
  req,
  res,
  next,
) => {
  try {
    const providers =
      await homeServicesService.getServiceProviders(
        req.query,
      );

    return success(
      res,
      { providers },
      "Service providers retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.createServiceProvider = async (
  req,
  res,
  next,
) => {
  try {
    const provider =
      await homeServicesService.createServiceProvider(
        req.body,
        req.user?._id,
      );

    return success(
      res,
      { provider },
      "Service provider onboarding submitted successfully",
      201,
    );
  } catch (error) {
    next(error);
  }
};

exports.approveServiceProvider = async (
  req,
  res,
  next,
) => {
  try {
    const provider =
      await homeServicesService.approveServiceProvider(
        req.params.providerId,
        req.user?._id,
      );

    return success(
      res,
      { provider },
      "Service provider approved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.suspendServiceProvider = async (
  req,
  res,
  next,
) => {
  try {
    const provider =
      await homeServicesService.suspendServiceProvider(
        req.params.providerId,
        req.user?._id,
      );

    return success(
      res,
      { provider },
      "Service provider suspended successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.getServiceBookings = async (
  req,
  res,
  next,
) => {
  try {
    const bookings =
      await homeServicesService.getServiceBookings(
        req.query,
      );

    return success(
      res,
      { bookings },
      "Service bookings retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.updateServiceBookingStatus = async (
  req,
  res,
  next,
) => {
  try {
    const booking =
      await homeServicesService.updateServiceBookingStatus(
        req.params.bookingId,
        req.body.status,
        req.user?._id,
      );

    return success(
      res,
      { booking },
      "Booking status updated successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.createBookingFromRequest = async (
  req,
  res,
  next,
) => {
  try {
    const booking =
      await homeServicesService.createBookingFromRequest(
        req.params.requestId,
        req.body,
        req.user?._id,
      );

    return success(
      res,
      { booking },
      "Service booking created successfully",
      201,
    );
  } catch (error) {
    next(error);
  }
};

exports.getServiceCategories = async (
  req,
  res,
  next,
) => {
  try {
    const categories =
      await homeServicesService.getServiceCategories();

    return success(
      res,
      { categories },
      "Service categories retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.createServiceCategory = async (
  req,
  res,
  next,
) => {
  try {
    const category =
      await homeServicesService.createServiceCategory(
        req.body,
        req.user?._id,
      );

    return success(
      res,
      { category },
      "Service category created successfully",
      201,
    );
  } catch (error) {
    next(error);
  }
};

exports.updateServiceCategory = async (
  req,
  res,
  next,
) => {
  try {
    const category =
      await homeServicesService.updateServiceCategory(
        req.params.categoryId,
        req.body,
        req.user?._id,
      );

    return success(
      res,
      { category },
      "Service category updated successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.toggleServiceCategory = async (
  req,
  res,
  next,
) => {
  try {
    const category =
      await homeServicesService.toggleServiceCategory(
        req.params.categoryId,
        req.user?._id,
      );

    return success(
      res,
      { category },
      "Service category status updated successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.getFinancials = async (
  req,
  res,
  next,
) => {
  try {
    const financials =
      await homeServicesService.getFinancials();

    return success(
      res,
      { financials },
      "Home Services financials retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.createRevenueTransactionFromBooking =
  async (req, res, next) => {
    try {
      const transaction =
        await homeServicesService.createRevenueTransactionFromBooking(
          req.params.bookingId,
          req.user?._id,
        );

      return success(
        res,
        { transaction },
        "Revenue transaction created successfully",
        201,
      );
    } catch (error) {
      next(error);
    }
  };

  exports.getAnalytics = async (
  req,
  res,
  next,
) => {
  try {
    const analytics =
      await homeServicesService.getAnalytics();

    return success(
      res,
      { analytics },
      "Home Services analytics retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

exports.getHomeServicesSettings =
  async (req, res, next) => {
    try {
      const settings =
        await homeServicesService.getHomeServicesSettings();

      return success(
        res,
        { settings },
        "Home Services settings retrieved successfully",
      );
    } catch (error) {
      next(error);
    }
  };

exports.updateHomeServicesSettings =
  async (req, res, next) => {
    try {
      const settings =
        await homeServicesService.updateHomeServicesSettings(
          req.body,
          req.user?._id,
        );

      return success(
        res,
        { settings },
        "Home Services settings updated successfully",
      );
    } catch (error) {
      next(error);
    }
  };

  
  
