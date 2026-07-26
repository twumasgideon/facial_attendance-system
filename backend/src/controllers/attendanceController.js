const { body } = require('express-validator');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Device = require('../models/Device');
const Branch = require('../models/Branch');
const { ok, fail } = require('../utils/response');
const { validate } = require('../middleware/validate');

function normalizePhoto(photoBase64) {
  if (!photoBase64 || typeof photoBase64 !== 'string') return '';
  const trimmed = photoBase64.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

const createValidators = [
  body('employeeId').isString().trim().notEmpty(),
  body('deviceId').isString().trim().notEmpty(),
  body('attendanceType').isIn(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  body('timestamp').isISO8601(),
  body('faceScore').optional().isFloat({ min: 0, max: 100 }),
  body('branch').optional().isString(),
  body('clientEventId').optional().isString(),
  body('faceImageBase64').optional().isString(),
];

async function createAttendance(req, res) {
  const {
    employeeId,
    deviceId,
    attendanceType,
    timestamp,
    faceScore,
    branch: branchCode,
    clientEventId,
    gps,
    imageSnapshotUrl,
    faceImageBase64,
  } = req.body;

  if (clientEventId) {
    const existing = await Attendance.findOne({ clientEventId, deviceId: deviceId.toUpperCase() });
    if (existing) {
      return ok(res, { attendance: existing, deduplicated: true });
    }
  }

  const user = await User.findOne({ employeeId: employeeId.toUpperCase() }).populate('department');
  if (!user) {
    return fail(res, 'Employee not found', 404);
  }

  if (user.faceStatus !== 'REGISTERED') {
    return fail(res, 'Face not registered for this employee. Register their face first.', 400);
  }

  const device = await Device.findOne({ deviceId: deviceId.toUpperCase() });
  if (!device) {
    return fail(res, 'Device not found', 404);
  }
  if (!device.isAuthorized) {
    return fail(res, 'Device is not authorized', 403);
  }

  let branch = null;
  if (branchCode) {
    branch = await Branch.findOne({ code: String(branchCode).toUpperCase() });
  }
  if (!branch) {
    branch = await Branch.findById(device.branch);
  }
  if (!branch) {
    return fail(res, 'Branch not found', 404);
  }

  const capturedSnapshot = normalizePhoto(faceImageBase64) || imageSnapshotUrl || '';
  const resolvedFaceScore =
    typeof faceScore === 'number' ? faceScore : capturedSnapshot ? 96 : undefined;

  const attendance = await Attendance.create({
    employee: user._id,
    employeeId: user.employeeId,
    fullName: user.fullName,
    department: user.department?.name || '',
    branch: branch._id,
    device: device._id,
    deviceId: device.deviceId,
    attendanceType,
    timestamp: new Date(timestamp),
    faceScore: resolvedFaceScore,
    recognitionScore: resolvedFaceScore,
    gps,
    imageSnapshotUrl: capturedSnapshot,
    syncStatus: 'UPLOADED',
    clientEventId,
    status: 'OK',
  });

  return ok(
    res,
    {
      attendance,
      employee: {
        employeeId: user.employeeId,
        fullName: user.fullName,
        photoUrl: user.photoUrl || '',
        faceStatus: user.faceStatus,
      },
    },
    201,
  );
}

async function listAttendance(req, res) {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filter = {};
  if (req.query.employeeId) filter.employeeId = String(req.query.employeeId).toUpperCase();
  if (req.query.deviceId) filter.deviceId = String(req.query.deviceId).toUpperCase();
  if (req.query.type) filter.attendanceType = req.query.type;

  const records = await Attendance.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('branch', 'code name');

  return ok(res, { records });
}

module.exports = {
  createValidators,
  validate,
  createAttendance,
  listAttendance,
};
