import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Complaint, WardenScore } from '@hmcs/shared';
import { fetchWardenQueue, fetchWardenScore } from '../api/warden';
import WardenHeader from '../components/layout/WardenHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Countdown from '../components/ui/Countdown';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

export const WardenDashboardPage: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [scoreData, setScoreData] = useState<WardenScore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('overdue_first');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, scoreRes] = await Promise.all([
        fetchWardenQueue({
          priority: priorityFilter || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          overdue: overdueOnly || undefined,
          sort: sortOption,
        }),
        fetchWardenScore().catch(() => null),
      ]);

      setComplaints(queueRes.complaints);
      setTotalCount(queueRes.total);
      setOverdueCount(queueRes.overdueCount);
      if (scoreRes) setScoreData(scoreRes);
    } catch (err) {
      console.warn('Failed to load warden dashboard', err);
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, statusFilter, categoryFilter, overdueOnly, sortOption]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side text filter on title, description, or submitter
  const filteredComplaints = complaints.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.readableId.toLowerCase().includes(q) ||
      (c.submitter?.name && c.submitter.name.toLowerCase().includes(q)) ||
      (c.submitter?.roomNumber && c.submitter.roomNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <WardenHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* 4 Summary Metric Tiles */}
        <section aria-labelledby="warden-metrics-heading" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <h2 id="warden-metrics-heading" className="sr-only">
            Queue Summary Metrics
          </h2>

          <Card padded={false} className="p-5">
            <span className="text-[11px] font-mono uppercase text-[#7fb4c9] tracking-wider">
              Active Queue
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-light text-[#dfe7e0] font-mono">{totalCount}</span>
              <span className="text-xs text-[#9aa5a0]">tickets open</span>
            </div>
            <p className="text-[11px] text-[#9aa5a0] mt-2">Within your assigned building scope</p>
          </Card>

          <Card padded={false} className={`p-5 ${overdueCount > 0 ? 'border-[#ff5a5f]/50 bg-[#ff5a5f]/5' : ''}`}>
            <span className="text-[11px] font-mono uppercase text-[#ff5a5f] tracking-wider">
              Overdue Tickets
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-light text-[#ff5a5f] font-mono">{overdueCount}</span>
              <span className="text-xs text-[#9aa5a0]">SLA breached</span>
            </div>
            <p className="text-[11px] text-[#ff5a5f] mt-2 font-medium">Incurs immediate −1 penalty deduction</p>
          </Card>

          <Card padded={false} className="p-5">
            <span className="text-[11px] font-mono uppercase text-[#f5a524] tracking-wider">
              Student Star Rating
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-light text-[#f5a524] font-mono">
                {scoreData?.averageRating ? scoreData.averageRating.toFixed(2) : '3.00'}
              </span>
              <span className="text-xs text-[#9aa5a0]">/ 3.0 stars</span>
            </div>
            <p className="text-[11px] text-[#9aa5a0] mt-2">
              Based on {scoreData?.ratingCount || 0} student resolution reviews
            </p>
          </Card>

          <Card padded={false} className="p-5">
            <span className="text-[11px] font-mono uppercase text-[#6fcf97] tracking-wider">
              Composite SLA Score
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-light text-[#6fcf97] font-mono">
                {scoreData?.compositeScore !== undefined ? scoreData.compositeScore.toFixed(2) : '3.00'}
              </span>
              <span className="text-xs text-[#9aa5a0]">net score</span>
            </div>
            <p className="text-[11px] text-[#9aa5a0] mt-2">
              Score = Rating − (0.5 × Penalties)
            </p>
          </Card>
        </section>

        {/* Filter and Queue Toolbar */}
        <section className="p-4 sm:p-5 bg-[rgba(10,14,18,0.85)] border border-[rgba(223,231,224,0.16)] rounded-sm flex flex-col gap-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-[#dfe7e0]">
                Prioritised Resolution Queue
              </h2>
              <p className="text-xs text-[#9aa5a0]">
                Sorted by urgency: Overdue first, followed by Emergency (24h) tickets, then closest SLA deadlines.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={overdueOnly ? 'danger' : 'ghost'}
                size="small"
                onClick={() => setOverdueOnly(!overdueOnly)}
              >
                {overdueOnly ? 'Showing Overdue Only' : 'Filter Overdue'}
              </Button>
              <Link to="/warden/performance">
                <Button variant="ghost" size="small">
                  View Performance Audit →
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input
              placeholder="Search ID, title, student name, room..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="lg:col-span-2"
            />

            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              aria-label="Filter status"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="MARKED_RESOLVED">Marked Resolved (24h Window)</option>
              <option value="REOPENED">Reopened</option>
              <option value="RESOLVED">Resolved</option>
            </Select>

            <Select
              value={priorityFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriorityFilter(e.target.value)}
              aria-label="Filter priority"
            >
              <option value="">All Priorities</option>
              <option value="EMERGENCY">Emergency (24h)</option>
              <option value="NORMAL">Normal (72h)</option>
            </Select>

            <Select
              value={categoryFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)}
              aria-label="Filter category"
            >
              <option value="">All Categories</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="CLEANLINESS">Cleanliness</option>
              <option value="FURNITURE">Furniture</option>
              <option value="INTERNET">Internet</option>
              <option value="OTHER">Other</option>
            </Select>

            <Select
              value={sortOption}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortOption(e.target.value)}
              aria-label="Sort queue by"
            >
              <option value="overdue_first">Overdue First</option>
              <option value="nearest_deadline">Nearest Deadline</option>
              <option value="most_upvoted">Most Upvoted</option>
              <option value="newest">Newest First</option>
            </Select>
          </div>
        </section>

        {/* Complaints Table / List */}
        <section className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-4">
              <Skeleton height="120px" />
              <Skeleton height="120px" />
              <Skeleton height="120px" />
            </div>
          ) : filteredComplaints.length === 0 ? (
            <EmptyState
              title="No complaints in queue"
              description="No complaints match the current filter and search criteria in your assigned queue."
            />
          ) : (
            filteredComplaints.map((item) => {
              const isOverdue =
                item.status !== 'RESOLVED' &&
                item.status !== 'CLOSED' &&
                new Date(item.deadline).getTime() < Date.now();

              return (
                <Card
                  key={item.id}
                  padded={false}
                  className={`p-5 transition-all hover:border-[rgba(245,165,36,0.5)] flex flex-col gap-3 ${
                    isOverdue ? 'border-[#ff5a5f]/40 bg-[#ff5a5f]/5' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-[#05070a] text-[#dfe7e0] font-bold border border-[rgba(223,231,224,0.16)]">
                        {item.readableId}
                      </span>
                      <Badge label={item.category} />
                      <Badge priority={item.priority} />
                      <Badge status={item.status} />

                      {item.upvoteCount > 0 && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-[#f5a524]/10 text-[#f5a524] border border-[#f5a524]/30">
                          ▲ {item.upvoteCount} upvotes
                        </span>
                      )}
                    </div>

                    <Countdown targetDate={item.deadline} label="Resolution SLA" />
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

                    <Link to={`/warden/complaints/${item.id}`} className="shrink-0">
                      <Button variant="primary" size="small">
                        Manage &amp; Update →
                      </Button>
                    </Link>
                  </div>

                  {/* Submitter info visible to warden as per PRD */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[rgba(223,231,224,0.08)] text-xs text-[#9aa5a0]">
                    <div className="flex items-center gap-4">
                      <span>
                        Student: <strong className="text-[#dfe7e0]">{item.submitter?.name || 'Resident'}</strong>
                      </span>
                      <span>
                        Room: <strong className="text-[#dfe7e0]">{item.submitter?.roomNumber || 'Unassigned'}</strong>
                      </span>
                      {item.submitter?.studentId && (
                        <span>
                          ID: <span className="font-mono">{item.submitter.studentId}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {item.photos && item.photos.length > 0 && (
                        <span className="text-xs font-mono text-[#7fb4c9]">
                          📷 {item.photos.length} photo{item.photos.length === 1 ? '' : 's'}
                        </span>
                      )}
                      <span>
                        Lodged: {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
};

export default WardenDashboardPage;
