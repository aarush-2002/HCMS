import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Complaint } from '@hmcs/shared';
import { fetchComplaintDetail, rateComplaint, confirmResolution } from '../api/complaints';
import StudentHeader from '../components/layout/StudentHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Countdown from '../components/ui/Countdown';
import ConfirmationBar from '../components/ui/ConfirmationBar';
import StarRating from '../components/ui/StarRating';
import Textarea from '../components/ui/Textarea';
import Skeleton from '../components/ui/Skeleton';
import Dialog from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';

export const ComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Rating state
  const [ratingStars, setRatingStars] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Confirmation voting state
  const [votingConfirm, setVotingConfirm] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchComplaintDetail(id);
      setComplaint(res.complaint);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load complaint details.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || ratingStars === 0) {
      showToast('Please select a star rating (1 to 3 stars).', 'warning');
      return;
    }

    setSubmittingRating(true);
    try {
      await rateComplaint(complaint.id, {
        stars: ratingStars,
        comment: ratingComment.trim() || undefined,
      });
      showToast('Warden rating submitted successfully.', 'success');
      loadDetail(); // Reload to reflect recorded rating
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit rating.';
      showToast(msg, 'error');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleConfirmVote = async (vote: 'solved' | 'not_solved') => {
    if (!complaint) return;
    setVotingConfirm(true);
    try {
      await confirmResolution(complaint.id, vote);
      showToast(
        vote === 'solved'
          ? 'Confirmation vote recorded: Solved.'
          : 'Report recorded: Issue still not solved.',
        vote === 'solved' ? 'success' : 'warning'
      );
      loadDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record vote.';
      showToast(msg, 'error');
    } finally {
      setVotingConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <StudentHeader />
        <main className="max-w-4xl w-full mx-auto p-6 flex flex-col gap-6">
          <Skeleton height="40px" />
          <Skeleton height="200px" />
          <Skeleton height="300px" />
        </main>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen flex flex-col">
        <StudentHeader />
        <main className="max-w-md w-full mx-auto p-8 text-center my-auto">
          <Card className="p-8">
            <h1 className="text-xl font-medium text-[#dfe7e0] mb-2">Complaint Not Found</h1>
            <p className="text-xs text-[#9aa5a0] mb-6">
              The requested complaint record does not exist or is outside your hostel scope.
            </p>
            <Link to="/student">
              <Button variant="primary" fullWidth>
                Return to Community Feed
              </Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  const isConfirmationWindowOpen =
    complaint.status === 'MARKED_RESOLVED' &&
    complaint.confirmationWindowEndsAt &&
    new Date(complaint.confirmationWindowEndsAt).getTime() > Date.now();

  const canRate =
    complaint.status === 'RESOLVED' &&
    complaint.isOwner &&
    !complaint.rating;

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <StudentHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/student"
            className="text-xs text-[#9aa5a0] hover:text-[#f5a524] transition-colors"
          >
            ← Back to Community Feed
          </Link>

          <span className="text-xs text-[#9aa5a0] font-mono">
            ID: <strong className="text-[#dfe7e0]">{complaint.readableId}</strong>
          </span>
        </div>

        {/* Complaint Overview Card */}
        <Card className="p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[rgba(223,231,224,0.1)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={complaint.category} />
              <Badge priority={complaint.priority} />
              <Badge status={complaint.status} />
            </div>

            {complaint.status !== 'RESOLVED' && complaint.status !== 'CLOSED' && (
              <Countdown targetDate={complaint.deadline} label="Active Deadline" />
            )}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-medium text-[#dfe7e0] tracking-tight">
              {complaint.title}
            </h1>
            <p className="text-sm text-[#9aa5a0] mt-3 whitespace-pre-wrap leading-relaxed">
              {complaint.description}
            </p>
          </div>

          {/* Photos bar & Lightbox trigger */}
          {complaint.photos && complaint.photos.length > 0 && (
            <div className="pt-2">
              <span className="text-xs uppercase font-medium tracking-wider text-[#9aa5a0] block mb-2">
                Attached Photos ({complaint.photos.length})
              </span>
              <div className="flex flex-wrap gap-3">
                {complaint.photos.map((photo, idx) => (
                  <button
                    key={photo.id || idx}
                    type="button"
                    onClick={() => setSelectedPhoto(photo.url)}
                    className="relative group w-20 h-20 rounded-sm border border-[rgba(223,231,224,0.16)] bg-[#0a0e12] overflow-hidden focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524]"
                    aria-label={`View photo ${idx + 1}`}
                  >
                    <img
                      src={photo.url}
                      alt={`Complaint photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-[#dfe7e0]">
                      Zoom
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submitter & Assigned Warden Meta */}
          <div className="pt-4 border-t border-[rgba(223,231,224,0.08)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#9aa5a0]">
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#9aa5a0]/70">Submitter</span>
              <span className="text-[#dfe7e0]">
                {complaint.isOwner ? 'You (complainant)' : 'Hostel Resident (anonymized)'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#9aa5a0]/70">Assigned Warden</span>
              <span className="text-[#dfe7e0]">
                {complaint.assignedWarden?.name || 'Assigned to Hostel Operations'}
              </span>
            </div>
          </div>
        </Card>

        {/* 24h Confirmation Window Voting Bar (if MARKED_RESOLVED) */}
        {complaint.status === 'MARKED_RESOLVED' && (
          <Card className="p-6 border-[#f5a524]/50">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-xs font-semibold text-[#f5a524] uppercase tracking-wider">
                  Community Confirmation Window Active
                </span>
                <p className="text-xs text-[#9aa5a0] mt-0.5">
                  The warden reports work has concluded. Confirm if the issue is actually resolved.
                </p>
              </div>

              {complaint.confirmationWindowEndsAt && (
                <Countdown targetDate={complaint.confirmationWindowEndsAt} label="Window Closes" />
              )}
            </div>

            {complaint.resolutionNote && (
              <div className="p-3 rounded-sm bg-[#05070a] border border-[rgba(223,231,224,0.12)] text-xs text-[#dfe7e0] italic mb-4">
                <strong>Warden Resolution Note:</strong> &ldquo;{complaint.resolutionNote}&rdquo;
              </div>
            )}

            <ConfirmationBar
              solvedCount={complaint.confirmationSummary?.solvedCount || 0}
              notSolvedCount={complaint.confirmationSummary?.notSolvedCount || 0}
              requiredVotes={complaint.confirmationSummary?.requiredVotes || 3}
            />

            {isConfirmationWindowOpen && (
              <div className="flex items-center gap-3 pt-4 mt-4 border-t border-[rgba(223,231,224,0.1)]">
                <span className="text-xs text-[#dfe7e0]">Cast your confirmation vote:</span>
                <Button
                  variant="primary"
                  size="small"
                  disabled={votingConfirm}
                  onClick={() => handleConfirmVote('solved')}
                >
                  ✓ Confirm Solved
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  disabled={votingConfirm}
                  onClick={() => handleConfirmVote('not_solved')}
                >
                  ✕ Still Broken
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Complainant Rating Form (Only when Resolved, only once, only complainant) */}
        {canRate && (
          <Card className="p-6 sm:p-8 border-[#f5a524]/40 bg-[rgba(14,20,30,0.9)]">
            <h3 className="text-lg font-medium text-[#dfe7e0] tracking-tight">
              Rate Warden Resolution
            </h3>
            <p className="text-xs text-[#9aa5a0] mt-1 mb-4">
              As the original complainant, your feedback directly informs the warden&apos;s performance evaluation.
            </p>

            <form onSubmit={handleSubmitRating} className="flex flex-col gap-4">
              <StarRating
                value={ratingStars}
                onChange={setRatingStars}
                size="large"
              />

              <Textarea
                label="Optional Comments on Resolution (Max 200 chars)"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="e.g. Prompt repair, left area clean and tidy..."
                rows={3}
                maxLength={200}
                showCount
                disabled={submittingRating}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submittingRating}
                  disabled={ratingStars === 0 || submittingRating}
                >
                  Submit Official Rating
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Recorded Rating Display (if already rated) */}
        {complaint.rating && (
          <Card className="p-6 border-[#6fcf97]/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#6fcf97] uppercase tracking-wider">
                Complainant Rating Recorded
              </span>
              <span className="text-xs text-[#9aa5a0] font-mono">
                {new Date(complaint.rating.createdAt).toLocaleDateString()}
              </span>
            </div>

            <StarRating value={complaint.rating.stars} readOnly size="default" />

            {complaint.rating.comment && (
              <p className="text-xs text-[#dfe7e0] mt-2 italic">
                &ldquo;{complaint.rating.comment}&rdquo;
              </p>
            )}
          </Card>
        )}

        {/* Audit & Timeline History Section */}
        <Card className="p-6 sm:p-8">
          <h3 className="text-base font-medium text-[#dfe7e0] tracking-tight mb-4 pb-2 border-b border-[rgba(223,231,224,0.08)]">
            Lifecycle &amp; Audit Timeline
          </h3>

          <div className="flex flex-col gap-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-[rgba(223,231,224,0.12)]">
            {/* Status History Items */}
            {complaint.statusHistory && complaint.statusHistory.length > 0 ? (
              complaint.statusHistory.map((item, idx) => (
                <div key={item.id || idx} className="flex items-start gap-4 relative">
                  <div className="w-6 h-6 rounded-full bg-[#05070a] border border-[#f5a524] flex items-center justify-center text-[10px] text-[#f5a524] shrink-0 font-mono">
                    ●
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[#dfe7e0]">
                        Status changed to{' '}
                        <strong className="text-[#f5a524]">{item.toStatus}</strong>
                      </span>
                      <span className="text-[11px] text-[#9aa5a0] font-mono">
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    {item.note && (
                      <p className="text-xs text-[#9aa5a0] mt-1 bg-[rgba(223,231,224,0.04)] p-2 rounded-sm border border-[rgba(223,231,224,0.06)]">
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#9aa5a0] pl-6">
                Status is currently {complaint.status}.
              </div>
            )}

            {/* Priority History Items (e.g. 10 upvotes promotion) */}
            {complaint.priorityHistory &&
              complaint.priorityHistory.map((item, idx) => (
                <div key={item.id || idx} className="flex items-start gap-4 relative">
                  <div className="w-6 h-6 rounded-full bg-[#05070a] border border-[#ff5a5f] flex items-center justify-center text-[10px] text-[#ff5a5f] shrink-0 font-mono">
                    ▲
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[#ff5a5f]">
                        Priority escalated: {item.fromPriority} → {item.toPriority}
                      </span>
                      <span className="text-[11px] text-[#9aa5a0] font-mono">
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-[#9aa5a0] mt-1">
                      Reason: {item.reason}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </main>

      {/* Lightbox Dialog */}
      <Dialog
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        title="Photo Viewer"
        maxWidth="lg"
        actions={
          <Button variant="ghost" size="small" onClick={() => setSelectedPhoto(null)}>
            Close
          </Button>
        }
      >
        {selectedPhoto && (
          <div className="max-h-[70vh] flex items-center justify-center overflow-hidden">
            <img
              src={selectedPhoto}
              alt="Expanded preview"
              className="max-w-full max-h-[65vh] object-contain rounded-sm"
            />
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default ComplaintDetailPage;
