const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, 'Validation failed', 422, errors.array());
  }
  return next();
}

module.exports = { validate };
