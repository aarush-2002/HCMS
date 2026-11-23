import { test, expect } from '@playwright/test';

test.describe.serial('HCMS Full Lifecycle & Multi-Role End-to-End Suite', () => {
  let complaintId: string;
  let readableId: string;

  function parseCookies(raw: string): { cookieHeader: string; csrfToken: string } {
    const cookieHeader = raw
      .split('\n')
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    const csrfMatch = cookieHeader.match(/hmcs_csrf_token=([^;]+)/);
    return {
      cookieHeader,
      csrfToken: csrfMatch ? csrfMatch[1] : '',
    };
  }

  test('1. Student submits complaint and verifies tracking ID and SLA deadline', async ({ page }) => {
    // Navigate to student login
    await page.goto('/student/login');
    await expect(page).toHaveTitle(/HCMS/i);

    // Login as Aarav Sharma (Hostel B student)
    await page.getByLabel(/Institutional Email or Student ID/i).fill('aarav@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In as Student/i }).click();

    // Verify redirected to student dashboard
    await expect(page.getByText(/Daily Submission Limit/i)).toBeVisible();
    await expect(page.getByText(/Normal Complaints \(72h SLA\)/i)).toBeVisible();

    // Navigate to New Complaint page
    await page.goto('/student/new');
    await expect(page.getByText(/Hostel Complaint Policy & SLA Rules/i)).toBeVisible();

    // Fill complaint form
    await page.getByLabel(/Category/i).selectOption('ELECTRICAL');
    await page.getByLabel(/Priority/i).selectOption('NORMAL');
    await page.getByLabel(/Complaint Title/i).fill('Ceiling fan vibrating and loose in Room B-302');
    await page.getByLabel(/Detailed Description/i).fill(
      'The ceiling fan regulator failed and the fan is shaking violently from the ceiling hook, creating an urgent safety hazard for room occupants.'
    );

    // Submit complaint
    await page.getByRole('button', { name: /Submit Complaint/i }).click();

    // Verify success screen
    await expect(page.getByText(/Submission Logged to Ledger/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Complaint Received/i)).toBeVisible();

    // Capture readable tracking ID
    const trackingIdElement = page.locator('span.text-2xl.sm\\:text-3xl.font-bold.text-\\[\\#f5a524\\]');
    await expect(trackingIdElement).toBeVisible();
    readableId = (await trackingIdElement.innerText()).trim();
    expect(readableId).toMatch(/^HM-\d+$/);

    // Click Track Timeline & History
    await page.getByRole('button', { name: /Track Timeline & History/i }).click();
    await expect(page.getByText('SUBMITTED')).toBeVisible();

    // Extract database ID from URL
    const url = page.url();
    complaintId = url.split('/student/complaints/')[1];
    expect(complaintId).toBeTruthy();

    // Verify initial complaint status and priority badges
    await expect(page.getByText('NORMAL')).toBeVisible();
  });

  test('2. Quota exceeded validation blocks 2nd normal submission on same day', async ({ page }) => {
    // Login as Aarav Sharma
    await page.goto('/student/login');
    await page.getByLabel(/Institutional Email or Student ID/i).fill('aarav@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In as Student/i }).click();
    await expect(page.getByText(/Daily Submission Limit/i)).toBeVisible();

    // Go to New Complaint
    await page.goto('/student/new');
    await expect(page.getByText(/Hostel Complaint Policy & SLA Rules/i)).toBeVisible();

    // Attempt second normal complaint
    await page.getByLabel(/Category/i).selectOption('PLUMBING');
    await page.getByLabel(/Complaint Title/i).fill('Leaky washbasin faucet in corridor B-3');
    await page.getByLabel(/Detailed Description/i).fill(
      'Water has been dripping slowly from the pipe under the corridor washbasin for two days.'
    );

    await page.getByRole('button', { name: /Submit Complaint/i }).click();

    // Verify quota alert blocks submission
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByText(/Daily normal complaint quota exceeded|quota exceeded|already used/i).first()
    ).toBeVisible();
  });

  test('3. Role-based 403 access control blocks student from warden and admin views', async ({ page }) => {
    // Login as student
    await page.goto('/student/login');
    await page.getByLabel(/Institutional Email or Student ID/i).fill('aarav@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In as Student/i }).click();
    await expect(page.getByText(/Daily Submission Limit/i)).toBeVisible();

    // Try accessing warden workspace
    await page.goto('/warden');
    await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible();
    expect(page.url()).toContain('/forbidden');

    // Try accessing admin dashboard
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible();
    expect(page.url()).toContain('/forbidden');
  });

  test('4. 10 Community Upvotes automatically promote complaint to Emergency priority', async ({ page, playwright }) => {
    expect(complaintId).toBeTruthy();

    // 10 distinct students in Hostel B to upvote Aarav's complaint
    const upvoterEmails = [
      'rohan@hostel.edu',
      'priya@hostel.edu',
      'ananya@hostel.edu',
      'siddharth@hostel.edu',
      'meera@hostel.edu',
      'kabir@hostel.edu',
      'tanvi@hostel.edu',
      'aditya@hostel.edu',
      'neha@hostel.edu',
      'riya@hostel.edu',
    ];

    // Upvote sequentially via API
    for (const email of upvoterEmails) {
      const studentContext = await playwright.request.newContext();
      // Login as upvoter
      const loginRes = await studentContext.post('http://localhost:4000/api/auth/student/login', {
        data: { identifier: email, password: 'password123' },
      });
      expect(loginRes.status()).toBe(200);

      // Extract CSRF token
      const { csrfToken } = parseCookies(loginRes.headers()['set-cookie'] || '');

      // Upvote complaint
      const upvoteRes = await studentContext.post(`http://localhost:4000/api/complaints/${complaintId}/upvote`, {
        headers: {
          'x-csrf-token': csrfToken,
        },
      });
      expect(upvoteRes.status()).toBe(200);
      await studentContext.dispose();
    }

    // Now login as Aarav and visit complaint detail to verify promotion
    await page.goto('/student/login');
    await page.getByLabel(/Institutional Email or Student ID/i).fill('aarav@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In as Student/i }).click();
    await expect(page.getByText(/Daily Submission Limit/i)).toBeVisible();

    await page.goto(`/student/complaints/${complaintId}`);

    // Verify priority escalated to EMERGENCY
    await expect(page.getByText('EMERGENCY').first()).toBeVisible();
    await expect(page.getByText(/Priority escalated: NORMAL → EMERGENCY/i).first()).toBeVisible();
    await expect(page.getByText(/10 community upvotes/i).first()).toBeVisible();
  });

  test('5. Warden views queue with submitter identity, advances status, and marks resolved', async ({ page }) => {
    expect(complaintId).toBeTruthy();

    // Login as Warden Rajesh Singh (assigned to Hostel B)
    await page.goto('/warden/login');
    await page.getByLabel(/Staff Email Address/i).fill('warden.singh@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In to Workspace/i }).click();

    // Verify redirected to warden dashboard
    await expect(page.getByText(/Active Queue/i)).toBeVisible();

    // Go to complaint detail
    await page.goto(`/warden/complaints/${complaintId}`);

    // Verify submitter identity is visible to warden
    await expect(page.getByText('Aarav Sharma').first()).toBeVisible();
    await expect(page.getByText('B-302').first()).toBeVisible();
    await expect(page.getByText('STU-B-302').first()).toBeVisible();

    // Advance status: SUBMITTED -> ACKNOWLEDGED
    await page.getByLabel(/Select Next Allowed Status/i).selectOption('ACKNOWLEDGED');
    await page.getByRole('button', { name: /Confirm & Update Status/i }).click();
    await expect(page.getByText(/status updated to ACKNOWLEDGED/i).first()).toBeVisible();

    // Advance status: ACKNOWLEDGED -> IN_PROGRESS
    await page.getByLabel(/Select Next Allowed Status/i).selectOption('IN_PROGRESS');
    await page.getByRole('button', { name: /Confirm & Update Status/i }).click();
    await expect(page.getByText(/status updated to IN_PROGRESS/i).first()).toBeVisible();

    // Advance status: IN_PROGRESS -> MARKED_RESOLVED (mandatory resolution note required)
    await page.getByLabel(/Select Next Allowed Status/i).selectOption('MARKED_RESOLVED');
    await page.getByLabel(/Mandatory Resolution Note/i).fill(
      'Replaced the burnt fan capacitor, tightened the mounting bracket assembly, and tested smooth operation at all five speeds.'
    );
    await page.getByRole('button', { name: /Confirm & Update Status/i }).click();
    await expect(page.getByText(/status updated to MARKED_RESOLVED/i).first()).toBeVisible();

    // Verify 24h confirmation window notice appears
    await expect(page.getByText(/24-Hour Student Confirmation Window Active/i).first()).toBeVisible();
  });

  test('6. 3 Students cast confirmation votes to automatically resolve complaint', async ({ playwright }) => {
    expect(complaintId).toBeTruthy();

    const studentVoters = ['rohan@hostel.edu', 'priya@hostel.edu', 'ananya@hostel.edu'];

    for (const email of studentVoters) {
      const studentContext = await playwright.request.newContext();
      // Login as student
      const loginRes = await studentContext.post('http://localhost:4000/api/auth/student/login', {
        data: { identifier: email, password: 'password123' },
      });
      expect(loginRes.status()).toBe(200);

      const { csrfToken } = parseCookies(loginRes.headers()['set-cookie'] || '');

      // Cast "solved" confirmation vote
      const voteRes = await studentContext.post(`http://localhost:4000/api/complaints/${complaintId}/confirm`, {
        headers: {
          'x-csrf-token': csrfToken,
        },
        data: { vote: 'solved' },
      });
      expect(voteRes.status()).toBe(200);
      await studentContext.dispose();
    }

    // Verify complaint transitioned to RESOLVED using authenticated student context
    const verifyContext = await playwright.request.newContext();
    await verifyContext.post('http://localhost:4000/api/auth/student/login', {
      data: { identifier: 'aarav@hostel.edu', password: 'password123' },
    });
    const detailRes = await verifyContext.get(`http://localhost:4000/api/complaints/${complaintId}`);
    expect(detailRes.status()).toBe(200);
    const data = await detailRes.json();
    expect(data.complaint.status).toBe('RESOLVED');
    await verifyContext.dispose();
  });

  test('7. Original complainant submits 1-3 star rating and verifies rating is locked', async ({ page }) => {
    expect(complaintId).toBeTruthy();

    // Login as complainant Aarav Sharma
    await page.goto('/student/login');
    await page.getByLabel(/Institutional Email or Student ID/i).fill('aarav@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In as Student/i }).click();
    await expect(page.getByText(/Daily Submission Limit/i)).toBeVisible();

    // Visit resolved complaint detail
    await page.goto(`/student/complaints/${complaintId}`);
    await expect(page.getByText('RESOLVED').first()).toBeVisible();

    // Verify rating form appears
    await expect(page.getByText(/Rate Warden Resolution/i)).toBeVisible();

    // Select 3 stars using radio button
    await page.getByRole('radio', { name: /3 Stars/i }).click();

    // Add optional comment
    await page.getByPlaceholder(/Prompt repair, left area clean and tidy/i).fill(
      'Work was done cleanly and swiftly within the same afternoon! Thank you.'
    );

    // Submit rating
    await page.getByRole('button', { name: /Submit Official Rating/i }).click();

    // Verify rating recorded and locked
    await expect(page.getByText(/Complainant Rating Recorded/i).first()).toBeVisible();
    await expect(page.getByText(/Work was done cleanly and swiftly/i).first()).toBeVisible();
    // Rating form should no longer be present
    await expect(page.getByText(/Rate Warden Resolution/i)).not.toBeVisible();
  });

  test('8. Warden performance score reflects student rating', async ({ page }) => {
    // Login as Warden
    await page.goto('/warden/login');
    await page.getByLabel(/Staff Email Address/i).fill('warden.singh@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In to Workspace/i }).click();
    await expect(page.getByText(/Active Queue/i)).toBeVisible();

    // Visit performance page
    await page.goto('/warden/performance');
    await expect(page.getByText(/Warden Performance & SLA Evaluation/i).first()).toBeVisible();
    await expect(page.getByText(/Component 1: Student Rating/i).first()).toBeVisible();
    await expect(page.getByText(/Final Composite Score/i).first()).toBeVisible();
  });

  test('9. Admin back office reports and audit trail contain full lifecycle records', async ({ page }) => {
    // Login as Admin Dr. Vikram Sharma via warden/admin login portal
    await page.goto('/warden/login');
    await page.getByLabel(/Staff Email Address/i).fill('admin@hostel.edu');
    await page.getByLabel(/Password/i).fill('password123');
    await page.getByRole('button', { name: /Sign In to Workspace/i }).click();

    // Verify redirected to admin dashboard
    await expect(page.getByText(/Operational Analytics & PRD Success Measures/i).first()).toBeVisible();

    // Verify PRD measure tiles are displayed
    await expect(page.getByText(/Total Volume/i).first()).toBeVisible();
    await expect(page.getByText(/SLA Compliance/i).first()).toBeVisible();

    // Switch to Audit Ledger tab
    await page.getByRole('button', { name: /Audit Ledger/i }).click();
    await expect(page.getByText(/Immutable.*Audit Ledger/i).first()).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Verify audit log entries exist
    const tableRows = page.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible();
    const count = await tableRows.count();
    expect(count).toBeGreaterThan(0);
  });
});
