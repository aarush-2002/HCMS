import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import Button from '../../components/ui/Button';
import Card, { CardTitle, CardDescription } from '../../components/ui/Card';
import Dialog from '../../components/ui/Dialog';

interface PublicStats {
  totalCount: number;
  resolvedCount: number;
  emergencyCount: number;
  hostelCount: number;
  resolvedPercentage: number;
}

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [stats, setStats] = useState<PublicStats>({
    totalCount: 0,
    resolvedCount: 0,
    emergencyCount: 0,
    hostelCount: 1,
    resolvedPercentage: 0,
  });

  useEffect(() => {
    apiRequest<PublicStats>('/api/public/stats')
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {
        // Fallback gracefully
      });
  }, []);

  return (
    <div className="relative min-h-screen z-10 flex flex-col justify-between selection:bg-[#f5a524]/20 selection:text-[#f5a524]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[rgba(5,7,10,0.85)] border-b border-[rgba(223,231,224,0.12)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="font-bold text-xl tracking-tight text-[#dfe7e0] group-hover:text-[#f5a524] transition-colors">
                HCMS
              </span>
              <span className="text-xs px-2 py-0.5 rounded-sm bg-[#f5a524]/10 text-[#f5a524] border border-[#f5a524]/30 font-medium">
                आवाज़
              </span>
            </Link>
          </div>

          <nav className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="text-xs sm:text-sm text-[#9aa5a0] hover:text-[#dfe7e0] transition-colors min-h-[44px] px-2 flex items-center"
            >
              How It Works
            </button>

            {user ? (
              <Button
                variant="primary"
                size="small"
                onClick={() => {
                  if (user.role === 'STUDENT') navigate('/student');
                  else if (user.role === 'WARDEN') navigate('/warden');
                  else navigate('/admin');
                }}
              >
                Go to Portal ({user.name.split(' ')[0]})
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/student/login">
                  <Button variant="ghost" size="small">
                    Student Login
                  </Button>
                </Link>
                <Link to="/warden/login">
                  <Button variant="primary" size="small">
                    Warden Login
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col gap-24">
        {/* Hero Section */}
        <section className="relative text-center flex flex-col items-center justify-center min-h-[60vh] max-w-4xl mx-auto">
          {/* Devanagari Watermark in background */}
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          >
            <span className="text-[120px] sm:text-[200px] md:text-[280px] font-bold text-[#dfe7e0]/[0.03] tracking-widest translate-y-4">
              आवाज़
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-[rgba(223,231,224,0.16)] bg-[rgba(10,14,18,0.8)] text-xs text-[#9aa5a0]">
              <span className="w-2 h-2 rounded-full bg-[#f5a524] animate-pulse" />
              <span>Hostel Complaint Management System</span>
              <span className="text-[#dfe7e0]/40">|</span>
              <span className="text-[#dfe7e0]">Verifiable SLAs</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-light tracking-tight text-[#dfe7e0] leading-[1.08]">
              Raise it. Back it. <br />
              <span className="font-normal text-[#f5a524]">See it resolved.</span>
            </h1>

            <p className="max-w-2xl text-base sm:text-lg text-[#9aa5a0] font-light leading-relaxed">
              The institutional complaint network built on strict service deadlines, collective community upvotes, and student-verified resolutions. Every ticket is transparent and auditable.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link to="/student/login">
                <Button variant="primary" size="large">
                  Report a Complaint
                </Button>
              </Link>
              <Link to="/warden/login">
                <Button variant="ghost" size="large">
                  Warden Workspace
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 4 Core Governance Metrics */}
        <section aria-labelledby="stats-heading" className="w-full">
          <h2 id="stats-heading" className="sr-only">
            Core Service Level Agreements and Community Metrics
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padded={false} className="p-6 text-center">
              <span className="text-3xl sm:text-4xl font-light text-[#7fb4c9] font-mono">
                72h
              </span>
              <h3 className="text-sm font-medium text-[#dfe7e0] mt-2">Normal SLA</h3>
              <p className="text-xs text-[#9aa5a0] mt-1">Guaranteed resolution deadline for standard hostel issues</p>
            </Card>

            <Card padded={false} className="p-6 text-center">
              <span className="text-3xl sm:text-4xl font-light text-[#ff5a5f] font-mono">
                24h
              </span>
              <h3 className="text-sm font-medium text-[#dfe7e0] mt-2">Emergency SLA</h3>
              <p className="text-xs text-[#9aa5a0] mt-1">Rapid response window for water, power, and safety emergencies</p>
            </Card>

            <Card padded={false} className="p-6 text-center">
              <span className="text-3xl sm:text-4xl font-light text-[#f5a524] font-mono">
                10
              </span>
              <h3 className="text-sm font-medium text-[#dfe7e0] mt-2">Upvotes Escalation</h3>
              <p className="text-xs text-[#9aa5a0] mt-1">10 student votes auto-promote a complaint to Emergency status</p>
            </Card>

            <Card padded={false} className="p-6 text-center">
              <span className="text-3xl sm:text-4xl font-light text-[#6fcf97] font-mono">
                3
              </span>
              <h3 className="text-sm font-medium text-[#dfe7e0] mt-2">Confirmations</h3>
              <p className="text-xs text-[#9aa5a0] mt-1">3 student Solved votes required before any ticket closes</p>
            </Card>
          </div>
        </section>

        {/* Live Pulse Banner */}
        <section className="hmcs-panel p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-[rgba(223,231,224,0.16)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-[#f5a524]/10 border border-[#f5a524]/30 flex items-center justify-center text-[#f5a524] text-xl font-mono">
              ◈
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#dfe7e0]">Hostel Night Pulse</h3>
              <p className="text-xs text-[#9aa5a0]">
                Every lit window in the night background represents a student-confirmed resolution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-center font-mono">
            <div>
              <span className="text-2xl font-light text-[#dfe7e0]">{stats.totalCount}</span>
              <span className="block text-[10px] uppercase text-[#9aa5a0] tracking-wider font-sans">Total Lodged</span>
            </div>
            <div className="w-px h-8 bg-[rgba(223,231,224,0.1)]" />
            <div>
              <span className="text-2xl font-light text-[#6fcf97]">{stats.resolvedCount}</span>
              <span className="block text-[10px] uppercase text-[#9aa5a0] tracking-wider font-sans">Resolved</span>
            </div>
            <div className="w-px h-8 bg-[rgba(223,231,224,0.1)]" />
            <div>
              <span className="text-2xl font-light text-[#f5a524]">
                {stats.resolvedPercentage}%
              </span>
              <span className="block text-[10px] uppercase text-[#9aa5a0] tracking-wider font-sans">Lit Windows</span>
            </div>
          </div>
        </section>

        {/* 4-Chapter Narrative Scroll */}
        <section className="flex flex-col gap-12">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs uppercase tracking-widest text-[#f5a524] font-medium">The Resolution Lifecycle</span>
            <h2 className="text-3xl font-light text-[#dfe7e0] tracking-tight mt-2">How आवाज़ Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chapter 1: Report */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#7fb4c9]">CHAPTER 01</span>
                <CardTitle className="mt-1">Report</CardTitle>
                <CardDescription className="mt-2">
                  Structured submissions with quota safeguards (1 normal/day, 1 emergency/week) to eliminate noise. Attach up to 3 photos with automatic EXIF stripping for student privacy.
                </CardDescription>
              </div>
              <div className="mt-6 pt-4 border-t border-[rgba(223,231,224,0.08)] text-xs text-[#9aa5a0] flex items-center justify-between">
                <span>Unique Sequence IDs: HM-0001</span>
                <span className="text-[#7fb4c9]">Scoped by Hostel</span>
              </div>
            </Card>

            {/* Chapter 2: Support */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#f5a524]">CHAPTER 02</span>
                <CardTitle className="mt-1">Support</CardTitle>
                <CardDescription className="mt-2">
                  Common problems get backed by the community. When a normal complaint reaches 10 eligible student upvotes, HCMS auto-promotes it to an Emergency with an immediate 24-hour SLA reset.
                </CardDescription>
              </div>
              <div className="mt-6 pt-4 border-t border-[rgba(223,231,224,0.08)] text-xs text-[#9aa5a0] flex items-center justify-between">
                <span>Anonymized Complainant</span>
                <span className="text-[#f5a524]">Automatic Escalation</span>
              </div>
            </Card>

            {/* Chapter 3: Resolve */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#ff5a5f]">CHAPTER 03</span>
                <CardTitle className="mt-1">Resolve</CardTitle>
                <CardDescription className="mt-2">
                  Wardens manage an auditable queue ordered by SLA urgency. Overdue tickets automatically incur penalty deductions against the warden&apos;s score. Resolutions require mandatory notes.
                </CardDescription>
              </div>
              <div className="mt-6 pt-4 border-t border-[rgba(223,231,224,0.08)] text-xs text-[#9aa5a0] flex items-center justify-between">
                <span>Binding Deadlines</span>
                <span className="text-[#ff5a5f]">Accountability Penalties</span>
              </div>
            </Card>

            {/* Chapter 4: Daybreak */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#6fcf97]">CHAPTER 04</span>
                <CardTitle className="mt-1">Daybreak</CardTitle>
                <CardDescription className="mt-2">
                  Wardens don&apos;t close tickets alone—students do. When marked resolved, a 24h confirmation window opens. Three student &ldquo;Solved&rdquo; votes confirm the fix and light up the hostel night.
                </CardDescription>
              </div>
              <div className="mt-6 pt-4 border-t border-[rgba(223,231,224,0.08)] text-xs text-[#9aa5a0] flex items-center justify-between">
                <span>3 Confirmation Threshold</span>
                <span className="text-[#6fcf97]">1–3 Star Rating</span>
              </div>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[rgba(223,231,224,0.12)] bg-[rgba(5,7,10,0.92)] py-8 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9aa5a0]">
          <div className="flex items-center gap-2">
            <span className="text-[#dfe7e0] font-medium">HCMS — Hostel Complaint Management System</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="hover:text-[#dfe7e0] transition-colors"
            >
              Policies &amp; SLAs
            </button>
            <Link to="/student/login" className="hover:text-[#dfe7e0] transition-colors">
              Student Portal
            </Link>
            <Link to="/warden/login" className="hover:text-[#dfe7e0] transition-colors">
              Warden Portal
            </Link>
          </div>
        </div>
      </footer>

      {/* Policy & Help Dialog */}
      <Dialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="HCMS System Architecture & Governance Rules"
        description="Core policies defined in /docs/BRIEF.md enforced across server and client."
        maxWidth="lg"
        actions={
          <Button variant="primary" size="small" onClick={() => setIsHelpOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-4 text-xs text-[#dfe7e0]/90 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h4 className="font-semibold text-[#f5a524] uppercase tracking-wider text-[11px] mb-1">
              1. Submission Quotas
            </h4>
            <p className="text-[#9aa5a0]">
              Students are allocated <strong>1 normal complaint per calendar day</strong> and <strong>1 emergency complaint per calendar week</strong> (evaluated in the hostel&apos;s time zone, starting Monday). This ensures all lodged issues receive serious operational attention.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#f5a524] uppercase tracking-wider text-[11px] mb-1">
              2. Resolution Deadlines (SLAs)
            </h4>
            <p className="text-[#9aa5a0]">
              Normal tickets carry a strict <strong>72-hour deadline</strong>. Emergency complaints have a <strong>24-hour deadline</strong>. Deadlines run continuously. Passing a deadline without being marked resolved incurs an immutable <strong>−1 penalty</strong> on the responsible warden.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#f5a524] uppercase tracking-wider text-[11px] mb-1">
              3. Community Escalation (10 Upvotes)
            </h4>
            <p className="text-[#9aa5a0]">
              Students may upvote active issues in their hostel (except their own). When a normal complaint reaches <strong>10 upvotes</strong>, the system automatically elevates it to Emergency priority and resets the deadline to 24 hours.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#f5a524] uppercase tracking-wider text-[11px] mb-1">
              4. 24h Confirmation Window
            </h4>
            <p className="text-[#9aa5a0]">
              When a warden marks a complaint &ldquo;Marked Resolved&rdquo;, a 24-hour voting window opens for hostel residents. <strong>3 Solved votes</strong> transition the ticket to Resolved. <strong>3 Not Solved votes</strong> automatically reopen it for remediation.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#f5a524] uppercase tracking-wider text-[11px] mb-1">
              5. Warden Performance Scoring
            </h4>
            <p className="text-[#9aa5a0]">
              Complainants rate resolved issues (1 to 3 stars). The composite warden score formula is:
              <br />
              <code className="text-[#dfe7e0] font-mono bg-[#05070a] px-2 py-0.5 rounded-sm inline-block mt-1">
                Composite Score = Average Rating − (0.5 × Penalties)
              </code>
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default LandingPage;
