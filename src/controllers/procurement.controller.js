const procurementService = require("../services/procurement.service");
const { success } = require("../utils/api-response");

exports.getOverview = async (req, res, next) => { try { return success(res, { overview: await procurementService.getOverview() }, "Procurement overview retrieved successfully"); } catch (error) { next(error); } };


exports.getReport = async (req, res, next) => { try { return success(res, { report: await procurementService.getReport() }, "Procurement report retrieved successfully"); } catch (error) { next(error); } };

// Sidebar badges need totals for every supported record type, including zeroes.
exports.getCounts = async (req, res, next) => { try { return success(res, { counts: await procurementService.getCounts() }, "Procurement counts retrieved successfully"); } catch (error) { next(error); } };


exports.list = async (req, res, next) => { try { return success(res, { records: await procurementService.list(req.params.recordType, req.query) }, "Procurement records retrieved successfully"); } catch (error) { next(error); } };


exports.create = async (req, res, next) => { try { return success(res, { record: await procurementService.create(req.params.recordType, req.body, req) }, "Procurement record created successfully", 201); } catch (error) { next(error); } };



exports.update = async (req, res, next) => { try { return success(res, { record: await procurementService.update(req.params.recordType, req.params.recordId, req.body, req) }, "Procurement record updated successfully"); } catch (error) { next(error); } };
