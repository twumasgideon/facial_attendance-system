const Branch = require('../models/Branch');
const Department = require('../models/Department');
const Device = require('../models/Device');

const DEFAULT_BRANCH = {
  code: 'KASSE',
  name: 'Kasse Assembly',
  organizationName: 'Church of Pentecost Kasse Assembly Kumasi',
  address: 'Kasse Assembly, Kumasi',
};

/**
 * Always resolve one church branch so apps never need to pick/register a branch.
 */
async function ensureDefaultBranch() {
  let branch =
    (await Branch.findOne({ code: DEFAULT_BRANCH.code, isActive: true })) ||
    (await Branch.findOne({ isActive: true }).sort({ createdAt: 1 }));

  if (!branch) {
    branch = await Branch.create(DEFAULT_BRANCH);
  }

  let dept = await Department.findOne({ code: 'GEN', branch: branch._id });
  if (!dept) {
    dept = await Department.create({
      code: 'GEN',
      name: 'General',
      branch: branch._id,
    });
  }

  return { branch, department: dept };
}

/**
 * Auto-create / refresh a kiosk device so clock-in works without a Register Device step.
 */
async function ensureDevice({
  deviceId,
  name = 'Kasse CoP Phone',
  platform = 'ANDROID',
  model = '',
  osVersion = '',
  appVersion = '',
} = {}) {
  const { branch } = await ensureDefaultBranch();
  const id = String(deviceId || 'KASSE-PHONE').toUpperCase().trim();

  let device = await Device.findOne({ deviceId: id });
  if (device) {
    device.name = name || device.name;
    device.branch = branch._id;
    device.platform = platform || device.platform;
    if (model) device.model = model;
    if (osVersion) device.osVersion = osVersion;
    if (appVersion) device.appVersion = appVersion;
    device.isAuthorized = true;
    device.lastSeenAt = new Date();
    await device.save();
  } else {
    device = await Device.create({
      deviceId: id,
      name: name || 'Kasse CoP Phone',
      branch: branch._id,
      platform,
      model,
      osVersion,
      appVersion,
      isAuthorized: true,
      lastSeenAt: new Date(),
      kioskMode: true,
    });
  }

  return { device, branch };
}

module.exports = {
  DEFAULT_BRANCH,
  ensureDefaultBranch,
  ensureDevice,
};
