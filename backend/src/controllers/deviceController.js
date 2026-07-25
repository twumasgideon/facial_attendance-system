const { body } = require('express-validator');
const Device = require('../models/Device');
const Branch = require('../models/Branch');
const { ok, fail } = require('../utils/response');
const { validate } = require('../middleware/validate');

const registerValidators = [
  body('deviceId').isString().trim().notEmpty(),
  body('name').isString().trim().notEmpty(),
  body('branchCode').isString().trim().notEmpty(),
  body('platform').optional().isIn(['ANDROID', 'IOS']),
  body('model').optional().isString(),
  body('osVersion').optional().isString(),
  body('appVersion').optional().isString(),
];

async function registerDevice(req, res) {
  const {
    deviceId,
    name,
    branchCode,
    platform = 'ANDROID',
    model = '',
    osVersion = '',
    appVersion = '',
  } = req.body;

  const branch = await Branch.findOne({ code: branchCode.toUpperCase(), isActive: true });
  if (!branch) {
    return fail(res, 'Branch not found or inactive', 404);
  }

  let device = await Device.findOne({ deviceId: deviceId.toUpperCase() });

  if (device) {
    device.name = name;
    device.branch = branch._id;
    device.platform = platform;
    device.model = model;
    device.osVersion = osVersion;
    device.appVersion = appVersion;
    device.lastSeenAt = new Date();
    await device.save();
  } else {
    device = await Device.create({
      deviceId: deviceId.toUpperCase(),
      name,
      branch: branch._id,
      platform,
      model,
      osVersion,
      appVersion,
      lastSeenAt: new Date(),
      isAuthorized: true,
    });
  }

  if (!device.isAuthorized) {
    return fail(res, 'Device is not authorized', 403);
  }

  return ok(res, {
    device: {
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      platform: device.platform,
      branch: {
        id: branch._id,
        code: branch.code,
        name: branch.name,
        organizationName: branch.organizationName,
      },
      kioskMode: device.kioskMode,
      isAuthorized: device.isAuthorized,
    },
  }, device.isNew ? 201 : 200);
}

async function heartbeat(req, res) {
  const { deviceId } = req.params;
  const device = await Device.findOne({ deviceId: deviceId.toUpperCase() }).populate('branch');
  if (!device) {
    return fail(res, 'Device not found', 404);
  }

  device.lastSeenAt = new Date();
  if (req.body.appVersion) device.appVersion = req.body.appVersion;
  await device.save();

  return ok(res, {
    deviceId: device.deviceId,
    isAuthorized: device.isAuthorized,
    lastSeenAt: device.lastSeenAt,
    branch: device.branch
      ? {
          code: device.branch.code,
          name: device.branch.name,
          organizationName: device.branch.organizationName,
        }
      : null,
  });
}

async function listDevices(_req, res) {
  const devices = await Device.find().populate('branch', 'code name organizationName').sort({ updatedAt: -1 });
  return ok(res, { devices });
}

module.exports = {
  registerValidators,
  validate,
  registerDevice,
  heartbeat,
  listDevices,
};
