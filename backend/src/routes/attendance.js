const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/',
  authenticate,
  attendanceController.createValidators,
  attendanceController.validate,
  attendanceController.createAttendance
);

router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'AUDITOR'),
  attendanceController.listAttendance
);

module.exports = router;
