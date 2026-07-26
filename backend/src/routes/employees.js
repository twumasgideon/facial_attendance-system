const express = require('express');
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const canManage = authorize('SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER');
const canView = authorize('SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'AUDITOR');

router.get('/sync', authenticate, employeeController.syncFaces);

router.get('/', authenticate, canView, employeeController.listEmployees);

router.post(
  '/',
  authenticate,
  canManage,
  employeeController.createValidators,
  employeeController.validate,
  employeeController.createEmployee
);

router.get('/:employeeId', authenticate, canView, employeeController.getEmployee);

router.put(
  '/:employeeId',
  authenticate,
  canManage,
  employeeController.updateValidators,
  employeeController.validate,
  employeeController.updateEmployee
);

router.delete(
  '/:employeeId',
  authenticate,
  canManage,
  employeeController.deactivateEmployee
);

module.exports = router;
