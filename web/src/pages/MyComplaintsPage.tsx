import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Complaint } from '@hmcs/shared';
import { fetchMyComplaints } from '../api/complaints';
import StudentHeader from '../components/layout/StudentHeader';
import ComplaintCard from '../components/complaints/ComplaintCard';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

export const MyComplaintsPage: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const loadComplaints = useCallback(async (tab: string, p: number) => {
    setLoading(true);
    try {
      let statusParam: string | undefined = undefined;
      if (tab === 'active') statusParam = 'active';
      else if (tab === 'resolved') statusParam = 'RESOLVED';

      const res = await fetchMyComplaints({
        status: statusParam,
        page: p,
        limit: 10,
      });

      setComplaints(res.complaints);
      setTotalPages(res.pagination.totalPages);
      setPage(p);
    } catch (err) {
      console.warn('Failed to load my complaints', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints(activeTab, 1);
  }, [activeTab, loadComplaints]);

  const tabs = [
    { id: 'all', label: 'All My Complaints' },
    { id: 'active', label: 'Active In Progress' },
    { id: 'resolved', label: 'Resolved & Closed' },
  ];

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <StudentHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
              My Complaints History
            </h1>
            <p className="text-xs text-[#9aa5a0] mt-1">
              Track the progress, status changes, and warden resolution of issues you have submitted
            </p>
          </div>

          <Link to="/student/new">
            <Button variant="primary" size="small">
              + Report New Issue
            </Button>
          </Link>
        </div>

        {/* Status Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id)} />

        {/* Complaints List */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-4">
              <Skeleton height="140px" />
              <Skeleton height="140px" />
              <Skeleton height="140px" />
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              title="No complaints in this category"
              description="You have not submitted any complaints matching this filter."
              action={
                <Link to="/student/new">
                  <Button variant="primary" size="small">
                    Submit a Complaint
                  </Button>
                </Link>
              }
            />
          ) : (
            complaints.map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                onUpdate={(updated) =>
                  setComplaints((prev) =>
                    prev.map((item) => (item.id === updated.id ? updated : item))
                  )
                }
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-[#9aa5a0]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="small"
                disabled={page <= 1}
                onClick={() => loadComplaints(activeTab, page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="small"
                disabled={page >= totalPages}
                onClick={() => loadComplaints(activeTab, page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyComplaintsPage;
