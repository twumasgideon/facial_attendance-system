const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ code: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
