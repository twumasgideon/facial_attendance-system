const express = require('express');
const branchController = require('../controllers/branchController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const canManage = authorize('SUPER_ADMIN', 'HR_ADMIN', 'BRANCH_MANAGER');

router.get('/', authenticate, branchController.listBranches);

router.post(
  '/',
  authenticate,
  canManage,
  branchController.createValidators,
  branchController.validate,
  branchController.createBranch
);

module.exports = router;
