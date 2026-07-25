function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, message, status = 400, errors) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

module.exports = { ok, fail };
