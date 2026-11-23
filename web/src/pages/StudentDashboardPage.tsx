import React, { useState, useEffect, useCallback } from 'react';
import { Complaint, QuotaStatus } from '@hmcs/shared';
import { fetchFeed } from '../api/complaints';
import { fetchQuota } from '../api/quota';
import StudentHeader from '../components/layout/StudentHeader';
import QuotaCards from '../components/complaints/QuotaCards';
import ComplaintCard from '../components/complaints/ComplaintCard';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { Link } from 'react-router-dom';

export const StudentDashboardPage: React.FC = () => {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  // Feed state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Filter & Sort state
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('newest');

  // Load quota
  const loadQuota = useCallback(async () => {
    try {
      const data = await fetchQuota();
      setQuota(data);
    } catch (err) {
      console.warn('Failed to fetch quota', err);
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  // Load feed items
  const loadFeed = useCallback(
    async (reset = true) => {
      if (reset) setFeedLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetchFeed({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          category: categoryFilter || undefined,
          search: searchQuery || undefined,
          sort: sortOption,
          cursor: reset ? undefined : nextCursor || undefined,
          limit: 10,
        });

        if (reset) {
          setComplaints(res.items);
        } else {
          setComplaints((prev) => [...prev, ...res.items]);
        }
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch (err) {
        console.warn('Failed to load feed', err);
      } finally {
        setFeedLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, priorityFilter, categoryFilter, searchQuery, sortOption, nextCursor]
  );

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  useEffect(() => {
    loadFeed(true);
  }, [statusFilter, priorityFilter, categoryFilter, sortOption]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadFeed(true);
  };

  const handleComplaintUpdated = (updated: Complaint) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <StudentHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Live Quota Cards */}
        <section aria-labelledby="quota-heading">
          <h2 id="quota-heading" className="sr-only">
            Your Active Complaint Quota
          </h2>
          <QuotaCards quota={quota} loading={quotaLoading} />
        </section>

        {/* Filters & Search Toolbar */}
        <section
          aria-labelledby="feed-filters-heading"
          className="p-4 sm:p-5 bg-[rgba(10,14,18,0.85)] border border-[rgba(223,231,224,0.16)] rounded-sm flex flex-col gap-4 backdrop-blur-md"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 id="feed-filters-heading" className="text-lg font-medium text-[#dfe7e0]">
                Hostel Community Feed
              </h2>
              <p className="text-xs text-[#9aa5a0]">
                Active complaints in your residence. Upvote issues to auto-promote them to Emergency SLA.
              </p>
            </div>

            <Link to="/student/new">
              <Button variant="primary" size="small">
                + Report New Issue
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <Input
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              />
              <Button type="submit" variant="ghost" size="default">
                Go
              </Button>
            </form>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="MARKED_RESOLVED">Marked Resolved (24h Window)</option>
            </Select>

            {/* Category Filter */}
            <Select
              value={categoryFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="CLEANLINESS">Cleanliness</option>
              <option value="FURNITURE">Furniture</option>
              <option value="INTERNET">Internet</option>
              <option value="OTHER">Other</option>
            </Select>

            {/* Priority Filter */}
            <Select
              value={priorityFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
            >
              <option value="">All Priorities</option>
              <option value="NORMAL">Normal (72h)</option>
              <option value="EMERGENCY">Emergency (24h)</option>
            </Select>

            {/* Sort Filter */}
            <Select
              value={sortOption}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortOption(e.target.value)}
              aria-label="Sort complaints by"
            >
              <option value="newest">Newest First</option>
              <option value="most_upvoted">Most Upvoted</option>
              <option value="nearest_deadline">Nearest Deadline</option>
            </Select>
          </div>
        </section>

        {/* Complaints Feed List */}
        <section aria-labelledby="feed-list-heading" className="flex flex-col gap-4">
          <h3 id="feed-list-heading" className="sr-only">
            Complaint Listings
          </h3>

          {feedLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton height="160px" />
              <Skeleton height="160px" />
              <Skeleton height="160px" />
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              title="No active complaints found"
              description="There are currently no open tickets matching your search and filter criteria in your hostel."
              action={
                <Link to="/student/new">
                  <Button variant="primary" size="small">
                    Report an Issue
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              {complaints.map((item) => (
                <ComplaintCard
                  key={item.id}
                  complaint={item}
                  onUpdate={handleComplaintUpdated}
                />
              ))}

              {/* Infinite Scroll / Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => loadFeed(false)}
                    isLoading={loadingMore}
                  >
                    Load More Complaints
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default StudentDashboardPage;
