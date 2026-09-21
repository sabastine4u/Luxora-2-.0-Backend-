const service = require("../services/super-admin.service");
const api = require("../utils/api-response");

exports.getOverview = async (req, res, next) => { try { return api.success(res, { overview: await service.getOverview() }, "Super Admin overview retrieved successfully"); } catch (error) { return next(error); } };
exports.getCounts = async (req, res, next) => { try { return api.success(res, { counts: await service.getCounts() }, "Super Admin counts retrieved successfully"); } catch (error) { return next(error); } };
