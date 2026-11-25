import { Complaint, User, QuotaStatus } from '@hmcs/shared';

const MOCK_STORAGE_KEY = 'hcms_mock_complaints_v1';
const DEMO_USER_KEY = 'hcms_demo_user';

export const DEMO_STUDENT: User = {
  id: 'demo-student-1',
  name: 'Aarav Sharma',
  email: 'aarav@hostel.edu',
  studentId: 'STU-B-302',
  role: 'STUDENT',
  hostelId: 'BLOCK-B',
  roomNumber: 'B-302',
  isActive: true,
  hostel: {
    id: 'BLOCK-B',
    name: 'Tagore Hall (Block B)',
    code: 'BLOCK-B',
    timezone: 'Asia/Kolkata',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEMO_WARDEN: User = {
  id: 'demo-warden-1',
  name: 'Rajesh Singh',
  email: 'warden.singh@hostel.edu',
  role: 'WARDEN',
  hostelId: 'BLOCK-B',
  isActive: true,
  hostel: {
    id: 'BLOCK-B',
    name: 'Tagore Hall (Block B)',
    code: 'BLOCK-B',
    timezone: 'Asia/Kolkata',
  },
  wardenAssignments: [
    {
      id: 'wa-1',
      wardenId: 'demo-warden-1',
      hostelId: 'BLOCK-B',
      buildingBlock: 'Wing B',
      hostel: {
        id: 'BLOCK-B',
        name: 'Tagore Hall (Block B)',
        code: 'BLOCK-B',
        timezone: 'Asia/Kolkata',
      },
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEMO_ADMIN: User = {
  id: 'demo-admin-1',
  name: 'Dr. Vikram Sharma',
  email: 'admin@hostel.edu',
  role: 'ADMIN',
  hostelId: 'BLOCK-B',
  isActive: true,
  hostel: {
    id: 'BLOCK-B',
    name: 'Tagore Hall (Block B)',
    code: 'BLOCK-B',
    timezone: 'Asia/Kolkata',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function getStoredDemoUser(): User | null {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredDemoUser(user: User | null): void {
  if (user) {
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DEMO_USER_KEY);
  }
}

function getInitialComplaints(): Complaint[] {
  const now = Date.now();
  return [
    {
      id: 'comp-1',
      readableId: 'HM-0042',
      title: 'Main Water Line Leakage in 3rd Floor Corridor',
      description: 'High pressure water pipe leak near room B-308 causing corridor flooding. Urgent maintenance required.',
      category: 'PLUMBING',
      priority: 'EMERGENCY',
      status: 'IN_PROGRESS',
      hostelId: 'BLOCK-B',
      studentId: 'demo-student-2',
      submitter: {
        id: 'demo-student-2',
        name: 'Rohan Verma',
        roomNumber: 'B-308',
        studentId: 'STU-B-308',
      },
      assignedWardenId: 'demo-warden-1',
      assignedWarden: {
        id: 'demo-warden-1',
        name: 'Rajesh Singh',
        email: 'warden.singh@hostel.edu',
      },
      deadline: new Date(now + 18 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 6 * 3600 * 1000).toISOString(),
      upvoteCount: 14,
      hasUpvoted: true,
      isOwner: false,
      confirmationRound: 1,
      statusHistory: [
        {
          id: 'sh-1',
          complaintId: 'comp-1',
          fromStatus: 'SUBMITTED',
          toStatus: 'ACKNOWLEDGED',
          changedById: 'demo-warden-1',
          note: 'Reviewed by warden',
          createdAt: new Date(now - 5 * 3600 * 1000).toISOString(),
        },
        {
          id: 'sh-2',
          complaintId: 'comp-1',
          fromStatus: 'ACKNOWLEDGED',
          toStatus: 'IN_PROGRESS',
          changedById: 'demo-warden-1',
          note: 'Plumber team dispatched',
          createdAt: new Date(now - 3 * 3600 * 1000).toISOString(),
        },
      ],
      priorityHistory: [
        {
          id: 'ph-1',
          complaintId: 'comp-1',
          fromPriority: 'NORMAL',
          toPriority: 'EMERGENCY',
          reason: 'Auto-promoted after reaching 10 community upvotes',
          createdAt: new Date(now - 4 * 3600 * 1000).toISOString(),
        },
      ],
      photos: [],
    },
    {
      id: 'comp-2',
      readableId: 'HM-0039',
      title: 'Study Hall Central AC Not Cooling',
      description: 'Central air conditioner in Ground Floor study hall blowing hot air. Room temperature over 34C.',
      category: 'ELECTRICAL',
      priority: 'NORMAL',
      status: 'MARKED_RESOLVED',
      hostelId: 'BLOCK-B',
      studentId: 'demo-student-3',
      submitter: {
        id: 'demo-student-3',
        name: 'Priya Patel',
        roomNumber: 'B-104',
        studentId: 'STU-B-104',
      },
      assignedWardenId: 'demo-warden-1',
      assignedWarden: {
        id: 'demo-warden-1',
        name: 'Rajesh Singh',
        email: 'warden.singh@hostel.edu',
      },
      deadline: new Date(now + 48 * 3600 * 1000).toISOString(),
      markedResolvedAt: new Date(now - 4 * 3600 * 1000).toISOString(),
      confirmationWindowEndsAt: new Date(now + 20 * 3600 * 1000).toISOString(),
      resolutionNote: 'Recharged R-410A refrigerant gas and cleaned condenser fan coils. Tested temperature at 22C.',
      createdAt: new Date(now - 26 * 3600 * 1000).toISOString(),
      upvoteCount: 7,
      hasUpvoted: false,
      isOwner: false,
      confirmationRound: 1,
      confirmationSummary: {
        solvedCount: 2,
        notSolvedCount: 0,
        requiredVotes: 3,
        round: 1,
        windowEndsAt: new Date(now + 20 * 3600 * 1000).toISOString(),
        isWindowOpen: true,
        userVote: null,
      },
      statusHistory: [
        {
          id: 'sh-21',
          complaintId: 'comp-2',
          fromStatus: 'IN_PROGRESS',
          toStatus: 'MARKED_RESOLVED',
          changedById: 'demo-warden-1',
          note: 'Work completed and verified by contractor',
          createdAt: new Date(now - 4 * 3600 * 1000).toISOString(),
        },
      ],
      photos: [],
    },
    {
      id: 'comp-3',
      readableId: 'HM-0044',
      title: 'Wing B 3rd Floor Wi-Fi Router Gateway Unreachable',
      description: 'Access point AP-B-04 dropping connectivity intermittently. Students unable to submit project assignments.',
      category: 'INTERNET',
      priority: 'NORMAL',
      status: 'ACKNOWLEDGED',
      hostelId: 'BLOCK-B',
      studentId: 'demo-student-1',
      submitter: {
        id: 'demo-student-1',
        name: 'Aarav Sharma',
        roomNumber: 'B-302',
        studentId: 'STU-B-302',
      },
      assignedWardenId: 'demo-warden-1',
      assignedWarden: {
        id: 'demo-warden-1',
        name: 'Rajesh Singh',
        email: 'warden.singh@hostel.edu',
      },
      deadline: new Date(now + 60 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 12 * 3600 * 1000).toISOString(),
      upvoteCount: 9, // Exactly 9 upvotes! Next upvote triggers 10-vote emergency escalation!
      hasUpvoted: false,
      isOwner: false,
      confirmationRound: 1,
      statusHistory: [
        {
          id: 'sh-31',
          complaintId: 'comp-3',
          fromStatus: 'SUBMITTED',
          toStatus: 'ACKNOWLEDGED',
          changedById: 'demo-warden-1',
          note: 'Assigned ticket to network administrator',
          createdAt: new Date(now - 10 * 3600 * 1000).toISOString(),
        },
      ],
      photos: [],
    },
    {
      id: 'comp-4',
      readableId: 'HM-0028',
      title: 'Broken Bathroom Door Latch Room B-214',
      description: 'Lock barrel jammed from inside, door latch mechanism damaged.',
      category: 'FURNITURE',
      priority: 'NORMAL',
      status: 'RESOLVED',
      hostelId: 'BLOCK-B',
      studentId: 'demo-student-1',
      submitter: {
        id: 'demo-student-1',
        name: 'Aarav Sharma',
        roomNumber: 'B-302',
        studentId: 'STU-B-302',
      },
      assignedWardenId: 'demo-warden-1',
      assignedWarden: {
        id: 'demo-warden-1',
        name: 'Rajesh Singh',
        email: 'warden.singh@hostel.edu',
      },
      resolvedAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      deadline: new Date(now - 24 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 72 * 3600 * 1000).toISOString(),
      upvoteCount: 3,
      hasUpvoted: false,
      isOwner: true,
      confirmationRound: 1,
      resolutionNote: 'Replaced brass latch barrel assembly and tested lock.',
      photos: [],
    },
  ];
}

export function getMockComplaints(): Complaint[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const init = getInitialComplaints();
  saveMockComplaints(init);
  return init;
}

export function saveMockComplaints(list: Complaint[]): void {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // fallback
  }
}

export function handleMockFallback<T>(endpoint: string, options: RequestInit = {}): T | null {
  const method = (options.method || 'GET').toUpperCase();
  const cleanEndpoint = endpoint.split('?')[0];

  // 1. Auth Me
  if (cleanEndpoint === '/api/auth/me') {
    const user = getStoredDemoUser();
    if (!user) {
      throw new Error('Not authenticated');
    }
    return { user } as unknown as T;
  }

  // 2. Auth Logout
  if (cleanEndpoint === '/api/auth/logout') {
    setStoredDemoUser(null);
    return { message: 'Logged out successfully' } as unknown as T;
  }

  // 3. Public Stats (Powers Three.js Lit Windows & Counters)
  if (cleanEndpoint === '/api/public/stats') {
    return {
      totalCount: 120,
      resolvedCount: 84,
      emergencyCount: 4,
      hostelCount: 2,
      resolvedPercentage: 70,
    } as unknown as T;
  }

  // 4. Quota Status
  if (cleanEndpoint === '/api/quota') {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString();
    const daysUntilMon = (8 - now.getDay()) % 7 || 7;
    const mondayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMon, 0, 0, 0).toISOString();

    const quota: QuotaStatus = {
      normalLeftToday: 1,
      emergencyLeftThisWeek: 1,
      normalDailyLimit: 2,
      emergencyWeeklyLimit: 1,
      nextDailyResetTime: midnight,
      nextWeeklyResetTime: mondayReset,
      timezone: 'Asia/Kolkata',
    };
    return { quota } as unknown as T;
  }

  // 5. Community Feed
  if (cleanEndpoint === '/api/feed') {
    const complaints = getMockComplaints();
    return {
      feed: complaints,
      pagination: {
        limit: 10,
        nextCursor: null,
        hasMore: false,
      },
    } as unknown as T;
  }

  // 6. My Complaints & History
  if (cleanEndpoint === '/api/complaints/mine' || cleanEndpoint === '/api/history') {
    const complaints = getMockComplaints();
    return {
      complaints,
      pagination: {
        page: 1,
        limit: 10,
        totalCount: complaints.length,
        totalPages: 1,
      },
    } as unknown as T;
  }

  // 7. Upvote Endpoint (POST /api/complaints/:id/upvote)
  if (cleanEndpoint.match(/\/api\/complaints\/[^/]+\/upvote/) && method === 'POST') {
    const id = cleanEndpoint.split('/')[3];
    const list = getMockComplaints();
    const item = list.find((c) => c.id === id || c.readableId === id);
    if (item) {
      item.upvoteCount = (item.upvoteCount || 0) + 1;
      item.hasUpvoted = true;

      let promoted = false;
      // 10 Upvote Promotion Engine Trigger!
      if (item.upvoteCount >= 10 && item.priority === 'NORMAL') {
        item.priority = 'EMERGENCY';
        item.deadline = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        item.priorityHistory = item.priorityHistory || [];
        item.priorityHistory.push({
          id: 'ph-' + Date.now(),
          complaintId: item.id,
          fromPriority: 'NORMAL',
          toPriority: 'EMERGENCY',
          reason: 'Auto-promoted after reaching 10 community upvotes',
          createdAt: new Date().toISOString(),
        });
        promoted = true;
      }
      saveMockComplaints(list);
      return {
        upvoteCount: item.upvoteCount,
        priority: item.priority,
        promotedToEmergency: promoted,
      } as unknown as T;
    }
    return { upvoteCount: 10, priority: 'EMERGENCY', promotedToEmergency: true } as unknown as T;
  }

  // 8. Remove Upvote (DELETE /api/complaints/:id/upvote)
  if (cleanEndpoint.match(/\/api\/complaints\/[^/]+\/upvote/) && method === 'DELETE') {
    const id = cleanEndpoint.split('/')[3];
    const list = getMockComplaints();
    const item = list.find((c) => c.id === id || c.readableId === id);
    if (item) {
      item.upvoteCount = Math.max(0, (item.upvoteCount || 1) - 1);
      item.hasUpvoted = false;
      saveMockComplaints(list);
      return { upvoteCount: item.upvoteCount } as unknown as T;
    }
    return { upvoteCount: 9 } as unknown as T;
  }

  // 9. Confirmation Vote (POST /api/complaints/:id/confirm)
  if (cleanEndpoint.match(/\/api\/complaints\/[^/]+\/confirm/) && method === 'POST') {
    const id = cleanEndpoint.split('/')[3];
    const list = getMockComplaints();
    const item = list.find((c) => c.id === id || c.readableId === id);
    let voteType = 'SOLVED';
    try {
      if (options.body) {
        const parsed = JSON.parse(options.body as string);
        voteType = (parsed.vote || parsed.action || 'SOLVED').toUpperCase();
      }
    } catch {
      // fallback
    }

    if (item) {
      item.confirmationSummary = item.confirmationSummary || {
        solvedCount: 0,
        notSolvedCount: 0,
        requiredVotes: 3,
        round: item.confirmationRound || 1,
        windowEndsAt: item.confirmationWindowEndsAt || null,
        isWindowOpen: true,
        userVote: null,
      };

      if (voteType === 'SOLVED') {
        item.confirmationSummary.solvedCount = (item.confirmationSummary.solvedCount || 0) + 1;
        item.confirmationSummary.userVote = 'SOLVED';
        // 3 Solved Consensus!
        if (item.confirmationSummary.solvedCount >= 3) {
          item.status = 'RESOLVED';
          item.resolvedAt = new Date().toISOString();
          item.confirmationSummary.isWindowOpen = false;
        }
      } else {
        item.confirmationSummary.notSolvedCount = (item.confirmationSummary.notSolvedCount || 0) + 1;
        item.confirmationSummary.userVote = 'NOT_SOLVED';
        // 3 Not Solved Consensus!
        if (item.confirmationSummary.notSolvedCount >= 3) {
          item.status = 'REOPENED';
          item.confirmationRound = (item.confirmationRound || 1) + 1;
          item.confirmationSummary.isWindowOpen = false;
        }
      }
      saveMockComplaints(list);
      return {
        solvedCount: item.confirmationSummary.solvedCount,
        notSolvedCount: item.confirmationSummary.notSolvedCount,
        requiredVotes: 3,
        status: item.status,
      } as unknown as T;
    }
  }

  // 10. Rating Submission (POST /api/complaints/:id/rating)
  if (cleanEndpoint.match(/\/api\/complaints\/[^/]+\/rating/) && method === 'POST') {
    return { message: 'Rating recorded successfully (Demo Mode)' } as unknown as T;
  }

  // 11. Single Complaint Details (GET /api/complaints/:id or /api/warden/complaints/:id)
  if (cleanEndpoint.match(/\/api\/(complaints|warden\/complaints)\/([^/]+)$/) && method === 'GET') {
    const parts = cleanEndpoint.split('/');
    const id = parts[parts.length - 1];
    const list = getMockComplaints();
    const item = list.find((c) => c.id === id || c.readableId === id) || list[0];
    return { complaint: item } as unknown as T;
  }

  // 12. Create New Complaint (POST /api/complaints)
  if (cleanEndpoint === '/api/complaints' && method === 'POST') {
    let payload: any = {};
    if (options.body instanceof FormData) {
      payload = {
        title: options.body.get('title') || 'New Hostel Complaint',
        description: options.body.get('description') || 'Maintenance request description',
        category: options.body.get('category') || 'OTHER',
        priority: options.body.get('priority') || 'NORMAL',
      };
    } else if (typeof options.body === 'string') {
      try {
        payload = JSON.parse(options.body);
      } catch {}
    }

    const list = getMockComplaints();
    const nextNum = list.length + 45;
    const isEmerg = payload.priority === 'EMERGENCY';
    const newComp: Complaint = {
      id: 'comp-' + Date.now(),
      readableId: `HM-${String(nextNum).padStart(4, '0')}`,
      title: payload.title || 'New Maintenance Complaint',
      description: payload.description || 'Routine issue reported by student resident.',
      category: payload.category || 'OTHER',
      priority: isEmerg ? 'EMERGENCY' : 'NORMAL',
      status: 'SUBMITTED',
      hostelId: 'BLOCK-B',
      studentId: 'demo-student-1',
      submitter: {
        id: 'demo-student-1',
        name: 'Aarav Sharma',
        roomNumber: 'B-302',
        studentId: 'STU-B-302',
      },
      deadline: new Date(Date.now() + (isEmerg ? 24 : 72) * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      upvoteCount: 0,
      hasUpvoted: false,
      isOwner: true,
      confirmationRound: 1,
      statusHistory: [
        {
          id: 'sh-' + Date.now(),
          complaintId: 'comp-' + Date.now(),
          fromStatus: null,
          toStatus: 'SUBMITTED',
          changedById: 'demo-student-1',
          note: 'Complaint registered by student',
          createdAt: new Date().toISOString(),
        },
      ],
      photos: [],
    };
    list.unshift(newComp);
    saveMockComplaints(list);
    return {
      complaint: newComp,
      id: newComp.id,
      readableId: newComp.readableId,
      priority: newComp.priority,
      deadline: newComp.deadline,
    } as unknown as T;
  }

  // 13. Notifications Center
  if (cleanEndpoint.startsWith('/api/notifications')) {
    if (cleanEndpoint.endsWith('/read') || cleanEndpoint.endsWith('/read-all')) {
      return { message: 'Notifications marked as read', unreadCount: 0 } as unknown as T;
    }
    return {
      notifications: [
        {
          id: 'notif-1',
          userId: 'demo-student-1',
          type: 'PRIORITY_ESCALATED',
          title: 'Emergency Priority Escalation',
          message: 'Complaint HM-0042 reached 10 community upvotes and was promoted to EMERGENCY with a 24-hour SLA.',
          read: false,
          data: { complaintId: 'comp-1' },
          createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        },
        {
          id: 'notif-2',
          userId: 'demo-student-1',
          type: 'STATUS_CHANGED',
          title: 'Complaint Marked Resolved',
          message: 'Warden Rajesh Singh marked HM-0039 as resolved. Please verify the fix within 24 hours.',
          read: true,
          data: { complaintId: 'comp-2' },
          createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        },
      ],
      unreadCount: 1,
      pagination: {
        page: 1,
        limit: 20,
        totalCount: 2,
        totalPages: 1,
      },
    } as unknown as T;
  }

  // 14. Warden Queue (GET /api/warden/queue)
  if (cleanEndpoint === '/api/warden/queue') {
    const complaints = getMockComplaints();
    return {
      queue: complaints,
      total: complaints.length,
      overdueCount: complaints.filter((c: any) => c.status === 'IN_PROGRESS').length,
      emergencyCount: complaints.filter((c: any) => c.priority === 'EMERGENCY').length,
    } as unknown as T;
  }

  // 15. Warden Status Update (POST /api/warden/complaints/:id/status)
  if (cleanEndpoint.match(/\/api\/warden\/complaints\/[^/]+\/status/) && method === 'POST') {
    const id = cleanEndpoint.split('/')[4];
    const list = getMockComplaints();
    const item = list.find((c) => c.id === id || c.readableId === id);
    const body = options.body ? JSON.parse(options.body as string) : {};

    if (item && body.status) {
      item.status = body.status;
      if (body.status === 'MARKED_RESOLVED') {
        item.resolutionNote = body.resolutionNote || 'Work inspected and completed by maintenance team.';
        item.markedResolvedAt = new Date().toISOString();
        item.confirmationWindowEndsAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        item.confirmationSummary = {
          solvedCount: 0,
          notSolvedCount: 0,
          requiredVotes: 3,
          round: item.confirmationRound || 1,
          windowEndsAt: item.confirmationWindowEndsAt,
          isWindowOpen: true,
          userVote: null,
        };
      }
      saveMockComplaints(list);
      return { complaint: item } as unknown as T;
    }
  }

  // 16. Warden Score & Performance
  if (cleanEndpoint === '/api/warden/score') {
    return {
      score: {
        averageRating: 2.8,
        totalRatings: 14,
        totalPenalties: 1,
        compositeScore: 2.3,
        penalties: [
          {
            id: 'pen-1',
            complaintId: 'comp-1',
            deadlineAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
            points: 1,
            reason: '72h SLA resolution deadline breached before repair completion.',
          },
        ],
      },
    } as unknown as T;
  }

  // 17. Admin Endpoints
  if (cleanEndpoint.startsWith('/api/admin/')) {
    if (cleanEndpoint.includes('/reports')) {
      return {
        totalComplaints: 120,
        resolvedComplaints: 84,
        slaCompliancePercentage: 92,
        medianResolutionHours: 14.5,
        reopenedRatePercentage: 3.2,
        escalatedToEmergencyCount: 4,
        averageStudentRating: 4.2,
        totalPenaltiesApplied: 1,
        byCategory: [
          { category: 'PLUMBING', count: 48, resolved: 36 },
          { category: 'ELECTRICAL', count: 32, resolved: 24 },
          { category: 'INTERNET', count: 22, resolved: 14 },
          { category: 'CLEANLINESS', count: 12, resolved: 8 },
          { category: 'FURNITURE', count: 6, resolved: 2 },
        ],
        byHostel: [
          { hostelName: 'Tagore Hall (Block B)', total: 82, resolved: 58, overdue: 1 },
          { hostelName: 'Ramanujan Hall (Block A)', total: 38, resolved: 26, overdue: 0 },
        ],
      } as unknown as T;
    }
    if (cleanEndpoint.includes('/audit')) {
      return {
        events: [
          {
            id: 'aud-1',
            actorId: 'admin-1',
            action: 'COMPLAINT_SUBMITTED',
            entityType: 'Complaint',
            entityId: 'HM-0044',
            timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
          },
          {
            id: 'aud-2',
            actorId: 'warden-1',
            action: 'STATUS_CHANGED',
            entityType: 'Complaint',
            entityId: 'HM-0039',
            timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          },
          {
            id: 'aud-3',
            actorId: 'system',
            action: 'PROMOTED_EMERGENCY',
            entityType: 'Complaint',
            entityId: 'HM-0042',
            timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          },
        ],
        auditLogs: [],
      } as unknown as T;
    }
    if (cleanEndpoint.includes('/users')) {
      return {
        users: [
          DEMO_STUDENT,
          DEMO_WARDEN,
          DEMO_ADMIN,
        ],
      } as unknown as T;
    }
    if (cleanEndpoint.includes('/hostels')) {
      return {
        hostels: [
          { id: 'h-1', name: 'Tagore Hall (Block B)', code: 'BLOCK-B', timezone: 'Asia/Kolkata', _count: { users: 15, complaints: 4 } },
          { id: 'h-2', name: 'Ramanujan Hall (Block A)', code: 'BLOCK-A', timezone: 'Asia/Kolkata', _count: { users: 5, complaints: 2 } },
        ],
      } as unknown as T;
    }
    if (cleanEndpoint.includes('/policies')) {
      return {
        policies: [
          { id: 'pol-1', hostelId: 'BLOCK-B', normalDeadlineHours: 72, emergencyDeadlineHours: 24, upvotesToEscalate: 10, confirmationWindowHours: 24, timezone: 'Asia/Kolkata' },
        ],
        policy: { id: 'pol-1', hostelId: 'BLOCK-B', normalDeadlineHours: 72, emergencyDeadlineHours: 24, upvotesToEscalate: 10, confirmationWindowHours: 24, timezone: 'Asia/Kolkata' },
      } as unknown as T;
    }
    if (cleanEndpoint.includes('/complaints')) {
      const complaints = getMockComplaints();
      return {
        complaints,
        pagination: { page: 1, limit: 20, totalCount: complaints.length, totalPages: 1 },
      } as unknown as T;
    }
    if (cleanEndpoint.includes('/ratings')) {
      return {
        ratings: [
          {
            id: 'rat-1',
            complaintId: 'comp-4',
            complainantId: 'demo-student-1',
            wardenId: 'demo-warden-1',
            stars: 5,
            comment: 'Prompt resolution of the bathroom door latch.',
            isFlagged: false,
            createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
            complaint: { readableId: 'HM-0028', title: 'Broken Bathroom Door Latch Room B-214' },
          },
        ],
      } as unknown as T;
    }

    // Default admin mutation response
    return { success: true, message: 'Operation completed (Demo Mode)' } as unknown as T;
  }

  return null;
}
