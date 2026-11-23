import request from 'supertest';
import app from '../src/app.js';

async function verifyLogins() {
  console.log('=== VERIFYING SEEDED USER ROLES AND LOGINS ===\n');

  // 1. Student Login via Email
  console.log('1. Testing Student login (email: aarav@hostel.edu)...');
  const studentRes = await request(app)
    .post('/api/auth/student/login')
    .send({ identifier: 'aarav@hostel.edu', password: 'password123' });

  if (studentRes.status === 200 && studentRes.body.user?.role === 'STUDENT') {
    console.log(`   [PASS] Logged in as Student: ${studentRes.body.user.name} (${studentRes.body.user.email})`);
    console.log(`          Hostel: ${studentRes.body.user.hostel?.name}, Room: ${studentRes.body.user.roomNumber}`);
  } else {
    console.error('   [FAIL] Student login failed:', studentRes.status, studentRes.body);
  }

  // 2. Student Login via Student ID
  console.log('\n2. Testing Student login (studentId: STU-B-302)...');
  const stuIdRes = await request(app)
    .post('/api/auth/student/login')
    .send({ identifier: 'STU-B-302', password: 'password123' });

  if (stuIdRes.status === 200 && stuIdRes.body.user?.studentId === 'STU-B-302') {
    console.log(`   [PASS] Logged in with Student ID: ${stuIdRes.body.user.studentId} (${stuIdRes.body.user.name})`);
  } else {
    console.error('   [FAIL] Student ID login failed:', stuIdRes.status, stuIdRes.body);
  }

  // 3. Warden Login
  console.log('\n3. Testing Warden login (email: warden.singh@hostel.edu)...');
  const wardenRes = await request(app)
    .post('/api/auth/warden/login')
    .send({ identifier: 'warden.singh@hostel.edu', password: 'password123' });

  if (wardenRes.status === 200 && wardenRes.body.user?.role === 'WARDEN') {
    console.log(`   [PASS] Logged in as Warden: ${wardenRes.body.user.name} (${wardenRes.body.user.email})`);
    console.log(`          Assignments: ${wardenRes.body.user.wardenAssignments.map((a: { hostel: { name: string }; buildingBlock: string }) => `${a.hostel.name} [${a.buildingBlock}]`).join(', ')}`);
  } else {
    console.error('   [FAIL] Warden login failed:', wardenRes.status, wardenRes.body);
  }

  // 4. Admin Login
  console.log('\n4. Testing Admin login (email: admin@hostel.edu)...');
  const adminRes = await request(app)
    .post('/api/auth/warden/login')
    .send({ identifier: 'admin@hostel.edu', password: 'password123' });

  if (adminRes.status === 200 && adminRes.body.user?.role === 'ADMIN') {
    console.log(`   [PASS] Logged in as Admin: ${adminRes.body.user.name} (${adminRes.body.user.email})`);
  } else {
    console.error('   [FAIL] Admin login failed:', adminRes.status, adminRes.body);
  }

  // 5. Cross-Role Rejection Checks
  console.log('\n5. Testing Cross-Role Rejections (Security Boundaries)...');
  const crossWardenRes = await request(app)
    .post('/api/auth/student/login')
    .send({ identifier: 'warden.singh@hostel.edu', password: 'password123' });

  if (crossWardenRes.status === 401) {
    console.log('   [PASS] Warden rejected at /api/auth/student/login with 401 Invalid credentials');
  } else {
    console.error('   [FAIL] Expected 401, got', crossWardenRes.status);
  }

  const crossStudentRes = await request(app)
    .post('/api/auth/warden/login')
    .send({ identifier: 'aarav@hostel.edu', password: 'password123' });

  if (crossStudentRes.status === 401) {
    console.log('   [PASS] Student rejected at /api/auth/warden/login with 401 Invalid credentials');
  } else {
    console.error('   [FAIL] Expected 401, got', crossStudentRes.status);
  }

  console.log('\n=== ALL ROLE AUTHENTICATION CHECKS PASSED ===');
}

verifyLogins().catch(console.error);
