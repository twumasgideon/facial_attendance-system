const User = require('../models/User');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const { ok } = require('../utils/response');

async function syncFaces(req, res) {
  const since = req.query.since ? new Date(req.query.since) : null;
  const branchCode = req.query.branchCode;

  const userFilter = { employmentStatus: { $in: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'] } };
  if (since && !Number.isNaN(since.getTime())) {
    userFilter.updatedAt = { $gte: since };
  }
  if (branchCode) {
    const branch = await Branch.findOne({ code: String(branchCode).toUpperCase() });
    if (branch) userFilter.branch = branch._id;
  }

  const [users, departments, branches] = await Promise.all([
    User.find(userFilter)
      .select('+faceEmbedding')
      .populate('department', 'code name')
      .populate('branch', 'code name organizationName')
      .sort({ updatedAt: 1 }),
    Department.find({ isActive: true }).populate('branch', 'code'),
    Branch.find({ isActive: true }),
  ]);

  return ok(res, {
    syncedAt: new Date().toISOString(),
    users: users.map((u) => ({
      ...u.toSafeJSON(),
      faceEmbedding: u.faceEmbedding || [],
      department: u.department,
      branch: u.branch,
      updatedAt: u.updatedAt,
      deleted: u.employmentStatus === 'TERMINATED',
    })),
    departments,
    branches,
  });
}

async function listEmployees(req, res) {
  const q = (req.query.q || '').trim();
  const filter = { employmentStatus: { $ne: 'TERMINATED' } };
  if (q) {
    filter.$or = [
      { fullName: new RegExp(q, 'i') },
      { employeeId: new RegExp(q, 'i') },
    ];
  }

  const users = await User.find(filter)
    .populate('department', 'code name')
    .populate('branch', 'code name')
    .sort({ fullName: 1 })
    .limit(Math.min(Number(req.query.limit) || 100, 500));

  return ok(res, { users: users.map((u) => u.toSafeJSON()) });
}

module.exports = {
  syncFaces,
  listEmployees,
};
