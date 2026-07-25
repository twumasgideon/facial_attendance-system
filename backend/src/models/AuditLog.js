const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resource: { type: String, default: '' },
    resourceId: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
