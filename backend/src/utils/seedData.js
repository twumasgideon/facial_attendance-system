const User = require('../models/User');
const config = require('../config');
const { hashPassword } = require('../utils/auth');
const { ensureDefaultBranch, DEFAULT_BRANCH } = require('./ensureDefaults');

async function seedIfEmpty() {
  const existingAdmin = await User.findOne({ email: config.adminEmail.toLowerCase() });
  // Always ensure the default Kasse branch exists, even if admin already seeded.
  await ensureDefaultBranch();
  if (existingAdmin) {
    return false;
  }

  const { branch, department: dept } = await ensureDefaultBranch();

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
    { employeeId: 'EMP001', fullName: 'Gideon Mensah', email: 'gideon@presence.local', position: 'Member' },
    { employeeId: 'EMP002', fullName: 'Ama Owusu', email: 'ama@presence.local', position: 'Member' },
    { employeeId: 'EMP003', fullName: 'Kojo Asante', email: 'kojo@presence.local', position: 'Member' },
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

  console.log(`Seeded ${DEFAULT_BRANCH.code}, admin, and 3 members`);
  return true;
}

module.exports = { seedIfEmpty };
