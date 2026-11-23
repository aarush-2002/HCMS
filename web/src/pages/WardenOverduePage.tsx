import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Complaint } from '@hmcs/shared';
import { fetchWardenQueue } from '../api/warden';
import WardenHeader from '../components/layout/WardenHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Countdown from '../components/ui/Countdown';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

export const WardenOverduePage: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOverdue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWardenQueue({ overdue: true, sort: 'overdue_first' });
      setComplaints(res.complaints);
    } catch (err) {
      console.warn('Failed to load overdue queue', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverdue();
  }, [loadOverdue]);

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <WardenHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Header Banner */}
        <div className="p-6 bg-[#ff5a5f]/10 border border-[#ff5a5f]/30 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5a5f] animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#ff5a5f] uppercase tracking-wider">
                SLA Breach Incident Center
              </span>
            </div>
            <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
              Overdue Resolution Queue ({complaints.length})
            </h1>
            <p className="text-xs text-[#9aa5a0] mt-1">
              Every complaint listed below has exceeded its 72h or 24h SLA and has incurred an automated penalty deduction.
            </p>
          </div>

          <Link to="/warden">
            <Button variant="ghost" size="small">
              View All Queue Tickets
            </Button>
          </Link>
        </div>

        {/* List of Overdue Complaints */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-4">
              <Skeleton height="140px" />
              <Skeleton height="140px" />
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              title="No Overdue Complaints!"
              description="Excellent work. All complaints in your assigned hostel buildings are currently proceeding within their allowed SLA windows."
              action={
                <Link to="/warden">
                  <Button variant="primary" size="small">
                    Back to General Queue
                  </Button>
                </Link>
              }
            />
          ) : (
            complaints.map((item) => (
              <Card
                key={item.id}
                padded={false}
                className="p-5 sm:p-6 border-[#ff5a5f]/50 bg-[#ff5a5f]/5 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-[#05070a] text-[#ff5a5f] font-bold border border-[#ff5a5f]/30">
                      {item.readableId}
                    </span>
                    <Badge label={item.category} />
                    <Badge priority={item.priority} />
                    <Badge status={item.status} />
                  </div>

                  <Countdown targetDate={item.deadline} label="SLA Deadline" />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <Link
                      to={`/warden/complaints/${item.id}`}
                      className="text-base font-medium text-[#dfe7e0] hover:text-[#f5a524] transition-colors"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-[#9aa5a0] mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  <Link to={`/warden/complaints/${item.id}`}>
                    <Button variant="primary" size="small">
                      Immediate Triage →
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[rgba(223,231,224,0.08)] text-xs text-[#9aa5a0]">
                  <div className="flex items-center gap-4">
                    <span>
                      Student: <strong className="text-[#dfe7e0]">{item.submitter?.name}</strong>
                    </span>
                    <span>
                      Room: <strong className="text-[#dfe7e0]">{item.submitter?.roomNumber}</strong>
                    </span>
                  </div>

                  <span className="text-[#ff5a5f] font-mono font-medium">
                    −1 Penalty Event Incurred
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default WardenOverduePage;
