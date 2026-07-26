const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/',
  authenticate,
  attendanceController.createValidators,
  attendanceController.validate,
  attendanceController.createAttendance
);

router.get(
  '/today',
  authenticate,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'AUDITOR', 'EMPLOYEE'),
  attendanceController.todayAttendance
);

router.post('/auto-clock-out', optionalAuthenticate, attendanceController.autoClockOut);
router.get('/auto-clock-out', optionalAuthenticate, attendanceController.autoClockOut);

router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'AUDITOR'),
  attendanceController.listAttendance
);

module.exports = router;
