const { body } = require('express-validator');
const Branch = require('../models/Branch');
const { ok, fail } = require('../utils/response');
const { validate } = require('../middleware/validate');

const createValidators = [
  body('code').isString().trim().notEmpty(),
  body('name').isString().trim().notEmpty(),
  body('organizationName').isString().trim().notEmpty(),
  body('address').optional().isString(),
  body('timezone').optional().isString(),
];

async function listBranches(_req, res) {
  const branches = await Branch.find({ isActive: true }).sort({ name: 1 });
  return ok(res, { branches });
}

async function createBranch(req, res) {
  const code = req.body.code.toUpperCase().trim();
  const existing = await Branch.findOne({ code });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.name = req.body.name.trim();
      existing.organizationName = req.body.organizationName.trim();
      if (req.body.address !== undefined) existing.address = req.body.address;
      if (req.body.timezone) existing.timezone = req.body.timezone;
      await existing.save();
      return ok(res, { branch: existing });
    }
    return fail(res, 'Branch code already exists', 409);
  }

  const branch = await Branch.create({
    code,
    name: req.body.name.trim(),
    organizationName: req.body.organizationName.trim(),
    address: req.body.address || '',
    timezone: req.body.timezone || 'Africa/Accra',
  });

  return ok(res, { branch }, 201);
}

module.exports = {
  validate,
  createValidators,
  listBranches,
  createBranch,
};
