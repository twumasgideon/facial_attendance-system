const Branch = require('../models/Branch');
const Department = require('../models/Department');
const User = require('../models/User');
const config = require('../config');
const { hashPassword } = require('../utils/auth');

async function seedIfEmpty() {
  const existingAdmin = await User.findOne({ email: config.adminEmail.toLowerCase() });
  if (existingAdmin) {
    return false;
  }

  const branch = await Branch.create({
    code: 'HQ01',
    name: 'Sofoline',
    organizationName: 'Presence Demo Org',
    address: 'Sofoline Branch',
  });

  const dept = await Department.create({
    code: 'OPS',
    name: 'Operations',
    branch: branch._id,
  });

  await User.create({
    employeeId: 'ADMIN001',
    fullName: 'System Administrator',
    email: config.adminEmail.toLowerCase(),
    passwordHash: await hashPassword(config.adminPassword),
    role: 'SUPER_ADMIN',
    branch: branch._id,
    department: dept._id,
    position: 'Administrator',
    faceStatus: 'PENDING',
    employmentStatus: 'ACTIVE',
  });

  const demoEmployees = [
    { employeeId: 'EMP001', fullName: 'Gideon Mensah', email: 'gideon@presence.local', position: 'Teller' },
    { employeeId: 'EMP002', fullName: 'Ama Owusu', email: 'ama@presence.local', position: 'HR Officer' },
    { employeeId: 'EMP003', fullName: 'Kojo Asante', email: 'kojo@presence.local', position: 'Security' },
  ];

  for (const emp of demoEmployees) {
    await User.create({
      ...emp,
      passwordHash: await hashPassword('Employee123!'),
      role: 'EMPLOYEE',
      branch: branch._id,
      department: dept._id,
      faceStatus: 'REGISTERED',
      employmentStatus: 'ACTIVE',
    });
  }

  console.log('Seeded demo branch HQ01, admin, and 3 employees');
  return true;
}

module.exports = { seedIfEmpty };
