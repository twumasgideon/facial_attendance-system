const express = require('express');
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/sync',
  authenticate,
  employeeController.syncFaces
);

router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'AUDITOR'),
  employeeController.listEmployees
);

module.exports = router;
