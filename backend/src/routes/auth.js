const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', authController.loginValidators, authController.validate, authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
