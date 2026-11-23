# HCMS — Hostel Complaint Management System (आवाज़)

[![E2E Tests](https://img.shields.io/badge/Playwright%20E2E-9%2F9%20Passing-brightgreen.svg)]()
[![API Integration Tests](https://img.shields.io/badge/Vitest%20API-87%2F87%20Passing-brightgreen.svg)]()
[![Web Unit Tests](https://img.shields.io/badge/Vitest%20Web-15%2F15%20Passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%200%20Errors-blue.svg)]()

HCMS (आवाज़) is an auditable, transparent hostel management and complaint resolution platform built for hostel residents, wardens, and university administrators. It balances student empowerment (community upvoting, anonymous feed, resolution confirmation) with structured warden accountability (prioritised queues, strict SLAs, automated penalty deductions, and performance scoring).

The canonical specification and single source of truth is maintained in [`/docs/BRIEF.md`](./docs/BRIEF.md).

---

## 1. System Architecture

```mermaid
graph TD
    subgraph Client ["Frontend (/web)"]
        SPA["React 18 + Vite + TS SPA"]
        ThreeCanvas["Three.js Night Block Silhouette"]
        StudentUI["Student Portal (Feed, Quotas, Filing, Voting, Ratings)"]
        WardenUI["Warden Workspace (Prioritised Queue, Status, Performance)"]
        AdminUI["Admin Console (PRD Analytics, Policies, Ledger, Exceptions)"]
    end

    subgraph Gateway ["Security & Transport Layer"]
        CORS["Strict CORS & Helmet"]
        CSRF["Double-Submit Cookie CSRF Protection"]
        CookieAuth["httpOnly JWT (15m Access + 7d Rotating Refresh)"]
        RateLimit["IP & Account Brute-Force Rate Limiting"]
    end

    subgraph Server ["Backend API (/api)"]
        Router["Express + TypeScript Router"]
        ScopeMiddleware["Hostel Scoping & Role Guard Middleware"]
        CronService["Node-Cron Deadline & Penalty Engine"]
        PhotoService["Multer + Magic Byte & EXIF Stripper"]
        TxLock["PostgreSQL Advisory & Row Locks"]
    end

    subgraph Storage ["Persistence Layer"]
        Prisma["Prisma ORM (14 Models, Strict Relational Indexes)"]
        PG[("PostgreSQL Database")]
        Uploads[("Sanitized Local File Storage")]
    end

    SPA --> Gateway
    Gateway --> Server
    Server --> TxLock
    TxLock --> Prisma
    Prisma --> PG
    Server --> Uploads
```

---

## 2. Complaint Lifecycle & State Machine

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Student Submits (Quota Checked)
    
    SUBMITTED --> ACKNOWLEDGED : Warden Acknowledges
    ACKNOWLEDGED --> IN_PROGRESS : Work Commenced
    REOPENED --> IN_PROGRESS : Warden Re-investigates
    
    IN_PROGRESS --> MARKED_RESOLVED : Warden Completes Fix (Mandatory Resolution Note)
    note right of MARKED_RESOLVED
      - Service SLA clock stops
      - 24-Hour Student Confirmation Window opens
    end note
    
    MARKED_RESOLVED --> RESOLVED : 3 Students Confirm 'SOLVED'
    note right of RESOLVED
      - Ticket leaves active feed
      - Complainant receives 1-3 star rating prompt
    end note
    
    MARKED_RESOLVED --> REOPENED : 3 Students Vote 'NOT_SOLVED'
    MARKED_RESOLVED --> IN_PROGRESS : 24h Window Lapses without 3 votes
    
    RESOLVED --> CLOSED : Archived / End of Term
    SUBMITTED --> REJECTED : Admin Only (Invalid / Spam Reason Required)
    
    state "Priority Escalation" as Escalation {
        NORMAL --> EMERGENCY : 10 Community Upvotes (24h SLA Restarts)
    }
```

---

## 3. Business Rules Enforcement Matrix

Every rule from [`/docs/BRIEF.md`](./docs/BRIEF.md) is strictly implemented on both server and client:

| Rule # | Business Requirement | Backend Enforcement Mechanism | Frontend UI Verification |
|---|---|---|---|
| **1. Submission Quota** | 1 normal/day, 1 emergency/week in hostel timezone | `api/src/routes/complaints.ts` with `pg_advisory_xact_lock` and unique index | `web/src/components/complaints/QuotaCards.tsx` live indicators |
| **2. SLAs & Deadlines** | Normal: 72h SLA, Emergency: 24h SLA | Computed at creation/promotion in transaction from `Policy` | `web/src/components/ui/Countdown.tsx` active timers |
| **3. Community Escalation** | 10 upvotes auto-promotes to Emergency, resets SLA | `feedAndVotes.ts` under `FOR UPDATE` lock, atomic `PriorityHistory` | Optimistic upvote button + real-time badge escalation |
| **4. Submitter Privacy** | Peer students never see author identity; staff sees full details | `api/src/utils/complaintSerializer.ts` strips identity for non-staff/non-owner | Anonymous card badges in feed; full author details in warden view |
| **5. Confirmation Window** | 24h community confirmation: 3 solved = RESOLVED, 3 not solved = REOPENED | `api/src/routes/resolutionAndHistory.ts` atomic evaluation | `ConfirmationBar.tsx` progress indicators and voting buttons |
| **6. Complainant Rating** | 1–3 stars once per complaint, only original author | `api/src/routes/resolutionAndHistory.ts` with unique `complaintId` | `StarRating.tsx` input shown only to author when status is `RESOLVED` |
| **7. Warden Scoring** | $\text{Score} = \text{Rating} - (0.5 \times \text{Penalties})$; idempotent $-1$ on SLA breach | `services/deadlineEngine.ts` and `api/src/routes/warden.ts` | `/warden/performance` transparent breakdown and formula |
| **8. Photo Security** | Up to 3 photos (JPEG, PNG, WebP), max 2MB, EXIF stripped | `api/src/services/PhotoService.ts` magic byte inspection + Sharp | Drag-and-drop preview with client validation and lightbox |
| **9. Audit Trail** | Immutable log for all status/priority/quota/penalty actions | Prisma `AuditEvent` write inside every mutation transaction | Admin `/admin` Audit Ledger tab with searchable log table |
| **10. Role Isolation** | Students cannot call warden endpoints; wardens cannot submit/vote | `api/src/middleware/auth.ts` `requireRole` & `assertHostelScope` | Route guards + `/forbidden` error boundary |

---

## 4. Key Architectural Decisions

1. **Argon2 Password Hashing:**
   Passwords are hashed using `argon2id` with memory-hard parameters to resist GPU cracking, stored with unique cryptographic salts.
2. **PostgreSQL Advisory Locks for Submission Quotas:**
   To guarantee that concurrent submissions cannot bypass the 1/day or 1/week limit, transactions obtain a deterministic advisory lock (`SELECT pg_advisory_xact_lock(hashtext(...))`) on the user ID, quota type, and date key before checking and recording quota.
3. **Double-Submit Cookie CSRF Defense:**
   State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require an `x-csrf-token` header matching a cryptographically signed cookie token, protecting authenticated sessions without requiring session store round-trips.
4. **Autonomous Atomic Escalation:**
   When a 10th upvote is cast, the database row is locked with `SELECT ... FOR UPDATE`. The priority update, deadline reset (+24h), `PriorityHistory` record, `AuditEvent`, and notifications happen inside a single ACID transaction.
5. **Human-Readable Sequential Tracking IDs:**
   Every complaint is given a human-friendly identifier (e.g. `HM-0001`, `HM-1042`) generated sequentially from a dedicated PostgreSQL sequence, alongside a collision-resistant CUID internal primary key.
6. **Decoupled Penalty Engine:**
   SLA breaches are evaluated by an automated cron worker that writes immutable `PenaltyEvent` records. Penalties are idempotent and traceable to the exact ticket and deadline cycle.

---

## 5. Quickstart & Local Setup

### Prerequisites
* **Node.js:** v18+ (tested on v20 and v24)
* **npm:** v9+
* **PostgreSQL:** v14+ (default port: `5433` or `5432`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy sample environment files:
```bash
cp .env.example .env
cp api/.env.example api/.env
cp web/.env.example web/.env
```

Ensure `DATABASE_URL` in `api/.env` points to your PostgreSQL instance:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hmcs_db?schema=public"
JWT_SECRET="hmcs-ultra-secure-jwt-secret-key-2026-production-ready"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
TIMEZONE="Asia/Kolkata"
```

### 3. Initialize & Seed Database
```bash
npm run db:push
npm run db:seed
```

### 4. Run Development Servers
```bash
# Run both API and Web concurrently
npm run dev

# Or run separately
npm run dev:api    # Backend at http://localhost:4000
npm run dev:web    # Frontend at http://localhost:5173
```

---

## 6. Docker Deployment

Deploy the entire stack with a single command:
```bash
docker compose up --build
```
This starts:
- **`postgres`:** Database on port `5432` with persistent volumes.
- **`hmcs-api`:** Express backend running automated migrations on boot.
- **`hmcs-web`:** Optimized Nginx container serving the Vite build with reverse proxy to `/api/`.

---

## 7. Automated Testing Suite

All tests can be executed with:

```bash
# Run Vitest unit & integration tests across all workspaces
npm run test --workspaces

# Run Playwright End-to-End multi-role test suite
npx playwright test

# Run TypeScript compilation checks
npm run lint --workspaces
```

### Verified Test Results Summary:
* **Playwright E2E Suite:** 9/9 Passed (1.0m)
  1. Student submits complaint -> verifies `HM-XXXX` tracking ID & 72h SLA.
  2. Quota enforcement blocks 2nd normal submission on same day.
  3. Role-based 403 access control blocks student from warden & admin routes.
  4. 10 community upvotes automatically promote complaint to Emergency priority (+24h SLA).
  5. Warden views queue with submitter identity, advances status sequence, and marks resolved with mandatory note.
  6. 3 students cast confirmation votes to automatically transition complaint to `RESOLVED`.
  7. Original complainant submits 1–3 star rating with comment; rating is locked.
  8. Warden composite performance score reflects student rating ($Score = Rating - 0.5 \times Penalties$).
  9. Admin back office analytics and immutable audit ledger verified.
* **Vitest Backend Suite:** 87/87 Passed
* **Vitest Frontend Suite:** 15/15 Passed
* **Total Passing Tests:** 111 / 111 (100% Green)

---

## 8. Default Seed Accounts

All accounts are created with password: `password123`

| Role | Name | Email / ID | Assigned Hostel Scope |
|---|---|---|---|
| **ADMIN** | Dr. Vikram Sharma | `admin@hostel.edu` | Campus-Wide All Hostels |
| **WARDEN** | Rajesh Singh | `warden.singh@hostel.edu` | Tagore Hall (Block B) |
| **WARDEN** | Sunita Verma | `warden.verma@hostel.edu` | Ramanujan Hall (Block A) |
| **STUDENT** | Aarav Sharma | `aarav@hostel.edu` / `STU-B-302` | Tagore Hall (Room B-302) |
| **STUDENT** | Rohan Patel | `rohan@hostel.edu` / `STU-B-205` | Tagore Hall (Room B-205) |
| **STUDENT** | Priya Nair | `priya@hostel.edu` / `STU-B-114` | Tagore Hall (Room B-114) |
| **STUDENT** | Ananya Iyer | `ananya@hostel.edu` / `STU-B-401` | Tagore Hall (Room B-401) |
