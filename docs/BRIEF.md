# HCMS (Hostel Complaint Management System) — Project Brief & Source of Truth

**Status:** Active Canonical Specification  
**Version:** 1.0.0  
**Scope:** Monorepo (`/web` React + Vite + TS, `/api` Express + TS + Prisma + PostgreSQL)

---

## 1. PURPOSE

Students report hostel problems, support each other's complaints with upvotes, and confirm whether they were fixed. Wardens manage a prioritised queue against deadlines. Wardens are scored through student ratings and deadline penalties. Everything is auditable.

---

## 2. ROLES & ACCESS CONTROL

* **Roles:** `STUDENT`, `WARDEN`, `ADMIN`.
* **Scope & Membership:** Every user belongs to a hostel. Wardens are explicitly assigned to one or more hostels/buildings via `WardenAssignment`.
* **Enforcement:** Enforce role-based access control and hostel scoping strictly on the server (in API middleware and controllers), not just in the UI.
* **Privilege Separation:**
  * Students must never reach or invoke warden or admin actions.
  * Wardens must never submit student votes (upvotes or resolution confirmation votes) or submit ratings as students.
  * Admins manage policies, users, warden assignments, and review dispute/penalty exceptions.

---

## 3. BUSINESS RULES (Configurable via Policy Table)

All rules are parameterized and stored in a system `Policy` table with the following canonical defaults:

1. **Submission Quotas:**
   * **Normal Complaints:** 1 normal complaint per student per calendar day.
   * **Emergency Complaints:** 1 emergency complaint per student per calendar week (calendar week begins Monday 00:00).
   * **Timezone:** Evaluated in the hostel's configured time zone (default: `Asia/Kolkata`).
   * A promoted normal complaint does **not** consume the student's emergency allowance.

2. **Resolution Deadlines (SLAs):**
   * **Normal Deadline:** 72 hours from submission.
   * **Emergency Deadline:** 24 hours from submission.

3. **Community Escalation (Upvotes):**
   * Students can cast one upvote per eligible complaint in their hostel.
   * Students **cannot** upvote their own complaint.
   * When a normal complaint reaches **10 eligible upvotes**, it is automatically promoted to Emergency priority.
   * The 24-hour deadline restarts at the promotion timestamp.
   * Promotion is recorded in `PriorityHistory` and logged to `AuditEvent`.

4. **Complaint Statuses:**
   * `SUBMITTED` — Received by HCMS.
   * `ACKNOWLEDGED` — Reviewed by the assigned warden.
   * `IN_PROGRESS` — Remediation work is active.
   * `MARKED_RESOLVED` — Warden reports the fix addressed; service deadline ends; student confirmation window opens.
   * `RESOLVED` — 3 student "Solved" votes verified inside confirmation window. Leaves active feed; retained in history.
   * `REOPENED` — 3 student "Not solved" votes cast or rejected fix.
   * `CLOSED` — Archived or administratively resolved.
   * `REJECTED` — Invalid/spam (admin-approved only, reason required).

5. **Resolution Confirmation Window:**
   * When a warden marks an issue `MARKED_RESOLVED`, a **24-hour confirmation window** opens.
   * Marking `MARKED_RESOLVED` stops the service deadline clock.
   * Eligible students (all students of that hostel) cast one vote each: `SOLVED` or `NOT_SOLVED`.
   * **3 Solved votes** within the 24h window mark it `RESOLVED` (leaves active feed; retained in history).
   * **3 Not Solved votes** within the window automatically transition the status to `REOPENED`.
   * If the 24-hour window lapses with neither threshold reached, the complaint returns to `IN_PROGRESS` for warden review.

6. **Warden Ratings:**
   * Once a complaint is `RESOLVED`, only the **original complainant** may rate the responsible warden.
   * Scale: **1 to 3 stars** (integer).
   * Limit: Exactly once per complaint.

7. **Deadlines, Overdue Complaints & Scoring:**
   * If a complaint passes its active deadline without being `MARKED_RESOLVED`, the responsible warden receives a **−1 penalty**.
   * Penalties are **idempotent**: applied exactly once per complaint/deadline cycle, traceable to the specific complaint, deadline, and event timestamp (`PenaltyEvent`).
   * Penalties are stored separately from star ratings.
   * The warden score view transparently displays:
     * Average student star rating (1–3 stars).
     * Total deadline penalties count.
     * Net composite score formula: $\text{Score} = \text{Average Rating} - (0.5 \times \text{Penalties})$.

8. **Privacy & Identity:**
   * Complainant identity is **anonymized / hidden** from other students in the hostel feed.
   * Submitter name and room details are visible only to the assigned warden and admins.

9. **Attachments (Photos):**
   * Photos are optional.
   * Supported formats: `image/jpeg`, `image/png`, `image/webp`.
   * Size limit: Maximum **2 MB** per file.
   * Quantity limit: Up to **3 photos** per complaint.
   * Access: Scoped strictly to authenticated users in the same hostel.

10. **Data Integrity & Auditability:**
    * **No hard deletions.**
    * Every vote (`Upvote`, `ConfirmationVote`), rating (`Rating`), status transition (`StatusHistory`), priority transition (`PriorityHistory`), and penalty (`PenaltyEvent`) is an immutable discrete record.
    * Every significant mutation is recorded in `AuditEvent` (`actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `ipAddress`, `timestamp`).

---

## 4. DESIGN LANGUAGE & TOKENS

* **Aesthetic:** Dark cinematic "night hostel" look.
* **Palette:**
  * Background (`bg`): `#05070a`
  * Text Primary: `#dfe7e0`
  * Text Muted: `#9aa5a0`
  * Accent Amber: `#f5a524`
  * Danger / Emergency / Late: `#ff5a5f`
  * Info / Blue: `#7fb4c9`
  * Success / Resolved: `#6fcf97`
  * Card / Surface: `#0d121a`
  * Border: `#1c2430`
* **Typography:** Font family `Onest`, sans-serif.
* **Accessibility Rule:** **Never rely on colour alone for status.** Always pair color with text labels, iconography, and explicit deadline metrics.
