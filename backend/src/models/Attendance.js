const mongoose = require('mongoose');

const ATTENDANCE_TYPES = ['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END'];
const SYNC_STATUS = ['PENDING', 'UPLOADED', 'FAILED'];

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeId: { type: String, required: true, index: true },
    fullName: { type: String, required: true },
    department: { type: String, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
    deviceId: { type: String, required: true },
    attendanceType: { type: String, enum: ATTENDANCE_TYPES, required: true },
    timestamp: { type: Date, required: true, index: true },
    faceScore: { type: Number, min: 0, max: 100 },
    recognitionScore: { type: Number, min: 0, max: 100 },
    gps: {
      lat: Number,
      lng: Number,
    },
    imageSnapshotUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['ON_TIME', 'LATE', 'EARLY', 'OK'],
      default: 'OK',
    },
    syncStatus: { type: String, enum: SYNC_STATUS, default: 'UPLOADED' },
    clientEventId: { type: String, index: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ clientEventId: 1, deviceId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
module.exports.ATTENDANCE_TYPES = ATTENDANCE_TYPES;
module.exports.SYNC_STATUS = SYNC_STATUS;
