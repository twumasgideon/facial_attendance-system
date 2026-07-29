/** Church of Pentecost — Kasse Assembly (Kumasi) attendance rules. Africa/Accra = Ghana time. */

const TIMEZONE = 'Africa/Accra';

const SCHEDULE = {
  serviceStart: { hour: 7, minute: 30 }, // service begins
  lateAfter: { hour: 9, minute: 30 }, // from 9:30 AM = LATE
  serviceEnd: { hour: 14, minute: 0 }, // 2:00 PM auto clock-out
  assemblyName: 'Church of Pentecost Kasse Assembly Kumasi',
  welcomeMessage:
    'Your presence welcome to the Church of Pentecost Kasse Assembly Kumasi',
};

function ghanaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: get('weekday'),
  };
}

/** Minutes since midnight in Ghana. */
function ghanaMinutes(date = new Date()) {
  const p = ghanaParts(date);
  return p.hour * 60 + p.minute;
}

function toMinutes(h, m) {
  return h * 60 + m;
}

function ghanaDateKey(date = new Date()) {
  const p = ghanaParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Start/end of the Ghana calendar day as UTC Date objects.
 * Accra is GMT year-round (UTC+0), so local midnight == UTC midnight.
 */
function ghanaDayBounds(date = new Date()) {
  const key = ghanaDateKey(date);
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(`${key}T23:59:59.999Z`);
  return { start, end, dateKey: key };
}

/** Parse YYYY-MM-DD into a Date at noon Ghana (UTC) that day. */
function parseGhanaDateKey(dateKey) {
  const key = String(dateKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Inclusive list of Ghana date keys from → to.
 */
function ghanaDateKeyRange(fromKey, toKey) {
  const from = parseGhanaDateKey(fromKey);
  const to = parseGhanaDateKey(toKey);
  if (!from || !to || from > to) return [];
  const out = [];
  const cur = new Date(from);
  while (cur <= to) {
    out.push(ghanaDateKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function ghanaServiceEndDate(date = new Date()) {
  const { dateKey } = ghanaDayBounds(date);
  const { hour, minute } = SCHEDULE.serviceEnd;
  return new Date(
    `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`,
  );
}

function formatGhanaStamp(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

function formatGhanaTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Clock-in status in Ghana time.
 * Before 9:30 → ON_TIME; from 9:30 until service end → LATE; after 2:00 → CLOSED.
 */
function evaluateClockIn(date = new Date()) {
  const mins = ghanaMinutes(date);
  const lateAt = toMinutes(SCHEDULE.lateAfter.hour, SCHEDULE.lateAfter.minute);
  const endAt = toMinutes(SCHEDULE.serviceEnd.hour, SCHEDULE.serviceEnd.minute);

  if (mins >= endAt) {
    return {
      allowed: false,
      status: null,
      reason: 'Church service has closed for today (2:00 PM Ghana time).',
    };
  }

  if (mins >= lateAt) {
    return { allowed: true, status: 'LATE', reason: null };
  }

  return { allowed: true, status: 'ON_TIME', reason: null };
}

function isPastAutoClockOut(date = new Date()) {
  const mins = ghanaMinutes(date);
  const endAt = toMinutes(SCHEDULE.serviceEnd.hour, SCHEDULE.serviceEnd.minute);
  return mins >= endAt;
}

function welcomeFor(fullName) {
  const name = (fullName || 'Member').trim();
  return {
    title: `Welcome ${name}!`,
    body: SCHEDULE.welcomeMessage,
    assembly: SCHEDULE.assemblyName,
  };
}

module.exports = {
  TIMEZONE,
  SCHEDULE,
  ghanaParts,
  ghanaMinutes,
  ghanaDateKey,
  ghanaDayBounds,
  parseGhanaDateKey,
  ghanaDateKeyRange,
  ghanaServiceEndDate,
  formatGhanaStamp,
  formatGhanaTime,
  evaluateClockIn,
  isPastAutoClockOut,
  welcomeFor,
};
