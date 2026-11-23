import { PrismaClient, Role, ComplaintCategory, ComplaintPriority, ComplaintStatus, ConfirmationVoteType } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Clearing existing database tables...');
  await prisma.submissionQuota.deleteMany();
  await prisma.passwordResetRequest.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.penaltyEvent.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.confirmationVote.deleteMany();
  await prisma.priorityHistory.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.upvote.deleteMany();
  await prisma.complaintPhoto.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.wardenAssignment.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.hostel.deleteMany();

  console.log('[Seed] Creating hostels...');
  const hostelB = await prisma.hostel.create({
    data: {
      name: 'Tagore Hall (Block B)',
      code: 'BLOCK-B',
      timezone: 'Asia/Kolkata',
    },
  });

  const hostelA = await prisma.hostel.create({
    data: {
      name: 'Ramanujan Hall (Block A)',
      code: 'BLOCK-A',
      timezone: 'Asia/Kolkata',
    },
  });

  console.log('[Seed] Creating default policies...');
  await prisma.policy.create({
    data: {
      hostelId: hostelB.id,
      normalDeadlineHours: 72,
      emergencyDeadlineHours: 24,
      upvotesToEscalate: 10,
      confirmationsNeeded: 3,
      confirmationWindowHours: 24,
      normalDailyLimit: 1,
      emergencyWeeklyLimit: 1,
      timezone: 'Asia/Kolkata',
    },
  });

  await prisma.policy.create({
    data: {
      hostelId: hostelA.id,
      normalDeadlineHours: 72,
      emergencyDeadlineHours: 24,
      upvotesToEscalate: 10,
      confirmationsNeeded: 3,
      confirmationWindowHours: 24,
      normalDailyLimit: 1,
      emergencyWeeklyLimit: 1,
      timezone: 'Asia/Kolkata',
    },
  });

  console.log('[Seed] Creating users (1 admin, 2 wardens, 15 students)...');
  const passwordHash = await argon2.hash('password123');

  // 1 Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@hostel.edu',
      name: 'Dr. Vikram Sharma',
      passwordHash,
      role: Role.ADMIN,
      hostelId: hostelB.id,
      roomNumber: 'Admin Office 101',
    },
  });

  // 2 Wardens
  const wardenSingh = await prisma.user.create({
    data: {
      email: 'warden.singh@hostel.edu',
      name: 'Rajesh Singh',
      passwordHash,
      role: Role.WARDEN,
      hostelId: hostelB.id,
      roomNumber: 'Warden Quarters B',
    },
  });

  const wardenVerma = await prisma.user.create({
    data: {
      email: 'warden.verma@hostel.edu',
      name: 'Sunita Verma',
      passwordHash,
      role: Role.WARDEN,
      hostelId: hostelA.id,
      roomNumber: 'Warden Quarters A',
    },
  });

  // Warden assignments
  await prisma.wardenAssignment.create({
    data: {
      wardenId: wardenSingh.id,
      hostelId: hostelB.id,
      buildingBlock: 'Block B',
    },
  });

  await prisma.wardenAssignment.create({
    data: {
      wardenId: wardenVerma.id,
      hostelId: hostelA.id,
      buildingBlock: 'Block A',
    },
  });

  // 15 Students: 10 in Block B, 5 in Block A
  const studentDataB = [
    { name: 'Aarav Sharma', email: 'aarav@hostel.edu', studentId: 'STU-B-302', room: 'B-302' },
    { name: 'Rohan Patel', email: 'rohan@hostel.edu', studentId: 'STU-B-205', room: 'B-205' },
    { name: 'Priya Nair', email: 'priya@hostel.edu', studentId: 'STU-B-114', room: 'B-114' },
    { name: 'Ananya Iyer', email: 'ananya@hostel.edu', studentId: 'STU-B-401', room: 'B-401' },
    { name: 'Siddharth Sen', email: 'siddharth@hostel.edu', studentId: 'STU-B-218', room: 'B-218' },
    { name: 'Meera Gupta', email: 'meera@hostel.edu', studentId: 'STU-B-309', room: 'B-309' },
    { name: 'Kabir Das', email: 'kabir@hostel.edu', studentId: 'STU-B-102', room: 'B-102' },
    { name: 'Tanvi Kulkarni', email: 'tanvi@hostel.edu', studentId: 'STU-B-412', room: 'B-412' },
    { name: 'Aditya Joshi', email: 'aditya@hostel.edu', studentId: 'STU-B-201', room: 'B-201' },
    { name: 'Neha Reddy', email: 'neha@hostel.edu', studentId: 'STU-B-315', room: 'B-315' },
    { name: 'Riya Sen', email: 'riya@hostel.edu', studentId: 'STU-B-105', room: 'B-105' },
    { name: 'Ishaan Verma', email: 'ishaan@hostel.edu', studentId: 'STU-B-206', room: 'B-206' },
  ];

  const studentDataA = [
    { name: 'Vikram Rao', email: 'vikram@hostel.edu', studentId: 'STU-A-101', room: 'A-101' },
    { name: 'Pooja Bhat', email: 'pooja@hostel.edu', studentId: 'STU-A-202', room: 'A-202' },
    { name: 'Devansh Chawla', email: 'devansh@hostel.edu', studentId: 'STU-A-305', room: 'A-305' },
    { name: 'Shreya Jain', email: 'shreya@hostel.edu', studentId: 'STU-A-108', room: 'A-108' },
    { name: 'Nikhil Menon', email: 'nikhil@hostel.edu', studentId: 'STU-A-404', room: 'A-404' },
  ];

  const studentsB = await Promise.all(
    studentDataB.map((s) =>
      prisma.user.create({
        data: {
          name: s.name,
          email: s.email,
          studentId: s.studentId,
          roomNumber: s.room,
          passwordHash,
          role: Role.STUDENT,
          hostelId: hostelB.id,
        },
      })
    )
  );

  const studentsA = await Promise.all(
    studentDataA.map((s) =>
      prisma.user.create({
        data: {
          name: s.name,
          email: s.email,
          studentId: s.studentId,
          roomNumber: s.room,
          passwordHash,
          role: Role.STUDENT,
          hostelId: hostelA.id,
        },
      })
    )
  );

  const allStudents = [...studentsB, ...studentsA];
  console.log(`[Seed] Created ${allStudents.length} students across 2 hostels.`);

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

  console.log('[Seed] Creating 12 realistic complaints in varied states...');

  // 1. Complaint #1042: Promoted to emergency with 12 votes, Acknowledged (Mockup Screen 3 & 5)
  const c1 = await prisma.complaint.create({
    data: {
      displayNumber: 1042,
      readableId: 'HM-1042',
      title: 'Water leaking from 3rd floor bathroom',
      description: 'Severe dripping from ceiling joint since morning, corridor floor slippery near stairwell.',
      category: ComplaintCategory.PLUMBING,
      priority: ComplaintPriority.EMERGENCY,
      status: ComplaintStatus.ACKNOWLEDGED,
      submitterId: studentsB[0].id, // Aarav Sharma
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(15),
      deadlineAt: hoursFromNow(11.33), // 11h 20m left
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, reason: 'Initial submission', actorId: studentsB[0].id, createdAt: hoursAgo(15) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.ACKNOWLEDGED, reason: 'Warden reviewed issue', actorId: wardenSingh.id, createdAt: hoursAgo(13.5) },
        ],
      },
      priorityHistory: {
        create: [
          {
            fromPriority: ComplaintPriority.NORMAL,
            toPriority: ComplaintPriority.EMERGENCY,
            reason: 'Auto-promoted after reaching 10 community upvotes (12 total eligible upvotes)',
            previousDeadlineAt: hoursFromNow(57),
            newDeadlineAt: hoursFromNow(11.33),
            actorId: null,
            createdAt: hoursAgo(12.67),
          },
        ],
      },
    },
  });

  // Upvotes for c1 (12 upvotes)
  for (let i = 1; i <= 9; i++) {
    await prisma.upvote.create({ data: { complaintId: c1.id, userId: studentsB[i].id, createdAt: hoursAgo(14 - i * 0.1) } });
  }
  for (let i = 0; i < 3; i++) {
    await prisma.upvote.create({ data: { complaintId: c1.id, userId: studentsA[i].id, createdAt: hoursAgo(13) } });
  }

  // 2. Complaint #1043: Corridor lights off near stairwell (NEAR PROMOTION - exactly 9 upvotes!)
  const c2 = await prisma.complaint.create({
    data: {
      displayNumber: 1043,
      readableId: 'HM-1043',
      title: 'Corridor lights off near stairwell',
      description: 'Entire fixture flickering and shut off. Dark hazard near stairs on wing C.',
      category: ComplaintCategory.ELECTRICAL,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.SUBMITTED,
      submitterId: studentsB[1].id, // Rohan Patel
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(4),
      deadlineAt: hoursFromNow(68), // 68h left
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, reason: 'Initial submission', actorId: studentsB[1].id, createdAt: hoursAgo(4) },
        ],
      },
    },
  });

  // Exactly 9 upvotes for c2 (studentsB[0] and studentsB[2..9])
  const upvotersC2 = [studentsB[0], ...studentsB.slice(2, 10)];
  for (const voter of upvotersC2) {
    await prisma.upvote.create({ data: { complaintId: c2.id, userId: voter.id, createdAt: hoursAgo(3) } });
  }

  // 3. Complaint #1044: Wi-Fi drops every evening on floor 2 (IN PROGRESS)
  const c3 = await prisma.complaint.create({
    data: {
      displayNumber: 1044,
      readableId: 'HM-1044',
      title: 'Wi-Fi drops every evening on floor 2',
      description: 'Router restarts constantly between 8 PM and 11 PM. High packet loss.',
      category: ComplaintCategory.INTERNET,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.IN_PROGRESS,
      submitterId: studentsB[2].id, // Priya Nair
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(30.33),
      deadlineAt: hoursFromNow(41.67), // 41h 40m left
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[2].id, createdAt: hoursAgo(30.33) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.ACKNOWLEDGED, actorId: wardenSingh.id, createdAt: hoursAgo(28) },
          { fromStatus: ComplaintStatus.ACKNOWLEDGED, toStatus: ComplaintStatus.IN_PROGRESS, reason: 'Network engineer assigned ticket #NET-882', actorId: wardenSingh.id, createdAt: hoursAgo(24) },
        ],
      },
    },
  });

  for (let i = 0; i < 5; i++) {
    if (studentsB[i].id !== studentsB[2].id) {
      await prisma.upvote.create({ data: { complaintId: c3.id, userId: studentsB[i].id, createdAt: hoursAgo(20) } });
    }
  }

  // 4. Complaint #1045: Mess hall tables not cleaned (IN CONFIRMATION WINDOW with 2 Solved votes)
  const c4 = await prisma.complaint.create({
    data: {
      displayNumber: 1045,
      readableId: 'HM-1045',
      title: 'Mess hall tables not cleaned',
      description: 'Food spillage and uncleared plates left unattended after dinner service.',
      category: ComplaintCategory.CLEANLINESS,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.MARKED_RESOLVED,
      submitterId: studentsB[3].id, // Ananya Iyer
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(48),
      deadlineAt: hoursFromNow(24),
      markedResolvedAt: hoursAgo(18),
      resolutionNote: 'Mess supervisor instructed cleaning team. Sanitize cycle completed.',
      confirmationRound: 1,
      confirmationWindowEndsAt: hoursFromNow(6), // 6h left in 24h confirmation window
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[3].id, createdAt: hoursAgo(48) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.MARKED_RESOLVED, reason: 'Mess tables sanitized and inspected', actorId: wardenSingh.id, createdAt: hoursAgo(18) },
        ],
      },
    },
  });

  // 2 Solved votes for c4
  await prisma.confirmationVote.create({
    data: { complaintId: c4.id, userId: studentsB[0].id, round: 1, vote: ConfirmationVoteType.SOLVED, comment: 'Tables look clean now', createdAt: hoursAgo(14) },
  });
  await prisma.confirmationVote.create({
    data: { complaintId: c4.id, userId: studentsB[1].id, round: 1, vote: ConfirmationVoteType.SOLVED, comment: 'Verified at breakfast', createdAt: hoursAgo(10) },
  });

  // 5. Complaint #1046: Broken study chair, wing C (OVERDUE - Late by 5h, with -1 PenaltyEvent)
  const c5Deadline = hoursAgo(5);
  const c5 = await prisma.complaint.create({
    data: {
      displayNumber: 1046,
      readableId: 'HM-1046',
      title: 'Broken study chair, wing C',
      description: 'Right armrest snapped off, dangerous exposed screw.',
      category: ComplaintCategory.FURNITURE,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.SUBMITTED,
      submitterId: studentsB[4].id, // Siddharth Sen
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(77),
      deadlineAt: c5Deadline,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[4].id, createdAt: hoursAgo(77) },
        ],
      },
    },
  });

  for (let i = 5; i <= 7; i++) {
    await prisma.upvote.create({ data: { complaintId: c5.id, userId: studentsB[i].id, createdAt: hoursAgo(60) } });
  }

  // Idempotent penalty event for overdue complaint #1046
  await prisma.penaltyEvent.create({
    data: {
      complaintId: c5.id,
      wardenId: wardenSingh.id,
      deadlineAt: c5Deadline,
      points: 1,
      reason: 'Normal priority complaint exceeded 72h SLA without being marked resolved',
      createdAt: hoursAgo(4.9),
    },
  });

  // 6. Complaint #1047: Geyser tripping MCB in washroom 4 (RESOLVED with 3 Solved votes & Complainant 3-Star Rating)
  const c6 = await prisma.complaint.create({
    data: {
      displayNumber: 1047,
      readableId: 'HM-1047',
      title: 'Geyser tripping MCB in washroom 4',
      description: 'Whenever geyser is turned on, main circuit breaker trips immediately.',
      category: ComplaintCategory.ELECTRICAL,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.RESOLVED,
      submitterId: studentsB[5].id, // Meera Gupta
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(96),
      deadlineAt: hoursAgo(24),
      markedResolvedAt: hoursAgo(48),
      resolvedAt: hoursAgo(30),
      resolutionNote: 'Electrician replaced shorted heating coil and checked earthing.',
      confirmationRound: 1,
      confirmationWindowEndsAt: hoursAgo(24),
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[5].id, createdAt: hoursAgo(96) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.MARKED_RESOLVED, actorId: wardenSingh.id, createdAt: hoursAgo(48) },
          { fromStatus: ComplaintStatus.MARKED_RESOLVED, toStatus: ComplaintStatus.RESOLVED, reason: '3 student confirmations received inside 24h window', actorId: null, createdAt: hoursAgo(30) },
        ],
      },
    },
  });

  // 3 Confirmation votes
  await prisma.confirmationVote.create({ data: { complaintId: c6.id, userId: studentsB[0].id, round: 1, vote: ConfirmationVoteType.SOLVED, createdAt: hoursAgo(44) } });
  await prisma.confirmationVote.create({ data: { complaintId: c6.id, userId: studentsB[1].id, round: 1, vote: ConfirmationVoteType.SOLVED, createdAt: hoursAgo(38) } });
  await prisma.confirmationVote.create({ data: { complaintId: c6.id, userId: studentsB[2].id, round: 1, vote: ConfirmationVoteType.SOLVED, createdAt: hoursAgo(30) } });

  // Complainant rating: 3 stars
  await prisma.rating.create({
    data: {
      complaintId: c6.id,
      complainantId: studentsB[5].id,
      wardenId: wardenSingh.id,
      stars: 3,
      comment: 'Repaired very quickly and hot water is working safely now. Thank you!',
      createdAt: hoursAgo(28),
    },
  });

  // 7. Complaint #1048: Main water pipe burst (SUBMITTED AS EMERGENCY)
  const c7 = await prisma.complaint.create({
    data: {
      displayNumber: 1048,
      readableId: 'HM-1048',
      title: 'Main pipeline burst flooding ground floor corridor',
      description: 'Major leak from supply main. Water entering rooms B-101 and B-102.',
      category: ComplaintCategory.PLUMBING,
      priority: ComplaintPriority.EMERGENCY,
      status: ComplaintStatus.IN_PROGRESS,
      submitterId: studentsB[6].id, // Kabir Das
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(6),
      deadlineAt: hoursFromNow(18), // 24h emergency deadline
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[6].id, createdAt: hoursAgo(6) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.IN_PROGRESS, reason: 'Emergency plumbing contractor arrived on site', actorId: wardenSingh.id, createdAt: hoursAgo(5) },
        ],
      },
    },
  });
  for (let i = 0; i < 7; i++) {
    if (studentsB[i].id !== studentsB[6].id) {
      await prisma.upvote.create({ data: { complaintId: c7.id, userId: studentsB[i].id, createdAt: hoursAgo(5.5) } });
    }
  }

  // 8. Complaint #1049: Pest infestation (REOPENED due to 3 NOT_SOLVED votes)
  const c8 = await prisma.complaint.create({
    data: {
      displayNumber: 1049,
      readableId: 'HM-1049',
      title: 'Pest infestation in 1st floor kitchen pantry',
      description: 'Cockroaches and ants entering food storage bins in night mess pantry.',
      category: ComplaintCategory.CLEANLINESS,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.REOPENED,
      submitterId: studentsB[7].id, // Tanvi Kulkarni
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(70),
      deadlineAt: hoursAgo(2),
      confirmationRound: 1,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[7].id, createdAt: hoursAgo(70) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.MARKED_RESOLVED, reason: 'Pest spray applied', actorId: wardenSingh.id, createdAt: hoursAgo(30) },
          { fromStatus: ComplaintStatus.MARKED_RESOLVED, toStatus: ComplaintStatus.REOPENED, reason: '3 student Not Solved votes received; issue not resolved', actorId: null, createdAt: hoursAgo(20) },
        ],
      },
    },
  });

  await prisma.confirmationVote.create({ data: { complaintId: c8.id, userId: studentsB[0].id, round: 1, vote: ConfirmationVoteType.NOT_SOLVED, comment: 'Saw pests again last night', createdAt: hoursAgo(25) } });
  await prisma.confirmationVote.create({ data: { complaintId: c8.id, userId: studentsB[1].id, round: 1, vote: ConfirmationVoteType.NOT_SOLVED, comment: 'Infestation is unchanged', createdAt: hoursAgo(22) } });
  await prisma.confirmationVote.create({ data: { complaintId: c8.id, userId: studentsB[2].id, round: 1, vote: ConfirmationVoteType.NOT_SOLVED, comment: 'Pantry still contaminated', createdAt: hoursAgo(20) } });

  // 9. Complaint #1050: Gym treadmill loose safety clip (CLOSED)
  await prisma.complaint.create({
    data: {
      displayNumber: 1050,
      readableId: 'HM-1050',
      title: 'Gym treadmill loose safety clip',
      description: 'Emergency stop magnet cord frayed and disconnected.',
      category: ComplaintCategory.FURNITURE,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.CLOSED,
      submitterId: studentsB[8].id, // Aditya Joshi
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(200),
      deadlineAt: hoursAgo(128),
      markedResolvedAt: hoursAgo(150),
      resolvedAt: hoursAgo(140),
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[8].id, createdAt: hoursAgo(200) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.RESOLVED, actorId: wardenSingh.id, createdAt: hoursAgo(140) },
          { fromStatus: ComplaintStatus.RESOLVED, toStatus: ComplaintStatus.CLOSED, reason: 'Archived after semester gym maintenance', actorId: admin.id, createdAt: hoursAgo(100) },
        ],
      },
    },
  });

  // 10. Complaint #1051: Mini-fridge request (REJECTED by Admin/Warden)
  await prisma.complaint.create({
    data: {
      displayNumber: 1051,
      readableId: 'HM-1051',
      title: 'Requesting permission for personal 150L mini-fridge in room',
      description: 'Want approval to install a private refrigerator in room B-315.',
      category: ComplaintCategory.OTHER,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.REJECTED,
      rejectionReason: 'Personal high-wattage refrigeration units prohibited per Hostel Code section 4.1.',
      submitterId: studentsB[9].id, // Neha Reddy
      hostelId: hostelB.id,
      assignedWardenId: wardenSingh.id,
      createdAt: hoursAgo(24),
      deadlineAt: hoursFromNow(48),
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsB[9].id, createdAt: hoursAgo(24) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.REJECTED, reason: 'Disallowed per policy handbook', actorId: admin.id, createdAt: hoursAgo(20) },
        ],
      },
    },
  });

  // 11. Complaint #1052: Hostel A - LAN port damaged in room A-202 (IN PROGRESS)
  await prisma.complaint.create({
    data: {
      displayNumber: 1052,
      readableId: 'HM-1052',
      title: 'LAN wall port damaged in room A-202',
      description: 'RJ45 socket pins are bent, cable cannot click into place.',
      category: ComplaintCategory.INTERNET,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.IN_PROGRESS,
      submitterId: studentsA[1].id, // Pooja Bhat
      hostelId: hostelA.id,
      assignedWardenId: wardenVerma.id,
      createdAt: hoursAgo(12),
      deadlineAt: hoursFromNow(60),
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsA[1].id, createdAt: hoursAgo(12) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.IN_PROGRESS, actorId: wardenVerma.id, createdAt: hoursAgo(8) },
        ],
      },
    },
  });

  // 12. Complaint #1053: Hostel A - Ceiling fan regulator sparking (OVERDUE - Late by 12h)
  const c12Deadline = hoursAgo(12);
  const c12 = await prisma.complaint.create({
    data: {
      displayNumber: 1053,
      readableId: 'HM-1053',
      title: 'Ceiling fan regulator sparking on switchboard',
      description: 'Visible sparks when turning fan dial from 2 to 3.',
      category: ComplaintCategory.ELECTRICAL,
      priority: ComplaintPriority.NORMAL,
      status: ComplaintStatus.ACKNOWLEDGED,
      submitterId: studentsA[2].id, // Devansh Chawla
      hostelId: hostelA.id,
      assignedWardenId: wardenVerma.id,
      createdAt: hoursAgo(84),
      deadlineAt: c12Deadline,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: ComplaintStatus.SUBMITTED, actorId: studentsA[2].id, createdAt: hoursAgo(84) },
          { fromStatus: ComplaintStatus.SUBMITTED, toStatus: ComplaintStatus.ACKNOWLEDGED, actorId: wardenVerma.id, createdAt: hoursAgo(80) },
        ],
      },
    },
  });

  await prisma.penaltyEvent.create({
    data: {
      complaintId: c12.id,
      wardenId: wardenVerma.id,
      deadlineAt: c12Deadline,
      points: 1,
      reason: 'Normal priority complaint exceeded 72h SLA without resolution',
      createdAt: hoursAgo(11.9),
    },
  });

  console.log('[Seed] Seeding audit log entries...');
  const auditEntries = [
    {
      action: 'PENALTY_VOIDED',
      entityType: 'Complaint',
      entityId: '1011',
      actorId: admin.id,
      before: { penaltyPoints: 1, active: true },
      after: { penaltyPoints: 0, active: false, reason: 'Warden on approved leave during festival weekend' },
      timestamp: hoursAgo(2.5),
    },
    {
      action: 'PRIORITY_PROMOTED',
      entityType: 'Complaint',
      entityId: c1.id,
      actorId: null,
      before: { priority: 'NORMAL', deadline: c1.createdAt },
      after: { priority: 'EMERGENCY', eligibleUpvotes: 12, newDeadline: c1.deadlineAt },
      timestamp: hoursAgo(12.67),
    },
    {
      action: 'STATUS_CHANGED',
      entityType: 'Complaint',
      entityId: c1.id,
      actorId: wardenSingh.id,
      before: { status: 'SUBMITTED' },
      after: { status: 'ACKNOWLEDGED' },
      timestamp: hoursAgo(13.5),
    },
    {
      action: 'POLICY_REVIEWED',
      entityType: 'Policy',
      entityId: hostelB.id,
      actorId: admin.id,
      before: { confirmationWindowHours: 24 },
      after: { confirmationWindowHours: 24, status: 'confirmed_unchanged' },
      timestamp: hoursAgo(48),
    },
    {
      action: 'USERS_IMPORTED',
      entityType: 'UserBatch',
      entityId: 'batch-2026-b1',
      actorId: admin.id,
      before: null,
      after: { importedCount: 148, invalidRowsReported: 2 },
      timestamp: hoursAgo(72),
    },
  ];

  for (const a of auditEntries) {
    await prisma.auditEvent.create({
      data: {
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        actorId: a.actorId,
        before: a.before,
        after: a.after,
        timestamp: a.timestamp,
        ipAddress: '127.0.0.1',
      },
    });
  }

  console.log('[Seed] Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
