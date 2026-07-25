const { body } = require('express-validator');
const User = require('../models/User');
const { comparePassword, signToken } = require('../utils/auth');
const { ok, fail } = require('../utils/response');
const { validate } = require('../middleware/validate');

const loginValidators = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isString().isLength({ min: 6 }).withMessage('Password required'),
];

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return fail(res, 'Invalid credentials', 401);
  }

  const match = await comparePassword(password, user.passwordHash);
  if (!match) {
    return fail(res, 'Invalid credentials', 401);
  }

  if (user.employmentStatus !== 'ACTIVE') {
    return fail(res, 'Account is not active', 403);
  }

  const token = signToken({
    sub: user._id.toString(),
    role: user.role,
    employeeId: user.employeeId,
  });

  return ok(res, {
    token,
    user: user.toSafeJSON(),
  });
}

async function me(req, res) {
  return ok(res, { user: req.user.toSafeJSON() });
}

module.exports = {
  loginValidators,
  validate,
  login,
  me,
};
