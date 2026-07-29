const { body } = require('express-validator');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { ok, fail } = require('../utils/response');
const { validate } = require('../middleware/validate');
const { ensureDevice } = require('../utils/ensureDefaults');
const { embeddingFromPhoto, findBestFaceMatch } = require('../utils/faceMatch');
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
  parseGhanaDateKey,
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
  body('employeeId').optional({ nullable: true }).isString().trim(),
  body('deviceId').optional().isString().trim(),
  body('attendanceType').isIn(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  body('timestamp').isISO8601(),
  body('faceScore').optional().isFloat({ min: 0, max: 100 }),
  body('branch').optional().isString(),
  body('clientEventId').optional().isString(),
  body('faceImageBase64').optional().isString(),
];

/**
 * Resolve member by typed ID (legacy) or by matching live face to registered faces.
 */
async function resolveAttendanceUser(employeeId, faceImageBase64) {
  const id = String(employeeId || '')
    .toUpperCase()
    .trim();
  const photo = normalizePhoto(faceImageBase64);

  if (id) {
    const user = await User.findOne({ employeeId: id }).populate('department');
    if (!user) return { error: ['Member not found', 404] };
    if (user.faceStatus !== 'REGISTERED') {
      return { error: ['Face not registered for this member. Register their face first.', 400] };
    }
    return { user, matchConfidence: null };
  }

  if (!photo) {
    return { error: ['Face capture is required to identify the member', 400] };
  }

  const probe = embeddingFromPhoto(photo);
  if (!probe.length) {
    return { error: ['Could not read face photo. Try again with better lighting.', 400] };
  }

  const registered = await User.find({
    employmentStatus: 'ACTIVE',
    faceStatus: 'REGISTERED',
  })
    .select('+faceEmbedding')
    .populate('department');

  const candidates = [];
  for (const u of registered) {
    let emb = u.faceEmbedding;
    // Rebuild embedding from stored photo if missing / old placeholder length.
    if ((!emb || emb.length < 64) && u.photoUrl) {
      emb = embeddingFromPhoto(u.photoUrl);
      if (emb.length) {
        u.faceEmbedding = emb;
        await u.save();
      }
    }
    if (emb?.length) candidates.push({ user: u, embedding: emb });
  }

  const match = findBestFaceMatch(probe, candidates);
  if (!match) {
    return {
      error: [
        'Face not recognized. Register this member first, or retake with face clearly in the frame.',
        404,
      ],
    };
  }

  return { user: match.user, matchConfidence: match.confidence };
}

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

  const resolved = await resolveAttendanceUser(employeeId, faceImageBase64);
  if (resolved.error) {
    return fail(res, resolved.error[0], resolved.error[1]);
  }
  const { user, matchConfidence } = resolved;

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
    typeof faceScore === 'number'
      ? faceScore
      : typeof matchConfidence === 'number'
        ? matchConfidence
        : capturedSnapshot
          ? 96
          : undefined;

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
      recognizedByFace: !String(employeeId || '').trim(),
      matchConfidence: matchConfidence ?? null,
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

async function todayAttendance(req, res) {
  await runAutoClockOut(new Date());
  const dateParam = req.query.date;
  let forDate = new Date();
  if (dateParam) {
    const parsed = parseGhanaDateKey(dateParam);
    if (!parsed) return fail(res, 'Invalid date. Use YYYY-MM-DD', 400);
    forDate = parsed;
  }
  const report = await buildServiceReport(forDate);
  return ok(res, report);
}

/**
 * Present / late / absent for a service day (Ghana), with phones + towns.
 * Absent = active members registered on/before that day who did not clock in.
 */
async function buildServiceReport(forDate = new Date()) {
  const { start, end, dateKey } = ghanaDayBounds(forDate);
  const todayKey = ghanaDateKey(new Date());
  const serviceEnded = dateKey < todayKey ? true : isPastAutoClockOut(forDate);

  const [clockIns, members] = await Promise.all([
    Attendance.find({
      attendanceType: 'CLOCK_IN',
      timestamp: { $gte: start, $lte: end },
    })
      .sort({ timestamp: 1 })
      .populate('branch', 'code name'),
    User.find({
      employmentStatus: 'ACTIVE',
      role: { $in: ['EMPLOYEE', 'SUPERVISOR'] },
      registeredAt: { $lte: end },
    })
      .select('employeeId fullName phone town faceStatus employmentStatus position')
      .sort({ fullName: 1 }),
  ]);

  const memberById = new Map(
    members.map((m) => [
      m.employeeId,
      { phone: m.phone || '', town: m.town || '' },
    ]),
  );
  const present = [];
  const late = [];
  const seen = new Set();

  for (const record of clockIns) {
    if (seen.has(record.employeeId)) continue;
    seen.add(record.employeeId);
    const info = memberById.get(record.employeeId) || { phone: '', town: '' };
    const row = {
      ...serializeAttendance(record),
      memberId: record.employeeId,
      phone: info.phone,
      town: info.town,
      clockOut: null,
    };
    const out = await findTodaysClockOut(record.employeeId, forDate);
    if (out) row.clockOut = serializeAttendance(out);
    if (record.status === 'LATE') late.push(row);
    else present.push(row);
  }

  const absent = members
    .filter((m) => !seen.has(m.employeeId))
    .map((m) => ({
      memberId: m.employeeId,
      employeeId: m.employeeId,
      fullName: m.fullName,
      phone: m.phone || '',
      town: m.town || '',
      faceStatus: m.faceStatus,
      position: m.position || 'Member',
      status: 'ABSENT',
    }));

  return {
    dateKey,
    timezone: 'Africa/Accra',
    serviceEnded,
    live: dateKey === todayKey,
    schedule: {
      serviceStart: '07:30 AM',
      lateAfter: '09:30 AM',
      serviceEnd: '02:00 PM',
      assembly: SCHEDULE.assemblyName,
    },
    summary: {
      present: present.length,
      late: late.length,
      absent: absent.length,
      totalRegistered: members.length,
      attended: present.length + late.length,
    },
    present,
    late,
    absent,
  };
}

/** List saved service days (from clock-ins) with rollup counts — newest first. */
async function listSessions(req, res) {
  await runAutoClockOut(new Date());
  const limit = Math.min(Number(req.query.limit) || 60, 120);

  const clockIns = await Attendance.find({ attendanceType: 'CLOCK_IN' })
    .select('employeeId timestamp status')
    .sort({ timestamp: -1 })
    .lean();

  const byDay = new Map();
  for (const row of clockIns) {
    const key = ghanaDateKey(row.timestamp);
    if (!byDay.has(key)) {
      byDay.set(key, { dateKey: key, onTime: 0, late: 0, attendedIds: new Set() });
    }
    const day = byDay.get(key);
    if (day.attendedIds.has(row.employeeId)) continue;
    day.attendedIds.add(row.employeeId);
    if (row.status === 'LATE') day.late += 1;
    else day.onTime += 1;
  }

  const sessions = [];
  for (const [key, day] of byDay) {
    const { end } = ghanaDayBounds(parseGhanaDateKey(key));
    const registered = await User.countDocuments({
      employmentStatus: 'ACTIVE',
      role: { $in: ['EMPLOYEE', 'SUPERVISOR'] },
      registeredAt: { $lte: end },
    });
    const attended = day.onTime + day.late;
    sessions.push({
      dateKey: key,
      onTime: day.onTime,
      late: day.late,
      attended,
      absent: Math.max(0, registered - attended),
      totalRegistered: registered,
    });
    if (sessions.length >= limit) break;
  }

  // byDay is insertion-ordered from newest clock-ins; keep newest first
  return ok(res, {
    timezone: 'Africa/Accra',
    count: sessions.length,
    sessions,
  });
}

/**
 * Punctuality analysis across service dates — pie totals + per-member rates.
 * Query: from=YYYY-MM-DD&to=YYYY-MM-DD (defaults: last 30 Ghana days with activity, or calendar 30 days).
 */
async function attendanceAnalytics(req, res) {
  await runAutoClockOut(new Date());

  const todayKey = ghanaDateKey(new Date());
  let toKey = String(req.query.to || todayKey).trim();
  let fromKey = String(req.query.from || '').trim();

  if (!parseGhanaDateKey(toKey)) return fail(res, 'Invalid to date', 400);

  if (!fromKey) {
    const toDate = parseGhanaDateKey(toKey);
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 60);
    fromKey = ghanaDateKey(fromDate);
  }
  if (!parseGhanaDateKey(fromKey)) return fail(res, 'Invalid from date', 400);
  if (fromKey > toKey) return fail(res, 'from must be on or before to', 400);

  const fromBound = ghanaDayBounds(parseGhanaDateKey(fromKey)).start;
  const toBound = ghanaDayBounds(parseGhanaDateKey(toKey)).end;

  const [clockIns, members] = await Promise.all([
    Attendance.find({
      attendanceType: 'CLOCK_IN',
      timestamp: { $gte: fromBound, $lte: toBound },
    })
      .select('employeeId fullName timestamp status')
      .lean(),
    User.find({
      employmentStatus: 'ACTIVE',
      role: { $in: ['EMPLOYEE', 'SUPERVISOR'] },
    })
      .select('employeeId fullName phone town registeredAt')
      .lean(),
  ]);

  const dayMap = new Map();
  for (const row of clockIns) {
    const key = ghanaDateKey(row.timestamp);
    if (!dayMap.has(key)) dayMap.set(key, new Map());
    const people = dayMap.get(key);
    if (people.has(row.employeeId)) continue;
    people.set(row.employeeId, row.status === 'LATE' ? 'LATE' : 'ON_TIME');
  }

  // Prefer days that had at least one clock-in; if none, still report empty pie
  const serviceKeys = [...dayMap.keys()].sort();
  const memberStats = new Map(
    members.map((m) => [
      m.employeeId,
      {
        employeeId: m.employeeId,
        fullName: m.fullName,
        phone: m.phone || '',
        town: m.town || '',
        onTime: 0,
        late: 0,
        absent: 0,
        servicesExpected: 0,
      },
    ]),
  );

  let totalOnTime = 0;
  let totalLate = 0;
  let totalAbsent = 0;

  for (const key of serviceKeys) {
    const { end } = ghanaDayBounds(parseGhanaDateKey(key));
    const dayPeople = dayMap.get(key);
    const eligible = members.filter((m) => !m.registeredAt || new Date(m.registeredAt) <= end);

    for (const m of eligible) {
      const stat = memberStats.get(m.employeeId);
      if (!stat) continue;
      stat.servicesExpected += 1;
      const status = dayPeople.get(m.employeeId);
      if (status === 'LATE') {
        stat.late += 1;
        totalLate += 1;
      } else if (status === 'ON_TIME') {
        stat.onTime += 1;
        totalOnTime += 1;
      } else {
        stat.absent += 1;
        totalAbsent += 1;
      }
    }
  }

  const memberRows = [...memberStats.values()]
    .filter((m) => m.servicesExpected > 0)
    .map((m) => {
      const attended = m.onTime + m.late;
      const punctualRate =
        m.servicesExpected > 0 ? Math.round((m.onTime / m.servicesExpected) * 1000) / 10 : 0;
      const attendanceRate =
        m.servicesExpected > 0 ? Math.round((attended / m.servicesExpected) * 1000) / 10 : 0;
      return { ...m, punctualRate, attendanceRate };
    })
    .sort((a, b) => b.punctualRate - a.punctualRate || b.attendanceRate - a.attendanceRate);

  const total = totalOnTime + totalLate + totalAbsent;

  return ok(res, {
    timezone: 'Africa/Accra',
    range: { from: fromKey, to: toKey },
    servicesCounted: serviceKeys.length,
    serviceDates: serviceKeys,
    totals: {
      onTime: totalOnTime,
      late: totalLate,
      absent: totalAbsent,
      total,
    },
    pie: [
      {
        key: 'onTime',
        label: 'Punctual (on time)',
        value: totalOnTime,
        percent: total ? Math.round((totalOnTime / total) * 1000) / 10 : 0,
        color: '#16A34A',
      },
      {
        key: 'late',
        label: 'Late',
        value: totalLate,
        percent: total ? Math.round((totalLate / total) * 1000) / 10 : 0,
        color: '#DC2626',
      },
      {
        key: 'absent',
        label: 'Absent',
        value: totalAbsent,
        percent: total ? Math.round((totalAbsent / total) * 1000) / 10 : 0,
        color: '#64748B',
      },
    ],
    members: memberRows,
    mostPunctual: memberRows.filter((m) => m.onTime > 0).slice(0, 10),
    oftenLate: [...memberRows].sort((a, b) => b.late - a.late || b.absent - a.absent).slice(0, 10),
    oftenAbsent: [...memberRows].sort((a, b) => b.absent - a.absent).slice(0, 10),
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
  const report = await buildServiceReport(new Date());
  return ok(res, {
    ...result,
    report,
    message: result.ran
      ? `Service closed. Auto clock-out: ${result.clockedOut}. Present: ${report.summary.attended}, Absent: ${report.summary.absent}`
      : 'Auto clock-out not due yet (before 2:00 PM Ghana time)',
  });
}

module.exports = {
  createValidators,
  validate,
  createAttendance,
  listAttendance,
  todayAttendance,
  listSessions,
  attendanceAnalytics,
  autoClockOut,
  runAutoClockOut,
  buildServiceReport,
};
