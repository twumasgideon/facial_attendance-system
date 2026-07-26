const { body } = require('express-validator');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { ok, fail } = require('../utils/response');
const { validate } = require('../middleware/validate');
const { ensureDevice } = require('../utils/ensureDefaults');
const {
  SCHEDULE,
  ghanaDayBounds,
  ghanaServiceEndDate,
  formatGhanaStamp,
  formatGhanaTime,
  evaluateClockIn,
  isPastAutoClockOut,
  welcomeFor,
  ghanaDateKey,
} = require('../utils/churchSchedule');

function normalizePhoto(photoBase64) {
  if (!photoBase64 || typeof photoBase64 !== 'string') return '';
  const trimmed = photoBase64.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

function serializeAttendance(record) {
  const plain = record.toObject ? record.toObject() : record;
  return {
    ...plain,
    stampedAt: formatGhanaStamp(plain.timestamp),
    stampedTime: formatGhanaTime(plain.timestamp),
    dateKey: ghanaDateKey(plain.timestamp),
  };
}

async function findTodaysClockIn(employeeId, now = new Date()) {
  const { start, end } = ghanaDayBounds(now);
  return Attendance.findOne({
    employeeId: employeeId.toUpperCase(),
    attendanceType: 'CLOCK_IN',
    timestamp: { $gte: start, $lte: end },
  }).sort({ timestamp: -1 });
}

async function findTodaysClockOut(employeeId, now = new Date()) {
  const { start, end } = ghanaDayBounds(now);
  return Attendance.findOne({
    employeeId: employeeId.toUpperCase(),
    attendanceType: 'CLOCK_OUT',
    timestamp: { $gte: start, $lte: end },
  }).sort({ timestamp: -1 });
}

/**
 * Auto clock-out everyone who clocked in today and has no clock-out yet.
 * Stamp time = 2:00 PM Ghana (or "now" if called later).
 */
async function runAutoClockOut(now = new Date()) {
  if (!isPastAutoClockOut(now)) {
    return { ran: false, clockedOut: 0, records: [] };
  }

  const { start, end, dateKey } = ghanaDayBounds(now);
  const serviceEnd = ghanaServiceEndDate(now);
  const stampAt = now > serviceEnd ? serviceEnd : now;

  const clockIns = await Attendance.find({
    attendanceType: 'CLOCK_IN',
    timestamp: { $gte: start, $lte: end },
  }).sort({ timestamp: 1 });

  const clockedOut = [];
  const seen = new Set();

  for (const clockIn of clockIns) {
    const id = clockIn.employeeId;
    if (seen.has(id)) continue;
    seen.add(id);

    const existingOut = await findTodaysClockOut(id, now);
    if (existingOut) continue;

    const clientEventId = `auto-out-${id}-${dateKey}`;
    const existingAuto = await Attendance.findOne({ clientEventId });
    if (existingAuto) continue;

    const record = await Attendance.create({
      employee: clockIn.employee,
      employeeId: clockIn.employeeId,
      fullName: clockIn.fullName,
      department: clockIn.department || '',
      branch: clockIn.branch,
      device: clockIn.device,
      deviceId: clockIn.deviceId,
      attendanceType: 'CLOCK_OUT',
      timestamp: stampAt,
      faceScore: clockIn.faceScore,
      recognitionScore: clockIn.recognitionScore,
      syncStatus: 'UPLOADED',
      clientEventId,
      status: 'OK',
    });

    clockedOut.push(serializeAttendance(record));
  }

  return { ran: true, clockedOut: clockedOut.length, records: clockedOut, stampedAt: formatGhanaStamp(stampAt) };
}

const createValidators = [
  body('employeeId').isString().trim().notEmpty(),
  body('deviceId').optional().isString().trim(),
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
    deviceId: rawDeviceId,
    attendanceType,
    timestamp,
    faceScore,
    clientEventId,
    gps,
    imageSnapshotUrl,
    faceImageBase64,
  } = req.body;

  // Keep the day's register clean: auto-close anyone still open after 2 PM.
  await runAutoClockOut(new Date());

  const deviceId = String(rawDeviceId || 'KASSE-PHONE').toUpperCase().trim();

  if (clientEventId) {
    const existing = await Attendance.findOne({ clientEventId, deviceId });
    if (existing) {
      return ok(res, { attendance: serializeAttendance(existing), deduplicated: true });
    }
  }

  const user = await User.findOne({ employeeId: employeeId.toUpperCase() }).populate('department');
  if (!user) {
    return fail(res, 'Employee not found', 404);
  }

  if (user.faceStatus !== 'REGISTERED') {
    return fail(res, 'Face not registered for this employee. Register their face first.', 400);
  }

  // Auto-create/authorize device — no manual Register Device step.
  const { device, branch } = await ensureDevice({
    deviceId,
    name: 'Kasse CoP Phone',
    platform: 'ANDROID',
  });

  const eventTime = new Date(timestamp);
  let status = 'OK';
  let welcome = null;

  if (attendanceType === 'CLOCK_IN') {
    const existingIn = await findTodaysClockIn(user.employeeId, eventTime);
    const existingOut = await findTodaysClockOut(user.employeeId, eventTime);
    if (existingIn && !existingOut) {
      return fail(
        res,
        `Already clocked in today at ${formatGhanaTime(existingIn.timestamp)} Ghana time.`,
        409,
      );
    }
    if (existingIn && existingOut) {
      return fail(res, 'Already completed attendance for today (clocked in and out).', 409);
    }

    const evalResult = evaluateClockIn(eventTime);
    if (!evalResult.allowed) {
      return fail(res, evalResult.reason, 400);
    }
    status = evalResult.status;
    welcome = welcomeFor(user.fullName);
  }

  if (attendanceType === 'CLOCK_OUT') {
    const existingIn = await findTodaysClockIn(user.employeeId, eventTime);
    if (!existingIn) {
      return fail(res, 'No clock-in found for today. Clock in first.', 400);
    }
    const existingOut = await findTodaysClockOut(user.employeeId, eventTime);
    if (existingOut) {
      return fail(
        res,
        `Already clocked out today at ${formatGhanaTime(existingOut.timestamp)} Ghana time.`,
        409,
      );
    }
    status = 'OK';
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
    timestamp: eventTime,
    faceScore: resolvedFaceScore,
    recognitionScore: resolvedFaceScore,
    gps,
    imageSnapshotUrl: capturedSnapshot,
    syncStatus: 'UPLOADED',
    clientEventId,
    status,
  });

  return ok(
    res,
    {
      attendance: serializeAttendance(attendance),
      employee: {
        employeeId: user.employeeId,
        fullName: user.fullName,
        photoUrl: user.photoUrl || '',
        faceStatus: user.faceStatus,
      },
      welcome,
      schedule: {
        timezone: 'Africa/Accra',
        serviceStart: '07:30',
        lateAfter: '09:30',
        serviceEnd: '14:00',
        assembly: SCHEDULE.assemblyName,
      },
    },
    201,
  );
}

async function listAttendance(req, res) {
  await runAutoClockOut(new Date());

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filter = {};
  if (req.query.employeeId) filter.employeeId = String(req.query.employeeId).toUpperCase();
  if (req.query.deviceId) filter.deviceId = String(req.query.deviceId).toUpperCase();
  if (req.query.type) filter.attendanceType = req.query.type;
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();

  const records = await Attendance.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('branch', 'code name');

  return ok(res, { records: records.map(serializeAttendance) });
}

async function todayAttendance(_req, res) {
  await runAutoClockOut(new Date());

  const { start, end, dateKey } = ghanaDayBounds(new Date());
  const clockIns = await Attendance.find({
    attendanceType: 'CLOCK_IN',
    timestamp: { $gte: start, $lte: end },
  })
    .sort({ timestamp: 1 })
    .populate('branch', 'code name');

  const present = [];
  const late = [];
  const seen = new Set();

  for (const record of clockIns) {
    if (seen.has(record.employeeId)) continue;
    seen.add(record.employeeId);
    const row = {
      ...serializeAttendance(record),
      clockOut: null,
    };
    const out = await findTodaysClockOut(record.employeeId);
    if (out) {
      row.clockOut = serializeAttendance(out);
    }
    if (record.status === 'LATE') late.push(row);
    else present.push(row);
  }

  return ok(res, {
    dateKey,
    timezone: 'Africa/Accra',
    schedule: {
      serviceStart: '07:30 AM',
      lateAfter: '09:30 AM',
      serviceEnd: '02:00 PM',
      assembly: SCHEDULE.assemblyName,
    },
    summary: {
      present: present.length,
      late: late.length,
      total: present.length + late.length,
    },
    present,
    late,
  });
}

async function autoClockOut(req, res) {
  const secret = process.env.CRON_SECRET || '';
  const provided = req.get('x-cron-secret') || req.query.secret || '';
  const cronOk = Boolean(secret) && provided === secret;
  const vercelCron = req.get('x-vercel-cron') === '1';
  const adminOk =
    req.user && ['SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER'].includes(req.user.role);

  if (!cronOk && !vercelCron && !adminOk) {
    return fail(res, 'Unauthorized', 401);
  }

  const result = await runAutoClockOut(new Date());
  return ok(res, {
    ...result,
    message: result.ran
      ? `Auto clock-out complete: ${result.clockedOut} member(s)`
      : 'Auto clock-out not due yet (before 2:00 PM Ghana time)',
  });
}

module.exports = {
  createValidators,
  validate,
  createAttendance,
  listAttendance,
  todayAttendance,
  autoClockOut,
  runAutoClockOut,
};
