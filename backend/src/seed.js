require('dotenv').config();
const { connectDb } = require('./config/db');
const config = require('./config');
const Branch = require('./models/Branch');
const Department = require('./models/Department');
const User = require('./models/User');
const { hashPassword } = require('./utils/auth');

async function seed() {
  await connectDb();

  let branch = await Branch.findOne({ code: 'HQ01' });
  if (!branch) {
    branch = await Branch.create({
      code: 'HQ01',
      name: 'Sofoline',
      organizationName: 'Presence Demo Org',
      address: 'Sofoline Branch',
    });
    console.log('Created branch HQ01 / Sofoline');
  }

  let dept = await Department.findOne({ code: 'OPS', branch: branch._id });
  if (!dept) {
    dept = await Department.create({
      code: 'OPS',
      name: 'Operations',
      branch: branch._id,
    });
    console.log('Created department OPS');
  }

  let admin = await User.findOne({ email: config.adminEmail.toLowerCase() });
  if (!admin) {
    admin = await User.create({
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
    console.log(`Created admin ${config.adminEmail}`);
  }

  const demoEmployees = [
    { employeeId: 'EMP001', fullName: 'Gideon Mensah', email: 'gideon@presence.local', position: 'Teller' },
    { employeeId: 'EMP002', fullName: 'Ama Owusu', email: 'ama@presence.local', position: 'HR Officer' },
    { employeeId: 'EMP003', fullName: 'Kojo Asante', email: 'kojo@presence.local', position: 'Security' },
  ];

  for (const emp of demoEmployees) {
    const existing = await User.findOne({ employeeId: emp.employeeId });
    if (!existing) {
      await User.create({
        ...emp,
        passwordHash: await hashPassword('Employee123!'),
        role: 'EMPLOYEE',
        branch: branch._id,
        department: dept._id,
        faceStatus: 'REGISTERED',
        employmentStatus: 'ACTIVE',
      });
      console.log(`Created employee ${emp.employeeId}`);
    }
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
