import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WardenScore } from '@hmcs/shared';
import { fetchWardenScore } from '../api/warden';
import WardenHeader from '../components/layout/WardenHeader';
import Card, { CardTitle, CardDescription } from '../components/ui/Card';
import StarRating from '../components/ui/StarRating';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

export const WardenPerformancePage: React.FC = () => {
  const [score, setScore] = useState<WardenScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWardenScore()
      .then((data: WardenScore) => setScore(data))
      .catch((err: unknown) => console.warn('Failed to load warden score', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <WardenHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#dfe7e0] tracking-tight">
            Warden Performance &amp; SLA Evaluation
          </h1>
          <p className="text-xs text-[#9aa5a0] mt-1">
            Transparent institutional accountability combining student resolution ratings with objective deadline penalty tracking.
          </p>
        </div>

        {/* 3 Metric Score Tiles */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton height="140px" />
            <Skeleton height="140px" />
            <Skeleton height="140px" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Student Star Rating Card */}
            <Card padded={false} className="p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#f5a524]">
                  Component 1: Student Rating
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-light font-mono text-[#f5a524]">
                    {score?.averageRating ? score.averageRating.toFixed(2) : '3.00'}
                  </span>
                  <span className="text-xs text-[#9aa5a0]">/ 3.00 stars</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[rgba(223,231,224,0.08)]">
                <StarRating value={Math.round(score?.averageRating || 3)} readOnly size="small" />
                <span className="text-[11px] text-[#9aa5a0] mt-1 block">
                  From {score?.ratingCount || 0} student verified reviews
                </span>
              </div>
            </Card>

            {/* Total Penalties Card */}
            <Card
              padded={false}
              className={`p-6 flex flex-col justify-between ${
                (score?.totalPenalties || 0) > 0 ? 'border-[#ff5a5f]/40 bg-[#ff5a5f]/5' : ''
              }`}
            >
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#ff5a5f]">
                  Component 2: SLA Penalties
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-light font-mono text-[#ff5a5f]">
                    {score?.totalPenalties || 0}
                  </span>
                  <span className="text-xs text-[#9aa5a0]">penalties incurred</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[rgba(223,231,224,0.08)] text-[11px] text-[#9aa5a0]">
                <span>−1.0 per ticket exceeding 72h or 24h SLA</span>
              </div>
            </Card>

            {/* Net Composite Score */}
            <Card padded={false} className="p-6 flex flex-col justify-between border-[#6fcf97]/40 bg-[#6fcf97]/5">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#6fcf97]">
                  Final Composite Score
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-light font-mono text-[#6fcf97]">
                    {score?.compositeScore !== undefined ? score.compositeScore.toFixed(2) : '3.00'}
                  </span>
                  <span className="text-xs text-[#9aa5a0]">institutional score</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[rgba(223,231,224,0.08)] text-[11px] text-[#6fcf97]">
                <span>Rating − (0.5 × Penalties)</span>
              </div>
            </Card>
          </div>
        )}

        {/* Plain Language Formula Explanation (Prompt Requirement) */}
        <Card className="p-6 sm:p-8 bg-[rgba(10,14,18,0.85)] border-[rgba(223,231,224,0.16)]">
          <CardTitle>How Warden Performance Is Calculated</CardTitle>
          <CardDescription className="mt-1">
            Understanding the separation of qualitative student feedback and automated deadline enforcement.
          </CardDescription>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 text-xs text-[#dfe7e0]/90 leading-relaxed">
            <div className="p-4 rounded-sm bg-[#05070a] border border-[rgba(223,231,224,0.08)] flex flex-col gap-2">
              <span className="font-semibold text-[#f5a524] uppercase tracking-wider text-[11px]">
                1. Qualitative Student Star Ratings (1–3 Stars)
              </span>
              <p className="text-[#9aa5a0]">
                When a complaint transitions to Resolved (confirmed by 3 students), the original student complainant receives an exclusive, one-time invitation to evaluate the fix on a 1-to-3 star scale. This reflects quality of work, cleanliness, and professionalism.
              </p>
            </div>

            <div className="p-4 rounded-sm bg-[#05070a] border border-[rgba(223,231,224,0.08)] flex flex-col gap-2">
              <span className="font-semibold text-[#ff5a5f] uppercase tracking-wider text-[11px]">
                2. Automated Deadline SLA Penalties (−1 Point Each)
              </span>
              <p className="text-[#9aa5a0]">
                Deadlines are governed automatically by server-side cron timers (72h for standard issues, 24h for emergency or 10-upvote escalated issues). If a complaint passes its deadline without being marked resolved, an immutable −1 penalty event is logged.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-sm bg-[#05070a] border border-[rgba(245,165,36,0.3)] flex flex-col gap-2">
            <span className="text-[11px] font-mono uppercase text-[#f5a524] tracking-wider">
              The Composite Scoring Formula:
            </span>
            <code className="text-sm font-mono text-[#dfe7e0] font-medium">
              Composite Score = Average Student Rating − (0.5 × Total Penalties)
            </code>
            <p className="text-xs text-[#9aa5a0] mt-1">
              This balanced approach guarantees that fast resolution cannot sacrifice repair quality, and high satisfaction ratings cannot excuse chronic SLA deadline breaches.
            </p>
          </div>
        </Card>

        {/* Itemized List of Incurred Penalties Linked to Specific Complaints */}
        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(223,231,224,0.08)] mb-4">
            <div>
              <h3 className="text-base font-medium text-[#dfe7e0] tracking-tight">
                Itemized Penalty Ledger ({score?.penalties.length || 0})
              </h3>
              <p className="text-xs text-[#9aa5a0]">
                Every penalty is linked to its root complaint and exact breach timestamp.
              </p>
            </div>
          </div>

          {score?.penalties && score.penalties.length > 0 ? (
            <div className="divide-y divide-[rgba(223,231,224,0.06)]">
              {score.penalties.map((p) => (
                <div
                  key={p.id}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono px-2 py-0.5 rounded-sm bg-[#ff5a5f]/15 text-[#ff5a5f] font-bold">
                        −1 Penalty
                      </span>
                      <Link
                        to={`/warden/complaints/${p.complaintId}`}
                        className="text-[#dfe7e0] hover:text-[#f5a524] font-medium transition-colors"
                      >
                        {p.complaintReadableId}: {p.complaintTitle}
                      </Link>
                    </div>
                    <span className="text-[11px] text-[#9aa5a0] font-mono mt-1 block">
                      Deadline Expired: {new Date(p.deadlinePassedAt).toLocaleString()}
                    </span>
                  </div>

                  <Link to={`/warden/complaints/${p.complaintId}`}>
                    <span className="text-xs text-[#f5a524] hover:underline font-medium">
                      Inspect Ticket →
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Zero Penalties on Record"
              description="You have no overdue penalties recorded in the system ledger."
            />
          )}
        </Card>
      </main>
    </div>
  );
};

export default WardenPerformancePage;
