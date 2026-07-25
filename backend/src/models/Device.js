const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['ANDROID', 'IOS'], default: 'ANDROID' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    model: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    appVersion: { type: String, default: '' },
    isAuthorized: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
    kioskMode: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
