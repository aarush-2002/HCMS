import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HCMS — Architecture, Workflows & Viva Guide</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    :root {
      --primary: #0f172a;
      --primary-light: #1e293b;
      --accent: #d97706;
      --accent-light: #fef3c7;
      --accent-dark: #b45309;
      --blue: #2563eb;
      --blue-light: #eff6ff;
      --emerald: #059669;
      --emerald-light: #ecfdf5;
      --rose: #e11d48;
      --rose-light: #fff1f2;
      --purple: #7c3aed;
      --purple-light: #f5f3ff;
      --text: #0f172a;
      --text-muted: #475569;
      --bg-light: #f8fafc;
      --border: #e2e8f0;
      --border-dark: #cbd5e1;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--text);
      background: #ffffff;
      line-height: 1.6;
      font-size: 13.5px;
      -webkit-font-smoothing: antialiased;
    }

    /* Print / Page setup */
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 9px;
        color: #94a3b8;
      }
      @bottom-left {
        content: "HCMS — Technical Architecture & Viva Master Guide";
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 9px;
        color: #94a3b8;
      }
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Cover Page */
    .cover-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 20px 20px 20px;
      background: linear-gradient(145deg, #090d16 0%, #111827 50%, #1e1b4b 100%);
      color: #ffffff;
      border-radius: 16px;
      position: relative;
      overflow: hidden;
    }

    .cover-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(245, 165, 36, 0.15);
      border: 1px solid rgba(245, 165, 36, 0.4);
      color: #f5a524;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      width: fit-content;
    }

    .cover-title {
      font-size: 42px;
      font-weight: 800;
      line-height: 1.15;
      margin-top: 24px;
      letter-spacing: -1px;
      background: linear-gradient(to right, #ffffff, #e2e8f0, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cover-subtitle {
      font-size: 18px;
      font-weight: 400;
      color: #cbd5e1;
      margin-top: 14px;
      max-width: 650px;
      line-height: 1.5;
    }

    .cover-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 28px;
    }

    .cover-pill {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11.5px;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
    }

    .cover-highlights-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 36px;
    }

    .cover-highlight-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 16px;
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }

    .cover-highlight-card h4 {
      color: #f5a524;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .cover-highlight-card p {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.4;
    }

    .cover-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      padding-top: 20px;
    }

    .cover-footer-meta {
      font-size: 12px;
      color: #94a3b8;
    }

    .cover-footer-meta strong {
      color: #ffffff;
    }

    /* Headings */
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.5px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--accent);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
      margin-top: 22px;
      margin-bottom: 10px;
      letter-spacing: -0.3px;
    }

    h3 {
      font-size: 14.5px;
      font-weight: 700;
      color: var(--primary-light);
      margin-top: 14px;
      margin-bottom: 6px;
    }

    p {
      margin-bottom: 10px;
      color: #334155;
    }

    /* Table of contents */
    .toc-container {
      background: var(--bg-light);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 28px;
      margin-top: 12px;
    }

    .toc-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px dashed var(--border);
    }

    .toc-item-title {
      font-weight: 600;
      color: var(--primary);
    }

    .toc-item-desc {
      font-size: 11.5px;
      color: var(--text-muted);
    }

    /* Callout Boxes */
    .callout {
      border-radius: 8px;
      padding: 14px 18px;
      margin: 14px 0;
      border-left: 4px solid;
    }

    .callout-viva {
      background: var(--accent-light);
      border-left-color: var(--accent);
      color: #78350f;
    }
    .callout-viva strong {
      color: #92400e;
    }

    .callout-tech {
      background: var(--blue-light);
      border-left-color: var(--blue);
      color: #1e3a8a;
    }
    .callout-tech strong {
      color: #1d4ed8;
    }

    .callout-security {
      background: var(--rose-light);
      border-left-color: var(--rose);
      color: #881337;
    }
    .callout-security strong {
      color: #be123c;
    }

    .callout-success {
      background: var(--emerald-light);
      border-left-color: var(--emerald);
      color: #064e3b;
    }

    /* Diagrams & Flowcharts */
    .flow-diagram {
      background: #0f172a;
      color: #f8fafc;
      padding: 20px;
      border-radius: 12px;
      margin: 16px 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      overflow-x: auto;
      border: 1px solid #334155;
    }

    .flow-steps {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 12px 0;
    }

    .flow-node {
      background: #1e293b;
      border: 1px solid #475569;
      padding: 8px 14px;
      border-radius: 8px;
      text-align: center;
      min-width: 110px;
    }

    .flow-node.active {
      border-color: #f5a524;
      background: rgba(245, 165, 36, 0.15);
      color: #fbbf24;
      font-weight: 600;
    }

    .flow-node.success {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      font-weight: 600;
    }

    .flow-node.danger {
      border-color: #f43f5e;
      background: rgba(244, 63, 94, 0.15);
      color: #fb7185;
      font-weight: 600;
    }

    .flow-arrow {
      color: #94a3b8;
      font-weight: bold;
      font-size: 14px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 12.5px;
    }

    th {
      background: #1e293b;
      color: #ffffff;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.3px;
    }

    td {
      padding: 9px 12px;
      border-bottom: 1px solid var(--border);
      color: #334155;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge-amber { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-blue { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-emerald { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .badge-rose { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
    .badge-purple { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }

    /* Code blocks */
    pre, code {
      font-family: 'JetBrains Mono', monospace;
    }
    code {
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11.5px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background: #0f172a;
      color: #e2e8f0;
      padding: 14px;
      border-radius: 8px;
      font-size: 11.5px;
      line-height: 1.5;
      overflow-x: auto;
      margin: 12px 0;
      border: 1px solid #1e293b;
    }

    /* Q&A Cards for Viva */
    .viva-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border-left: 4px solid var(--accent);
      page-break-inside: avoid;
    }

    .viva-question {
      font-size: 14.5px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .viva-question span.q-num {
      background: var(--accent);
      color: #ffffff;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 800;
    }

    .viva-answer {
      font-size: 12.5px;
      color: #334155;
      line-height: 1.55;
    }

    .viva-keywords {
      margin-top: 10px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }

    .viva-keywords span.label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .viva-keyword-tag {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      font-size: 10.5px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    /* Workflow Cards */
    .workflow-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px 8px 0 0;
      padding: 12px 16px;
      border-bottom: 2px solid var(--accent);
    }
    .workflow-header h3 {
      margin: 0;
      font-size: 15px;
      color: var(--primary);
    }
    .workflow-body {
      background: #ffffff;
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .step-list {
      list-style: none;
      counter-reset: step-counter;
      margin: 12px 0;
    }

    .step-list li {
      counter-increment: step-counter;
      position: relative;
      padding-left: 34px;
      margin-bottom: 12px;
      font-size: 12.5px;
      color: #334155;
    }

    .step-list li::before {
      content: counter(step-counter);
      position: absolute;
      left: 0;
      top: 0;
      width: 22px;
      height: 22px;
      background: #1e293b;
      color: #ffffff;
      border-radius: 50%;
      text-align: center;
      line-height: 22px;
      font-size: 11px;
      font-weight: 700;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 14px 0;
    }

    .metric-box {
      background: var(--bg-light);
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }

    .metric-val {
      font-size: 20px;
      font-weight: 800;
      color: var(--primary);
    }

    .metric-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE ==================== -->
  <div class="cover-container">
    <div>
      <div class="cover-badge">Hostel Complaint Management System • "आवाज़"</div>
      <h1 class="cover-title">HCMS System Architecture, Workflow Engine & Viva Master Guide</h1>
      <p class="cover-subtitle">
        An exhaustive, production-grade guide explaining every end-to-end workflow, architectural choice, distributed lock mechanism, security layer, and answers to high-stakes viva examination questions.
      </p>

      <div class="cover-pills">
        <span class="cover-pill">Node.js 24 + Express + TS</span>
        <span class="cover-pill">React 18 + Vite + Three.js</span>
        <span class="cover-pill">Prisma ORM + PostgreSQL</span>
        <span class="cover-pill">Postgres Advisory Locks</span>
        <span class="cover-pill">Zod Shared Validation</span>
        <span class="cover-pill">Sharp EXIF Stripper</span>
        <span class="cover-pill">SSE Realtime Notifications</span>
      </div>

      <div class="cover-highlights-grid">
        <div class="cover-highlight-card">
          <h4>SLA Deadline Engine</h4>
          <p>Distributed cron with PostgreSQL advisory locks calculating real-time penalties (-1) and performance scores.</p>
        </div>
        <div class="cover-highlight-card">
          <h4>Democratic Escalation</h4>
          <p>Community upvote engine promoting normal complaints to 24h emergencies upon reaching 10 verified hostel votes.</p>
        </div>
        <div class="cover-highlight-card">
          <h4>Peer Confirmation</h4>
          <p>24-hour verification window where 3 student votes confirm true resolution before closing a ticket.</p>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div class="cover-footer-meta">
        <div>Project: <strong>HCMS ("आवाज़") Monorepo</strong></div>
        <div>Scope: <strong>End-to-End Workflows, Database Integrity & Defense Guide</strong></div>
        <div>Repository: <strong>https://github.com/aarush-2002/HCMS</strong></div>
      </div>
      <div class="cover-footer-meta" style="text-align: right;">
        <div>Document Version: <strong>2.0.0 (Production)</strong></div>
        <div>Date: <strong>November 2026</strong></div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== TABLE OF CONTENTS ==================== -->
  <h1>1. Executive Summary & Table of Contents</h1>

  <div class="callout callout-tech">
    <strong>What is HCMS?</strong> The Hostel Complaint Management System ("आवाज़") is an enterprise-grade, student-centered complaint remediation platform built to replace slow, opaque, manual hostel paper registers. It enforces legally binding Service Level Agreements (SLAs), automated deadline penalties for wardens, democratic community escalation via upvotes, and peer-reviewed resolution confirmation.
  </div>

  <div class="toc-container">
    <h3 style="margin-top:0;">Document Structure</h3>
    <div class="toc-grid">
      <div class="toc-item">
        <span class="toc-item-title">1. Executive Summary & Table of Contents</span>
        <span class="toc-item-desc">Project motivation & goals</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">2. High-Level System Architecture</span>
        <span class="toc-item-desc">Monorepo layout, tech stack</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">3. Workflow 1: Authentication & RBAC</span>
        <span class="toc-item-desc">Argon2, rotating JWT, CSRF, lockout</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">4. Workflow 2: Submission & Quotas</span>
        <span class="toc-item-desc">Row locks, timezone quotas, Sharp EXIF</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">5. Workflow 3: Feed & 10-Upvote Escalation</span>
        <span class="toc-item-desc">Anonymity, atomic promotion, SLA reset</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">6. Workflow 4: Warden Queue & State Machine</span>
        <span class="toc-item-desc">Strict status transitions, notes</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">7. Workflow 5: Deadline Engine & Penalties</span>
        <span class="toc-item-desc">Advisory locks, cron, scoring formula</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">8. Workflow 6: 24h Confirmation Window</span>
        <span class="toc-item-desc">3-vote consensus, reopening mechanism</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">9. Workflow 7: Ratings & Admin Audit</span>
        <span class="toc-item-desc">1-3 stars, moderation, immutable logs</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">10. Workflow 8: Real-Time SSE Pipeline</span>
        <span class="toc-item-desc">Server-Sent Events vs WebSockets</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">11. 3D Visual Innovation (Three.js)</span>
        <span class="toc-item-desc">Night hostel windows tied to live DB stats</span>
      </div>
      <div class="toc-item">
        <span class="toc-item-title">12. Master Viva & Oral Exam Defense</span>
        <span class="toc-item-desc">15+ tough questions & winning answers</span>
      </div>
    </div>
  </div>

  <h2>System Value Metrics</h2>
  <div class="metric-grid">
    <div class="metric-box">
      <div class="metric-val">72h / 24h</div>
      <div class="metric-label">Strict SLA Deadlines</div>
    </div>
    <div class="metric-box">
      <div class="metric-val">10 Votes</div>
      <div class="metric-label">Emergency Escalation</div>
    </div>
    <div class="metric-box">
      <div class="metric-val">3 Votes</div>
      <div class="metric-label">Peer Confirmation</div>
    </div>
    <div class="metric-box">
      <div class="metric-val">100%</div>
      <div class="metric-label">Immutable Audit Trail</div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== ARCHITECTURE ==================== -->
  <h1>2. High-Level System Architecture</h1>

  <p>
    HCMS is engineered as a clean <strong>npm workspaces monorepo</strong> divided into three decoupled packages: <code>/shared</code>, <code>/api</code>, and <code>/web</code>. This ensures zero code duplication for validation schemas and data contracts.
  </p>

  <div class="flow-diagram">
+---------------------------------------------------------------------------------------------------+
|                                        HCMS MONOREPO ARCHITECTURE                                 |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ /web: CLIENT TIER ]                                                                            |
|  * React 18 + Vite (SPA)                                                                          |
|  * Three.js Interactive 3D Night Sky (Parallax + Lit Windows driven by live resolved stats)       |
|  * Tailwind CSS Design System (#05070a Night Aesthetic) + Lucide Icons                            |
|  * EventSource Client for Server-Sent Events (SSE) Real-Time Alerts                               |
|                                     |                                                             |
|                                     | HTTP Requests (Cookies + Double-Submit CSRF)                |
|                                     | SSE Stream: /api/notifications/stream                       |
|                                     v                                                             |
|  [ /api: APPLICATION TIER ]                                                                       |
|  * Node.js + Express + TypeScript                                                                 |
|  * Security Pipeline: Helmet, CORS, Argon2, JWT (15m Access + 7d Rotating Refresh in Cookies)     |
|  * Sharp Image Processing (EXIF Stripping, Magic Bytes Verification, 2MB Cap)                     |
|  * Deadline Engine Service (node-cron + Postgres Advisory Locking)                                |
|  * Status & Quota State Machines (date-fns-tz Timezone Evaluation)                                |
|                                     ^                                                             |
|                                     | Prisma ORM (Type-Safe Client)                               |
|                                     v                                                             |
|  [ PERSISTENCE TIER ]                                                                             |
|  * PostgreSQL 16/18 Database (Neon Serverless / Cloud / Local)                                    |
|  * Strict Constraints: Unique composite keys, Check constraints, Foreign key cascades             |
|  * Immutable Append-Only Ledger: StatusHistory, PriorityHistory, PenaltyEvent, AuditEvent         |
|                                                                                                   |
|  [ /shared: CONTRACT TIER ]                                                                       |
|  * Zod Validation Schemas, TypeScript Interfaces, Error Codes shared between Web & API           |
+---------------------------------------------------------------------------------------------------+
  </div>

  <h2>Monorepo Package Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Directory</th>
        <th>Primary Tech</th>
        <th>Core Responsibilities</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>/shared</code></td>
        <td>TypeScript, Zod</td>
        <td>Shared domain types, DTO schemas (complaint creation, auth, policy, pagination), and status enum mappings. Single source of truth.</td>
      </tr>
      <tr>
        <td><code>/api</code></td>
        <td>Express, TypeScript, Prisma, Argon2, Sharp, node-cron</td>
        <td>REST API, transactional business logic, distributed deadline cron, SSE stream, photo security pipeline, and database migrations.</td>
      </tr>
      <tr>
        <td><code>/web</code></td>
        <td>React 18, Vite, Three.js, Tailwind CSS</td>
        <td>Client dashboards for Student, Warden, and Admin. Three.js canvas, optimistic UI upvotes, real-time countdown clocks.</td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <!-- ==================== WORKFLOW 1: AUTH ==================== -->
  <h1>3. Workflow 1: Authentication, Scoping & RBAC</h1>

  <div class="workflow-header">
    <h3>Enterprise Security, Cookie Tokens & Hostel Isolation</h3>
    <span class="badge badge-purple">SECURITY LAYER</span>
  </div>
  <div class="workflow-body">
    <p>
      HCMS enforces strict <strong>Role-Based Access Control (RBAC)</strong> across three distinct personas: <code>STUDENT</code>, <code>WARDEN</code>, and <code>ADMIN</code>. Crucially, access is not just role-checked; it is strictly <strong>hostel-scoped</strong> at the database query level.
    </p>

    <div class="flow-diagram">
[User Request] 
      │
      ├──> [Helmet & CORS Filters] 
      │
      ├──> [Express Rate Limiter] ──> (Block if > 10 failed login attempts per IP)
      │
      ├──> [Double-Submit CSRF Verification] ──> (Verify X-CSRF-Token matches Cookie)
      │
      ├──> [Auth Middleware] ──> (Extract & Verify 15-min JWT from HTTP-Only Cookie)
      │         │
      │         └──> If Expired: [Rotating Refresh Token Flow] (Issue new Access + Refresh)
      │
      └──> [Role & Hostel Scoping Guard]
                │
                ├── Student: Locked to student's own hostelId
                ├── Warden: Checked against WardenAssignment table
                └── Admin: Global administrative privileges
    </div>

    <h3>Step-by-Step Security Execution:</h3>
    <ol class="step-list">
      <li><strong>Password Hashing:</strong> Passwords are hashed using <code>Argon2id</code> (winner of the Password Hashing Competition), offering superior protection against GPU-based brute force attacks compared to legacy bcrypt.</li>
      <li><strong>Token Strategy:</strong> Uses short-lived (15 minutes) JWT Access Tokens and long-lived (7 days) rotating Refresh Tokens stored in <code>httpOnly</code>, <code>sameSite: 'lax'</code> cookies. Tokens cannot be read by client-side JavaScript, preventing XSS token theft.</li>
      <li><strong>Double-Submit CSRF:</strong> State-changing mutations (POST, PUT, DELETE) require a cryptographically random token passed both in a cookie and in the <code>X-CSRF-Token</code> request header.</li>
      <li><strong>Account Lockout:</strong> 5 consecutive failed login attempts trigger an automated account lockout for 15 minutes, neutralizing credential-stuffing attacks.</li>
      <li><strong>Hostel Scoping:</strong> A student of "Cauvery Hostel" can never fetch complaints, submit votes, or view photos belonging to "Ganga Hostel". The server enforces <code>where: { hostelId: user.hostelId }</code> in every database query.</li>
    </ol>

    <div class="callout callout-viva">
      <strong>Viva Answer Key:</strong> "Why did you use HTTP-Only Cookies instead of localStorage for JWTs?"<br>
      <em>Answer:</em> <code>localStorage</code> is vulnerable to Cross-Site Scripting (XSS). Any third-party script or injected dependency can steal tokens from <code>localStorage</code>. <code>httpOnly</code> cookies cannot be accessed via JavaScript, mitigating token exfiltration.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== WORKFLOW 2: SUBMISSION ==================== -->
  <h1>4. Workflow 2: Complaint Submission & Quota Engine</h1>

  <div class="workflow-header">
    <h3>Atomic Quota Verification, Dynamic Deadlines & Sharp Pipeline</h3>
    <span class="badge badge-amber">CORE ENGINE</span>
  </div>
  <div class="workflow-body">
    <p>
      Complaint creation is defended against spam, abuse, and concurrency race conditions through atomic transactional quotas and rigorous image sanitization.
    </p>

    <div class="flow-diagram">
[POST /api/complaints] (Multipart Form: title, desc, category, priority, photos)
         │
         ├──> 1. Magic-Byte File Sniffing (Validate JPEG/PNG/WEBP by header bytes, NOT extension)
         │    └── Sharp Pipeline: Strip all EXIF / GPS metadata, enforce 2MB limit, hash filename
         │
         ├──> 2. Open PostgreSQL Transaction ($transaction with Serializable isolation)
         │    │
         │    ├──> Compute Hostel Local Timezone (e.g., 'Asia/Kolkata' via date-fns-tz)
         │    │
         │    ├──> Count student's submissions today (Normal limit: 1/day)
         │    │    Count student's submissions this week (Emergency limit: 1/week, Mon 00:00)
         │    │    └── If Exceeded: ABORT & ROLLBACK (QuotaExceededError)
         │    │
         │    ├──> Calculate SLA Deadline:
         │    │    * Normal Priority:    now + 72 Hours
         │    │    * Emergency Priority: now + 24 Hours
         │    │
         │    ├──> Generate Sequence ID: e.g., "HM-0042" (Unique sequence)
         │    │
         │    ├──> INSERT Complaint (Status: SUBMITTED)
         │    ├──> INSERT StatusHistory ("System created complaint")
         │    ├──> INSERT AuditEvent (actorId, action: 'COMPLAINT_CREATED')
         │    └──> COMMIT Transaction
         │
         └──> 3. Emit SSE Event to Assigned Hostel Wardens
    </div>

    <h3>Detailed Implementation Highlights:</h3>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Design Decision</th>
          <th>Technical Reason</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Timezone Awareness</strong></td>
          <td>Evaluated using <code>date-fns-tz</code> with hostel policy (e.g., <code>Asia/Kolkata</code>)</td>
          <td>Prevents server UTC clock drift from resetting quotas at 5:30 AM local time instead of midnight.</td>
        </tr>
        <tr>
          <td><strong>Concurrency Guard</strong></td>
          <td>Atomic database transaction with row locks</td>
          <td>Prevents a student from firing two rapid simultaneous requests to bypass the daily limit.</td>
        </tr>
        <tr>
          <td><strong>Photo Sanitization</strong></td>
          <td><code>sharp(buffer).rotate().toBuffer()</code></td>
          <td>Strips sensitive geolocation (EXIF GPS) and device metadata while auto-orienting uploaded photos.</td>
        </tr>
        <tr>
          <td><strong>File Storage</strong></td>
          <td>Pluggable Storage Interface (<code>IStorageService</code>)</td>
          <td>Stored outside public web root with UUID names; served via scoped endpoint <code>GET /api/photos/:id</code>.</td>
        </tr>
      </tbody>
    </table>

    <div class="callout callout-viva">
      <strong>Viva Answer Key:</strong> "What happens if photo upload fails halfway through?"<br>
      <em>Answer:</em> The entire submission is wrapped in a single database transaction. If photo processing or disk storage fails, the transaction is rolled back, no complaint record is created, and no student quota is consumed.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== WORKFLOW 3: COMMUNITY FEED ==================== -->
  <h1>5. Workflow 3: Community Feed & 10-Upvote Escalation</h1>

  <div class="workflow-header">
    <h3>Democratic Prioritization, Anonymity & Atomic Escalation</h3>
    <span class="badge badge-emerald">COMMUNITY IMPACT</span>
  </div>
  <div class="workflow-body">
    <p>
      The community feed enables hostel residents to view active issues and vote for complaints that affect multiple residents (e.g., a broken water cooler or Wi-Fi router).
    </p>

    <div class="flow-diagram">
[Student Clicks Upvote on Complaint HM-0021]
                 │
                 ├──> Check 1: Is user in same hostel? (Reject if cross-hostel)
                 ├──> Check 2: Is user the complainant? (Reject! Cannot upvote own issue)
                 ├──> Check 3: Is complaint active? (Reject if Resolved/Closed/Rejected)
                 │
                 ├──> Open Database Transaction ($transaction):
                 │    │
                 │    ├──> INSERT INTO Upvote (complaintId, studentId)
                 │    │    └── Enforced by Unique Constraint @@unique([complaintId, studentId])
                 │    │
                 │    ├──> Count Total Active Upvotes for Complaint
                 │    │
                 │    ├──> Threshold Check: Did upvotes reach 10 on a NORMAL complaint?
                 │    │    │
                 │    │    ├── YES (Escalation Trigger):
                 │    │    │   * UPDATE Complaint: priority = 'EMERGENCY'
                 │    │    │   * RESTART Deadline: deadline = now() + 24 Hours
                 │    │    │   * INSERT PriorityHistory: 'NORMAL -> EMERGENCY (Promoted by 10 upvotes)'
                 │    │    │   * INSERT AuditEvent
                 │    │    │   * Emit SSE Notification to Complainant & Wardens
                 │    │    │
                 │    │    └── NO: Return updated upvoteCount
                 │    │
                 │    └──> COMMIT Transaction
                 │
                 └──> Client UI: Optimistic Upvote Counter Update with Rollback on error
    </div>

    <h3>Key Business Rules & Edge Cases:</h3>
    <ul>
      <li><strong>Total Submitter Anonymity:</strong> In the student feed (<code>GET /api/feed</code>), submitter identity is stripped by the serializer. Students never see who submitted a complaint, eliminating fear of retaliation or peer pressure.</li>
      <li><strong>One-Way Escalation:</strong> If a complaint is promoted to Emergency at 10 upvotes and a student later removes their upvote (dropping the count to 9), the complaint <strong>remains Emergency</strong>. It is never demoted.</li>
      <li><strong>Quota Immunity:</strong> Community promotion to Emergency does <strong>not</strong> consume the original complainant's personal weekly emergency allowance.</li>
      <li><strong>Idempotent Promotion:</strong> Handled in a serializable transaction so concurrent 10th and 11th votes cannot double-escalate or restart deadlines twice.</li>
    </ul>

    <div class="callout callout-viva">
      <strong>Viva Answer Key:</strong> "Why restart the deadline to 24h from promotion rather than keeping the original deadline?"<br>
      <em>Answer:</em> A normal complaint has a 72-hour SLA. If it gains 10 upvotes on hour 70, expecting the warden to fix an emergency in 2 hours is unreasonable. Resetting to <code>now() + 24h</code> establishes a fair, urgent emergency SLA while holding the warden strictly accountable.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== WORKFLOW 4: WARDEN QUEUE ==================== -->
  <h1>6. Workflow 4: Warden Queue & Status State Machine</h1>

  <div class="workflow-header">
    <h3>Prioritized SLA Queue & Deterministic State Transitions</h3>
    <span class="badge badge-blue">OPERATIONAL WORKFLOW</span>
  </div>
  <div class="workflow-body">
    <p>
      Wardens do not see a random list of complaints; they manage a strictly prioritized queue sorted to prevent SLA breaches.
    </p>

    <h2>Warden Queue Sorting Algorithm</h2>
    <div class="callout callout-tech">
      <code>Default Sorting Order:</code><br>
      <strong>1. Overdue Complaints First</strong> (deadline has passed, immediate remediation needed)<br>
      <strong>2. Emergency Priority Complaints</strong> (sorted by nearest remaining deadline)<br>
      <strong>3. Normal Priority Complaints</strong> (sorted by nearest remaining deadline)
    </div>

    <h2>Strict Finite State Machine (FSM)</h2>
    <p>
      To prevent arbitrary or fraudulent state tampering, the API enforces a deterministic transition matrix. Wardens can only move complaints through valid forward transitions:
    </p>

    <div class="flow-diagram">
             +-------------------------------------------------------+
             |                                                       |
             v                                                       |
       [ SUBMITTED ] ───────────> [ ACKNOWLEDGED ]                   |
                                        │                            |
                                        v                            |
                                 [ IN_PROGRESS ] <───────────────────+
                                        │             (Window expired /
                                        v              Reopened by 3 votes)
                              [ MARKED_RESOLVED ]
                                (Stops SLA clock!
                               Opens 24h Window)
                                        │
                         +--------------+--------------+
                         |                             |
               (3 "Solved" Votes)             (3 "Not Solved" Votes)
                         v                             v
                   [ RESOLVED ]                   [ REOPENED ]
                         │                             │
                   (Rating Form                        └──> (Returns to
                    unlocked for                             IN_PROGRESS)
                    complainant)
    </div>

    <h3>Allowed Transition Matrix:</h3>
    <table>
      <thead>
        <tr>
          <th>From Status</th>
          <th>Allowed Target Status</th>
          <th>Mandatory Requirements</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>SUBMITTED</code></td>
          <td><code>ACKNOWLEDGED</code></td>
          <td>Warden acknowledges review of ticket.</td>
        </tr>
        <tr>
          <td><code>ACKNOWLEDGED</code></td>
          <td><code>IN_PROGRESS</code></td>
          <td>Maintenance staff dispatched.</td>
        </tr>
        <tr>
          <td><code>IN_PROGRESS</code></td>
          <td><code>MARKED_RESOLVED</code></td>
          <td><strong>Resolution Note REQUIRED.</strong> Service deadline clock stops.</td>
        </tr>
        <tr>
          <td><code>MARKED_RESOLVED</code></td>
          <td><code>IN_PROGRESS</code></td>
          <td>Warden discovers additional work is required before window finishes.</td>
        </tr>
        <tr>
          <td><code>REOPENED</code></td>
          <td><code>IN_PROGRESS</code></td>
          <td>Warden resumes work after students rejected resolution.</td>
        </tr>
        <tr>
          <td><em>Any Status</em></td>
          <td><code>REJECTED / INVALID</code></td>
          <td><strong>Admin Only!</strong> Requires documented formal justification.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- ==================== WORKFLOW 5: DEADLINE ENGINE ==================== -->
  <h1>7. Workflow 5: Deadline Engine & Distributed Penalties</h1>

  <div class="workflow-header">
    <h3>Distributed Concurrency with PostgreSQL Advisory Locks</h3>
    <span class="badge badge-rose">HIGH-STAKES RELIABILITY</span>
  </div>
  <div class="workflow-body">
    <p>
      The Deadline Engine runs as a background cron job every minute (<code>* * * * *</code>) to detect SLA breaches and award penalties to responsible wardens.
    </p>

    <div class="flow-diagram">
[node-cron triggers every 60 seconds]
                 │
                 ├──> 1. Acquire Distributed Advisory Lock:
                 │       SELECT pg_try_advisory_lock(987654321);
                 │       └── If FALSE (another server instance is already running): EXIT SAFELY
                 │
                 ├──> 2. Query Overdue Breaches:
                 │       Find complaints WHERE status NOT IN ('MARKED_RESOLVED', 'RESOLVED', 'CLOSED', 'REJECTED')
                 │       AND deadline &lt; NOW()
                 │
                 ├──> 3. For each overdue complaint:
                 │       Check if PenaltyEvent already exists for (complaintId, deadlineAt)
                 │       │
                 │       ├── If Not Found (First Breach Detection):
                 │       │   * INSERT INTO PenaltyEvent (wardenId, complaintId, penalty: -1, deadlineAt, eventAt)
                 │       │   * INSERT INTO AuditEvent (action: 'PENALTY_AWARDED')
                 │       │   * Emit SSE Alert to Warden ("SLA breached! -1 penalty incurred")
                 │       │
                 │       └── If Already Exists: SKIP (Idempotency guarantee!)
                 │
                 ├──> 4. Check Lapsed Confirmation Windows:
                 │       Find MARKED_RESOLVED complaints past 24h window with &lt; 3 votes
                 │       └── Automatically revert status to IN_PROGRESS
                 │
                 └──> 5. Release Advisory Lock:
                         SELECT pg_advisory_unlock(987654321);
    </div>

    <h2>Warden Performance Scoring Algorithm</h2>
    <p>
      Unlike traditional systems where ratings hide operational failures, HCMS computes a composite score separating subjective student satisfaction from objective SLA compliance:
    </p>

    <div class="callout callout-viva">
      <strong>The Canonical HCMS Scoring Formula:</strong><br>
      <div style="font-size: 16px; font-weight: 800; margin: 8px 0; color: #1e293b;">
        Composite Score = (Average Star Rating [1 to 3]) − (0.5 × Total Penalties Incurred)
      </div>
      <em>Example:</em> A warden with an average student rating of <strong>2.8 stars</strong> who missed <strong>2 deadlines</strong> receives: <code>2.8 − (0.5 × 2) = 1.8 Net Score</code>.
    </div>

    <div class="callout callout-tech">
      <strong>Viva Answer Key:</strong> "Why did you use PostgreSQL advisory locks instead of Redis for the cron lock?"<br>
      <em>Answer:</em> PostgreSQL advisory locks (<code>pg_try_advisory_lock</code>) use the existing database connection pool and require zero additional infrastructure like Redis. They are session-bound, meaning if a server node crashes unexpectedly, PostgreSQL automatically releases the advisory lock immediately, eliminating stale deadlocks.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== WORKFLOW 6 & 7: CONFIRMATION & RATINGS ==================== -->
  <h1>8. Workflows 6 & 7: 24h Confirmation Window & Ratings</h1>

  <div class="workflow-header">
    <h3>Democratic Verification & Complainant Feedback</h3>
    <span class="badge badge-emerald">ACCOUNTABILITY</span>
  </div>
  <div class="workflow-body">
    <h2>Workflow 6: 24-Hour Peer Confirmation Window</h2>
    <p>
      In typical software, a ticket is closed when the administrator says it is. In HCMS, <strong>the students decide if the work was actually done</strong>.
    </p>

    <div class="flow-diagram">
[Warden marks issue "MARKED_RESOLVED" with required note]
                       │
                       ├──> Service Deadline Stops (Freezes SLA timer)
                       ├──> 24-Hour Confirmation Window Opens
                       └──> All students of that hostel can vote: "SOLVED" or "NOT_SOLVED"
                                       │
                +----------------------+----------------------+
                |                                             |
     [ 3 "SOLVED" Votes Reached ]                 [ 3 "NOT SOLVED" Votes Reached ]
                │                                             │
                v                                             v
        Status -> RESOLVED                            Status -> REOPENED
    * Ticket leaves active feed.                * Ticket moves back to active queue.
    * Recorded in StatusHistory.                * Reopen round counter increments (+1).
    * Complainant receives SSE:                 * Warden notified immediately:
      "Please rate your warden!"                  "Resolution rejected by student body!"
    </div>

    <h2>Workflow 7: Student Rating & Abuse Moderation</h2>
    <ul>
      <li><strong>Complainant Exclusive:</strong> Only the original student who submitted the ticket can rate the warden. Other students who upvoted or confirmed cannot rate, preventing review brigading.</li>
      <li><strong>Discrete 1-3 Star Scale:</strong> Simple, meaningful scale: 1 (Poor), 2 (Satisfactory), 3 (Excellent).</li>
      <li><strong>Admin Moderation & Flagging:</strong> If a student uses profanity or abusive language in the optional comment, admins can flag and hide the rating with a recorded reason. <em>Crucially, hidden ratings are excluded from the warden's average rating calculation, but retained permanently in the audit trail.</em></li>
    </ul>

    <h2>Workflow 8: Real-Time SSE Notification Pipeline</h2>
    <table>
      <thead>
        <tr>
          <th>Event Type</th>
          <th>Target Recipient</th>
          <th>Notification Channel</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>COMPLAINT_SUBMITTED</code></td>
          <td>Assigned Hostel Wardens</td>
          <td>SSE In-App Stream + Toast</td>
        </tr>
        <tr>
          <td><code>COMPLAINT_PROMOTED</code></td>
          <td>Complainant & Wardens</td>
          <td>SSE In-App Stream + Toast</td>
        </tr>
        <tr>
          <td><code>MARKED_RESOLVED</code></td>
          <td>Hostel Student Body</td>
          <td>SSE In-App Stream (Voting window active)</td>
        </tr>
        <tr>
          <td><code>TICKET_RESOLVED</code></td>
          <td>Complainant</td>
          <td>SSE In-App Stream (Rating form unlocked)</td>
        </tr>
        <tr>
          <td><code>DEADLINE_PENALTY</code></td>
          <td>Responsible Warden</td>
          <td>SSE In-App Stream (SLA warning alert)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- ==================== WORKFLOW 9 & THREE.JS ==================== -->
  <h1>9. Admin Back Office & 3D Three.js Innovation</h1>

  <div class="workflow-header">
    <h3>Governance, Audit Trails & The "Night Hostel" World</h3>
    <span class="badge badge-purple">SYSTEM INNOVATION</span>
  </div>
  <div class="workflow-body">
    <h2>Immutable Audit Ledger</h2>
    <p>
      In accordance with system policy, <strong>HCMS has no hard deletions</strong>. Every mutation creates an immutable audit row:
    </p>
    <div class="callout callout-tech">
      <code>AuditEvent Record:</code><br>
      <code>{ id, actorId, action, entityType, entityId, beforeJson, afterJson, ipAddress, timestamp }</code>
    </div>
    <p>
      Admins can reassign complaints, reclassify categories, or review penalty disputes, but every action is permanently stamped in the ledger for full institutional transparency.
    </p>

    <h2>The Three.js 3D "Night Hostel" Visual Innovation</h2>
    <p>
      Instead of a generic, boring dashboard, HCMS features a custom-built 3D Canvas in React using <strong>Three.js</strong> that sits behind all HTML content:
    </p>

    <div class="flow-diagram">
+---------------------------------------------------------------------------------------------------+
|                            THREE.JS REAL-TIME DATA VISUALIZATION                                  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|   GET /api/public/stats  ──>  Returns: { resolvedCount: 84, totalCount: 120 }                     |
|                                                                                                   |
|   1. Calculation: Resolved Ratio = 84 / 120 = 70.0%                                               |
|                                                                                                   |
|   2. 3D Procedural Hostel Facade:                                                                 |
|      * Grid of 120 building windows rendered in Three.js InstancedMesh                            |
|      * 70% of the windows are illuminated in warm amber (#f5a524)                                 |
|      * Unresolved complaints remain dark/unlit                                                    |
|                                                                                                   |
|   3. Sky Shader Atmosphere ("Daybreak" Effect):                                                   |
|      * As the resolved percentage increases, the sky shifts from midnight black (#05070a)        |
|        to a subtle dawn amber glow, visually depicting hostel remediation!                        |
|                                                                                                   |
|   4. Interactive Parallax & Performance:                                                          |
|      * Smooth mouse pointer & scroll parallax                                                     |
|      * Automatically pauses render loop when browser tab is inactive (Battery efficient)          |
|      * Respects 'prefers-reduced-motion' accessibility settings                                    |
+---------------------------------------------------------------------------------------------------+
    </div>

    <div class="callout callout-viva">
      <strong>Viva Answer Key:</strong> "Is the Three.js background just a visual gimmick?"<br>
      <em>Answer:</em> No! It is an innovative, accessible <strong>ambient data visualization</strong>. Every illuminated window corresponds to a real resolved issue from our database. Visitors and students immediately sense the operational health of their hostel without reading raw statistical tables.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== VIVA DEFENSE MASTER GUIDE ==================== -->
  <h1>10. Master Viva & Oral Exam Defense Guide</h1>
  <p>
    Below are the <strong>15 most critical technical questions</strong> examiners and professors ask, along with comprehensive, structured answers designed to demonstrate deep engineering competence.
  </p>

  <!-- Q1 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q1</span> How did you handle concurrency when enforcing daily and weekly quotas?
    </div>
    <div class="viva-answer">
      We wrapped quota validation and complaint insertion inside a single PostgreSQL database transaction using Prisma's <code>$transaction</code>. Before inserting, the engine queries submission counts within the calculated timezone bounds using row-level locking. If two submissions arrive at the exact same millisecond, one transaction commits first while the second fails the quota count check and rolls back completely.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">ACID Transactions</span>
      <span class="viva-keyword-tag">Row-Level Locks</span>
      <span class="viva-keyword-tag">Race Conditions</span>
      <span class="viva-keyword-tag">Timezone Normalization</span>
    </div>
  </div>

  <!-- Q2 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q2</span> How does the Deadline Engine prevent duplicate penalties on multi-server clusters?
    </div>
    <div class="viva-answer">
      Two techniques are used: First, distributed synchronization via <strong>PostgreSQL Advisory Locks</strong> (<code>SELECT pg_try_advisory_lock(987654321)</code>). If multiple backend containers run the 1-minute cron, only the single instance acquiring the lock executes. Second, <strong>idempotent penalty records</strong>: <code>PenaltyEvent</code> stores <code>(complaintId, deadlineAt)</code>. Even if checked twice, a database constraint ensures only one penalty is ever recorded per missed deadline.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Postgres Advisory Lock</span>
      <span class="viva-keyword-tag">Distributed Mutex</span>
      <span class="viva-keyword-tag">Idempotency</span>
      <span class="viva-keyword-tag">Composite Unique Key</span>
    </div>
  </div>

  <!-- Q3 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q3</span> What security measures prevent malicious file uploads disguised as complaint photos?
    </div>
    <div class="viva-answer">
      We implement defense-in-depth:
      <ol style="margin-left: 20px; margin-top: 4px;">
        <li><strong>Magic-Byte Validation:</strong> We do not trust file extensions (e.g. <code>.jpg</code>). We inspect the binary header bytes to verify legitimate JPEG, PNG, or WEBP mime types.</li>
        <li><strong>Sharp Image Reprocessing:</strong> Uploaded files are piped through <code>Sharp</code>, re-encoding the pixel buffer and stripping all dangerous EXIF metadata (including GPS coordinates).</li>
        <li><strong>Isolated Storage:</strong> Files are renamed to random UUID hashes and saved outside the web root, served only through an authenticated, hostel-scoped endpoint.</li>
      </ol>
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Magic Bytes</span>
      <span class="viva-keyword-tag">EXIF Stripping</span>
      <span class="viva-keyword-tag">Sharp</span>
      <span class="viva-keyword-tag">Path Traversal Defense</span>
    </div>
  </div>

  <!-- Q4 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q4</span> Why did you choose Server-Sent Events (SSE) over WebSockets for live notifications?
    </div>
    <div class="viva-answer">
      Notifications in HCMS are unidirectional (server-to-client). SSE runs over standard HTTP, natively supports automatic client reconnection, traverses corporate/hostel firewalls effortlessly, supports HTTP/2 multiplexing, and consumes far less memory than stateful full-duplex WebSockets.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Server-Sent Events</span>
      <span class="viva-keyword-tag">HTTP/2 Multiplexing</span>
      <span class="viva-keyword-tag">Automatic Reconnect</span>
      <span class="viva-keyword-tag">Resource Efficiency</span>
    </div>
  </div>

  <!-- Q5 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q5</span> How does the 10-upvote emergency escalation avoid race conditions?
    </div>
    <div class="viva-answer">
      The upvote insertion and threshold check are executed inside a single database transaction. The upvote table has a unique compound constraint <code>@@unique([complaintId, studentId])</code> preventing double-voting. If two students vote simultaneously for the 10th vote, the transaction checks <code>priority === 'NORMAL'</code> before applying the promotion, guaranteeing that the emergency status and deadline reset happen exactly once.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Compound Unique Key</span>
      <span class="viva-keyword-tag">Atomic Escalation</span>
      <span class="viva-keyword-tag">Single Transaction</span>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- Q6 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q6</span> Why are complainant identities hidden from other students in the feed?
    </div>
    <div class="viva-answer">
      Anonymity eliminates fear of social embarrassment, peer friction, or hostel politics when reporting issues (e.g., hygiene or broken amenities). Wardens and admins can still see the submitter's identity and room number in their private dashboard to conduct physical repairs.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Privacy by Design</span>
      <span class="viva-keyword-tag">Data Sanitization</span>
      <span class="viva-keyword-tag">Role-Based Serialization</span>
    </div>
  </div>

  <!-- Q7 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q7</span> How is the Warden Performance Score calculated, and why are penalties separated from star ratings?
    </div>
    <div class="viva-answer">
      The score formula is: <code>Net Score = Average Rating (1-3) - (0.5 × Total Penalties)</code>.<br>
      Separating them prevents subjective student ratings from masking objective SLA breaches. A warden could be friendly and receive 3 stars, but if they routinely miss resolution deadlines, the mathematical penalty term transparently reflects their operational failure.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Separation of Concerns</span>
      <span class="viva-keyword-tag">Composite Metric</span>
      <span class="viva-keyword-tag">SLA Accountability</span>
    </div>
  </div>

  <!-- Q8 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q8</span> What happens when a warden marks a complaint as "Marked Resolved"?
    </div>
    <div class="viva-answer">
      Two critical events occur simultaneously:
      <ol style="margin-left: 20px; margin-top: 4px;">
        <li>The <strong>Service Deadline clock stops</strong> immediately, protecting the warden from incurring late penalties while students verify the fix.</li>
        <li>A <strong>24-hour Confirmation Window</strong> opens where hostel residents cast <code>SOLVED</code> or <code>NOT_SOLVED</code> votes. 3 "Solved" votes mark it <code>RESOLVED</code>, while 3 "Not Solved" votes reopen it as <code>REOPENED</code>.</li>
      </ol>
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">SLA Clock Pause</span>
      <span class="viva-keyword-tag">Confirmation Window</span>
      <span class="viva-keyword-tag">Consensus Threshold</span>
    </div>
  </div>

  <!-- Q9 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q9</span> Why is there no hard-delete functionality in the database?
    </div>
    <div class="viva-answer">
      HCMS enforces an <strong>Immutable Audit Ledger</strong> standard for institutional compliance. Deleting records destroys the integrity of historical metrics, warden scoring, and dispute evidence. Instead, invalid complaints are marked <code>REJECTED</code> with mandatory admin notes, and users are deactivated via a <code>status: INACTIVE</code> flag.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Append-Only Ledger</span>
      <span class="viva-keyword-tag">Regulatory Compliance</span>
      <span class="viva-keyword-tag">Soft Deletion</span>
      <span class="viva-keyword-tag">Data Lineage</span>
    </div>
  </div>

  <!-- Q10 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q10</span> How does your Double-Submit Cookie CSRF pattern protect users?
    </div>
    <div class="viva-answer">
      The server issues a cryptographically secure random token in a cookie (<code>hmcs_csrf_token</code>). For any mutating request (POST/PATCH/DELETE), the frontend must read this token and attach it in the <code>X-CSRF-Token</code> header. Under the Same-Origin Policy, an external malicious site cannot read the cookie from our domain, making it impossible for them to forge the matching custom header.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Double-Submit Cookie</span>
      <span class="viva-keyword-tag">CSRF Defense</span>
      <span class="viva-keyword-tag">Same-Origin Policy</span>
    </div>
  </div>

  <!-- Q11 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q11</span> How does the monorepo architecture benefit development and maintenance?
    </div>
    <div class="viva-answer">
      By keeping <code>/shared</code>, <code>/api</code>, and <code>/web</code> in a single repository, data transfer objects (DTOs) and Zod validation rules are written once. When an API endpoint's request payload changes, TypeScript compiler errors immediately flag any mismatch in the frontend client, guaranteeing 100% type safety across the entire application stack.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">End-to-End Type Safety</span>
      <span class="viva-keyword-tag">Zod Shared Validation</span>
      <span class="viva-keyword-tag">DRY Principle</span>
    </div>
  </div>

  <!-- Q12 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q12</span> What happens if the 24-hour confirmation window expires without 3 votes in either direction?
    </div>
    <div class="viva-answer">
      The background Deadline Engine detects the lapsed window and automatically reverts the complaint status from <code>MARKED_RESOLVED</code> back to <code>IN_PROGRESS</code>. This ensures no unresolved complaint stays in limbo, prompting the warden to re-inspect the issue and verify completion with the student body.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Fallback Remediation</span>
      <span class="viva-keyword-tag">Lapsed Window Handler</span>
      <span class="viva-keyword-tag">Zero Deadlock</span>
    </div>
  </div>

  <!-- Q13 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q13</span> Why did you choose Argon2 over bcrypt for password hashing?
    </div>
    <div class="viva-answer">
      Argon2 (specifically Argon2id) won the Password Hashing Competition (PHC). It is memory-hard and time-hard, meaning an attacker attempting brute-force cracking with specialized ASICs or GPUs faces extreme memory bandwidth bottlenecks, unlike legacy bcrypt which has low memory requirements.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Argon2id</span>
      <span class="viva-keyword-tag">Memory-Hard Functions</span>
      <span class="viva-keyword-tag">GPU / ASIC Resistance</span>
    </div>
  </div>

  <!-- Q14 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q14</span> How does the client maintain smooth UI during upvoting (Optimistic Updates)?
    </div>
    <div class="viva-answer">
      When a user clicks upvote, the React UI immediately increments the vote count and toggles the button state locally without waiting for the network response. If the backend API responds with an error (e.g. network failure or quota issue), the state automatically rolls back to its previous value and displays an error toast.
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Optimistic UI</span>
      <span class="viva-keyword-tag">Rollback State</span>
      <span class="viva-keyword-tag">User Experience</span>
    </div>
  </div>

  <!-- Q15 -->
  <div class="viva-card">
    <div class="viva-question">
      <span class="q-num">Q15</span> How does the system scale if the university has 20 hostels and 15,000 students?
    </div>
    <div class="viva-answer">
      HCMS scales horizontally:
      <ol style="margin-left: 20px; margin-top: 4px;">
        <li><strong>Stateless API Nodes:</strong> The Express application is completely stateless; JWTs and sessions are verified using the cryptographic secret and database tokens.</li>
        <li><strong>Database Indexing:</strong> Composite indexes on <code>(hostelId, status, priority)</code> and <code>(deadline)</code> ensure rapid filtering across large datasets.</li>
        <li><strong>Distributed Advisory Locking:</strong> As background cron workers scale across multiple cloud instances, PostgreSQL advisory locks ensure the deadline engine runs exactly once per minute without duplicate processing.</li>
      </ol>
    </div>
    <div class="viva-keywords">
      <span class="label">Keywords:</span>
      <span class="viva-keyword-tag">Horizontal Scaling</span>
      <span class="viva-keyword-tag">Composite Indexes</span>
      <span class="viva-keyword-tag">Stateless Services</span>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== CLOSING SUMMARY ==================== -->
  <h1>11. Conclusion & Viva Checklist for Teammates</h1>

  <div class="callout callout-tech">
    <strong>Team Viva Cheat Sheet:</strong> Before entering the exam or project defense, ensure every team member knows these 5 numbers by heart:
    <ul style="margin-top: 8px; margin-left: 18px;">
      <li><strong>72 hours:</strong> Normal complaint resolution deadline (SLA).</li>
      <li><strong>24 hours:</strong> Emergency complaint deadline (and newly promoted emergency deadline).</li>
      <li><strong>10 upvotes:</strong> Community threshold that automatically promotes a normal issue to emergency.</li>
      <li><strong>24-hour window & 3 votes:</strong> Confirmation window length, and the 3 votes required to verify or reject resolution.</li>
      <li><strong>−1 penalty & 0.5 factor:</strong> Each missed deadline incurs −1 penalty, deducting 0.5 from the warden's 1–3 star composite score.</li>
    </ul>
  </div>

  <div style="margin-top: 30px; text-align: center; border-top: 2px solid var(--border); padding-top: 20px; color: var(--text-muted); font-size: 12px;">
    <strong>Hostel Complaint Management System ("आवाज़")</strong><br>
    Built with React, Express, TypeScript, Prisma, and PostgreSQL.<br>
    Repository: <code>https://github.com/aarush-2002/HCMS</code>
  </div>

</body>
</html>`;

async function generatePdf() {
  console.log('[PDF Generator] Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('[PDF Generator] Setting page content...');
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  const outputPath = path.resolve(process.cwd(), 'HCMS_System_Architecture_and_Viva_Guide.pdf');
  console.log(`[PDF Generator] Rendering PDF to: ${outputPath}...`);

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '12mm',
      right: '12mm',
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-size: 8px; font-family: 'Plus Jakarta Sans', sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm;">
        <span>HCMS ("आवाज़") — Architecture, Workflows & Viva Guide</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
  });

  await browser.close();
  console.log(`[PDF Generator] Success! Generated ${outputPath}`);
}

generatePdf().catch((err) => {
  console.error('[PDF Generator] Error:', err);
  process.exit(1);
});
