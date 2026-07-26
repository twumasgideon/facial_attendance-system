const { body, param } = require('express-validator');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const { hashPassword } = require('../utils/auth');
const { ok, fail } = require('../utils/response');
const { validate } = require('../middleware/validate');
const { ensureDefaultBranch } = require('../utils/ensureDefaults');

const ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER'];

function normalizePhoto(photoBase64) {
  if (!photoBase64 || typeof photoBase64 !== 'string') return '';
  const trimmed = photoBase64.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

/** Lightweight placeholder embedding until on-device FaceNet lands in P1. */
function placeholderEmbedding(seed) {
  const out = [];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 32; i += 1) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out.push((h % 1000) / 1000);
  }
  return out;
}

async function resolveDepartment(branchId, departmentCode, departmentName) {
  const code = (departmentCode || 'GEN').toUpperCase().trim();
  const name = (departmentName || 'General').trim();
  let dept = await Department.findOne({ code, branch: branchId });
  if (!dept) {
    dept = await Department.create({ code, name, branch: branchId });
  } else if (departmentName && dept.name !== name) {
    dept.name = name;
    await dept.save();
  }
  return dept;
}

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
  if (req.query.branchCode) {
    const branch = await Branch.findOne({ code: String(req.query.branchCode).toUpperCase() });
    if (branch) filter.branch = branch._id;
  }

  const users = await User.find(filter)
    .populate('department', 'code name')
    .populate('branch', 'code name organizationName')
    .sort({ fullName: 1 })
    .limit(Math.min(Number(req.query.limit) || 100, 500));

  return ok(res, { users: users.map((u) => u.toSafeJSON()) });
}

async function getEmployee(req, res) {
  const user = await User.findOne({ employeeId: req.params.employeeId.toUpperCase() })
    .populate('department', 'code name')
    .populate('branch', 'code name organizationName');
  if (!user || user.employmentStatus === 'TERMINATED') {
    return fail(res, 'Employee not found', 404);
  }
  return ok(res, { user: user.toSafeJSON() });
}

const createValidators = [
  body('employeeId').optional({ nullable: true }).isString().trim(),
  body('fullName').isString().trim().notEmpty(),
  body('branchCode').optional().isString().trim(),
  body('email').optional({ nullable: true }).isEmail(),
  body('phone').optional().isString(),
  body('position').optional().isString(),
  body('departmentCode').optional().isString(),
  body('departmentName').optional().isString(),
  body('photoBase64').optional().isString(),
  body('role').optional().isIn(['EMPLOYEE', 'SUPERVISOR', 'BRANCH_MANAGER', 'HR_ADMIN']),
];

/** Next Church Member ID like CM001, CM002… */
async function nextChurchMemberId() {
  const users = await User.find({ employeeId: /^CM\d+$/i })
    .select('employeeId')
    .lean();
  let max = 0;
  for (const u of users) {
    const n = Number(String(u.employeeId).replace(/^CM/i, ''));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `CM${String(max + 1).padStart(3, '0')}`;
}

async function createEmployee(req, res) {
  const {
    employeeId,
    fullName,
    email,
    phone = '',
    position = '',
    departmentCode,
    departmentName,
    branchCode,
    photoBase64,
    role = 'EMPLOYEE',
  } = req.body;

  let id = String(employeeId || '')
    .toUpperCase()
    .trim();
  if (!id) {
    id = await nextChurchMemberId();
  }

  const existing = await User.findOne({ employeeId: id });
  if (existing) {
    return fail(res, 'Church Member ID already exists', 409);
  }

  const phoneTrimmed = String(phone || '').trim();
  if (!phoneTrimmed) {
    return fail(res, 'Registered phone number is required', 400);
  }

  let branch = null;
  if (branchCode) {
    branch = await Branch.findOne({ code: String(branchCode).toUpperCase(), isActive: true });
  }
  if (!branch) {
    ({ branch } = await ensureDefaultBranch());
  }

  const safeEmail = (email || `${id.toLowerCase()}@kasse.cop.local`).toLowerCase().trim();
  const emailTaken = await User.findOne({ email: safeEmail });
  if (emailTaken) {
    return fail(res, 'Email already in use', 409);
  }

  const dept = await resolveDepartment(branch._id, departmentCode, departmentName);
  const photoUrl = normalizePhoto(photoBase64);
  const hasFace = !!photoUrl;

  const user = await User.create({
    employeeId: id,
    fullName: fullName.trim(),
    email: safeEmail,
    passwordHash: await hashPassword('Employee123!'),
    phone: phoneTrimmed,
    role,
    department: dept._id,
    branch: branch._id,
    position: String(position || '').trim(),
    photoUrl,
    faceStatus: hasFace ? 'REGISTERED' : 'PENDING',
    faceEmbedding: hasFace ? placeholderEmbedding(`${id}:${photoUrl.slice(0, 64)}`) : undefined,
    employmentStatus: 'ACTIVE',
    registeredAt: new Date(),
  });

  await user.populate('department', 'code name');
  await user.populate('branch', 'code name organizationName');

  return ok(res, { user: user.toSafeJSON(), memberId: id }, 201);
}

const updateValidators = [
  param('employeeId').isString().trim().notEmpty(),
  body('fullName').optional().isString().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('position').optional().isString(),
  body('departmentCode').optional().isString(),
  body('departmentName').optional().isString(),
  body('branchCode').optional().isString(),
  body('photoBase64').optional().isString(),
  body('employmentStatus').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED']),
  body('faceStatus').optional().isIn(['PENDING', 'REGISTERED', 'FAILED', 'INACTIVE']),
];

async function updateEmployee(req, res) {
  const user = await User.findOne({ employeeId: req.params.employeeId.toUpperCase() });
  if (!user) {
    return fail(res, 'Employee not found', 404);
  }

  if (req.body.fullName) user.fullName = req.body.fullName.trim();
  if (req.body.email) {
    const email = req.body.email.toLowerCase().trim();
    const taken = await User.findOne({ email, _id: { $ne: user._id } });
    if (taken) return fail(res, 'Email already in use', 409);
    user.email = email;
  }
  if (req.body.phone !== undefined) user.phone = String(req.body.phone).trim();
  if (req.body.position !== undefined) user.position = String(req.body.position).trim();
  if (req.body.employmentStatus) user.employmentStatus = req.body.employmentStatus;

  if (req.body.branchCode) {
    const branch = await Branch.findOne({ code: String(req.body.branchCode).toUpperCase(), isActive: true });
    if (!branch) return fail(res, 'Branch not found', 404);
    user.branch = branch._id;
  }

  if (req.body.departmentCode || req.body.departmentName) {
    const branchId = user.branch;
    const dept = await resolveDepartment(branchId, req.body.departmentCode, req.body.departmentName);
    user.department = dept._id;
  }

  if (req.body.photoBase64) {
    const photoUrl = normalizePhoto(req.body.photoBase64);
    user.photoUrl = photoUrl;
    user.faceStatus = 'REGISTERED';
    user.faceEmbedding = placeholderEmbedding(`${user.employeeId}:${photoUrl.slice(0, 64)}`);
  } else if (req.body.faceStatus) {
    user.faceStatus = req.body.faceStatus;
  }

  await user.save();
  await user.populate('department', 'code name');
  await user.populate('branch', 'code name organizationName');

  return ok(res, { user: user.toSafeJSON() });
}

async function deactivateEmployee(req, res) {
  const user = await User.findOne({ employeeId: req.params.employeeId.toUpperCase() });
  if (!user) {
    return fail(res, 'Employee not found', 404);
  }
  user.employmentStatus = 'TERMINATED';
  user.faceStatus = 'INACTIVE';
  await user.save();
  return ok(res, { user: user.toSafeJSON() });
}

module.exports = {
  ADMIN_ROLES,
  validate,
  syncFaces,
  listEmployees,
  getEmployee,
  createValidators,
  createEmployee,
  updateValidators,
  updateEmployee,
  deactivateEmployee,
};
