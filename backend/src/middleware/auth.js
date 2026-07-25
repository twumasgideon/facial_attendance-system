const { verifyToken } = require('../utils/auth');
const { fail } = require('../utils/response');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return fail(res, 'Authentication required', 401);
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub);
    if (!user || user.employmentStatus !== 'ACTIVE') {
      return fail(res, 'Invalid or inactive user', 401);
    }
    req.user = user;
    req.auth = decoded;
    return next();
  } catch {
    return fail(res, 'Invalid or expired token', 401);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 'Insufficient permissions', 403);
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
