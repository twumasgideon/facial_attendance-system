const mongoose = require('mongoose');

const ROLES = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'BRANCH_MANAGER',
  'SUPERVISOR',
  'EMPLOYEE',
  'AUDITOR',
];

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: ROLES, default: 'EMPLOYEE' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    position: { type: String, default: '' },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    photoUrl: { type: String, default: '' },
    faceStatus: {
      type: String,
      enum: ['PENDING', 'REGISTERED', 'FAILED', 'INACTIVE'],
      default: 'PENDING',
    },
    faceEmbedding: { type: [Number], default: undefined, select: false },
    employmentStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'],
      default: 'ACTIVE',
    },
    workingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '17:00' },
    },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    employeeId: this.employeeId,
    fullName: this.fullName,
    email: this.email,
    phone: this.phone,
    role: this.role,
    department: this.department,
    branch: this.branch,
    position: this.position,
    photoUrl: this.photoUrl,
    faceStatus: this.faceStatus,
    employmentStatus: this.employmentStatus,
    workingHours: this.workingHours,
    registeredAt: this.registeredAt,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
