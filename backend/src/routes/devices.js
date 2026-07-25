const express = require('express');
const deviceController = require('../controllers/deviceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  deviceController.registerValidators,
  deviceController.validate,
  deviceController.registerDevice
);

router.post('/:deviceId/heartbeat', deviceController.heartbeat);

router.get('/', authenticate, authorize('SUPER_ADMIN', 'HR_ADMIN'), deviceController.listDevices);

module.exports = router;
