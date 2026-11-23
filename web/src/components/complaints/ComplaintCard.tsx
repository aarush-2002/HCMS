import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Complaint } from '@hmcs/shared';
import { upvoteComplaint, removeUpvote, confirmResolution } from '../../api/complaints';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Countdown from '../ui/Countdown';
import ConfirmationBar from '../ui/ConfirmationBar';
import { useToast } from '../ui/Toast';

export interface ComplaintCardProps {
  complaint: Complaint;
  onUpdate?: (updated: Complaint) => void;
  showDetailLink?: boolean;
}

export const ComplaintCard: React.FC<ComplaintCardProps> = ({
  complaint,
  onUpdate,
  showDetailLink = true,
}) => {
  const { showToast } = useToast();

  // Optimistic upvote state
  const [upvoted, setUpvoted] = useState<boolean>(complaint.hasUpvoted || false);
  const [upvoteCount, setUpvoteCount] = useState<number>(complaint.upvoteCount || 0);
  const [upvoting, setUpvoting] = useState<boolean>(false);

  // Confirmation voting state
  const [votingConfirm, setVotingConfirm] = useState<boolean>(false);
  const [userConfirmVote, setUserConfirmVote] = useState<'SOLVED' | 'NOT_SOLVED' | null>(
    (complaint.confirmationSummary?.userVote as 'SOLVED' | 'NOT_SOLVED') || null
  );

  const handleToggleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (complaint.isOwner) {
      showToast('You cannot upvote your own complaint.', 'warning');
      return;
    }

    if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(complaint.status)) {
      showToast('Voting is closed for resolved or closed complaints.', 'info');
      return;
    }

    // Snapshot for rollback
    const prevUpvoted = upvoted;
    const prevCount = upvoteCount;

    // Apply optimistic update
    const newUpvoted = !prevUpvoted;
    const newCount = newUpvoted ? prevCount + 1 : Math.max(0, prevCount - 1);
    setUpvoted(newUpvoted);
    setUpvoteCount(newCount);
    setUpvoting(true);

    try {
      if (newUpvoted) {
        const res = await upvoteComplaint(complaint.id);
        setUpvoteCount(res.upvoteCount);
        if (res.promotedToEmergency) {
          showToast('10th upvote reached! This complaint has been promoted to Emergency (24h SLA).', 'warning');
          if (onUpdate) {
            onUpdate({ ...complaint, priority: 'EMERGENCY', upvoteCount: res.upvoteCount, hasUpvoted: true });
          }
        }
      } else {
        const res = await removeUpvote(complaint.id);
        setUpvoteCount(res.upvoteCount);
      }
    } catch (err: unknown) {
      // Rollback optimistic update
      setUpvoted(prevUpvoted);
      setUpvoteCount(prevCount);
      const msg = err instanceof Error ? err.message : 'Failed to register upvote.';
      showToast(msg, 'error');
    } finally {
      setUpvoting(false);
    }
  };

  const handleConfirmVote = async (vote: 'solved' | 'not_solved', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setVotingConfirm(true);
    try {
      const res = await confirmResolution(complaint.id, vote);
      const voteType = vote === 'solved' ? 'SOLVED' : 'NOT_SOLVED';
      setUserConfirmVote(voteType);
      showToast(
        vote === 'solved'
          ? 'Confirmation vote recorded: Solved.'
          : 'Report recorded: Issue still not solved.',
        vote === 'solved' ? 'success' : 'warning'
      );

      if (onUpdate) {
        onUpdate({
          ...complaint,
          status: res.status as any,
          confirmationSummary: {
            solvedCount: res.solvedCount,
            notSolvedCount: res.notSolvedCount,
            requiredVotes: res.requiredVotes,
            round: complaint.confirmationRound,
            windowEndsAt: complaint.confirmationWindowEndsAt || null,
            isWindowOpen: res.status === 'MARKED_RESOLVED',
            userVote: voteType,
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cast confirmation vote.';
      showToast(msg, 'error');
    } finally {
      setVotingConfirm(false);
    }
  };

  const isConfirmationWindowOpen =
    complaint.status === 'MARKED_RESOLVED' &&
    complaint.confirmationWindowEndsAt &&
    new Date(complaint.confirmationWindowEndsAt).getTime() > Date.now();

  return (
    <Card padded={false} className="p-5 sm:p-6 transition-all hover:border-[rgba(245,165,36,0.4)] flex flex-col gap-4">
      {/* Top Header: Category, Priority, Status, Sequence ID */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-[rgba(223,231,224,0.08)] text-[#dfe7e0] font-semibold border border-[rgba(223,231,224,0.12)]">
            {complaint.readableId}
          </span>
          <Badge label={complaint.category} />
          <Badge priority={complaint.priority} />
          <Badge status={complaint.status} />
        </div>

        {/* SLA Timer */}
        {complaint.status !== 'RESOLVED' && complaint.status !== 'CLOSED' && (
          <Countdown targetDate={complaint.deadline} label="SLA Deadline" />
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-base sm:text-lg font-medium text-[#dfe7e0] tracking-tight hover:text-[#f5a524] transition-colors">
          {showDetailLink ? (
            <Link to={`/student/complaints/${complaint.id}`}>
              {complaint.title}
            </Link>
          ) : (
            complaint.title
          )}
        </h3>

        <p className="text-xs sm:text-sm text-[#9aa5a0] line-clamp-3 leading-relaxed">
          {complaint.description}
        </p>
      </div>

      {/* Photos thumbnail bar if attached */}
      {complaint.photos && complaint.photos.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          {complaint.photos.map((photo, idx) => (
            <div
              key={photo.id || idx}
              className="w-14 h-14 rounded-sm border border-[rgba(223,231,224,0.16)] bg-[#0a0e12] overflow-hidden shrink-0 aspect-square"
            >
              <img
                src={photo.url}
                alt={`Complaint attachment ${idx + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform"
                loading="lazy"
              />
            </div>
          ))}
          <span className="text-[11px] text-[#9aa5a0] font-mono">
            {complaint.photos.length} {complaint.photos.length === 1 ? 'photo' : 'photos'} attached
          </span>
        </div>
      )}

      {/* 24-Hour Resolution Confirmation Voting Widget (if MARKED_RESOLVED) */}
      {complaint.status === 'MARKED_RESOLVED' && (
        <div className="mt-1 p-3.5 bg-[rgba(10,14,18,0.9)] border border-[#f5a524]/40 rounded-sm flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f5a524] animate-pulse" />
              <span className="text-xs font-semibold text-[#f5a524] uppercase tracking-wider">
                Warden Reported Fixed — Confirmation Window
              </span>
            </div>

            {complaint.confirmationWindowEndsAt && (
              <Countdown
                targetDate={complaint.confirmationWindowEndsAt}
                label="Window Ends"
              />
            )}
          </div>

          {complaint.resolutionNote && (
            <p className="text-xs text-[#dfe7e0] italic bg-[rgba(223,231,224,0.04)] p-2 rounded-sm border border-[rgba(223,231,224,0.08)]">
              &ldquo;{complaint.resolutionNote}&rdquo;
            </p>
          )}

          <ConfirmationBar
            solvedCount={complaint.confirmationSummary?.solvedCount || 0}
            notSolvedCount={complaint.confirmationSummary?.notSolvedCount || 0}
            requiredVotes={complaint.confirmationSummary?.requiredVotes || 3}
          />

          {/* Voting Action Buttons */}
          {isConfirmationWindowOpen && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-[#9aa5a0]">Did this fix the problem?</span>
              <div className="flex gap-2">
                <Button
                  variant={userConfirmVote === 'SOLVED' ? 'primary' : 'ghost'}
                  size="small"
                  disabled={votingConfirm}
                  onClick={(e) => handleConfirmVote('solved', e)}
                >
                  ✓ Solved
                </Button>
                <Button
                  variant={userConfirmVote === 'NOT_SOLVED' ? 'danger' : 'ghost'}
                  size="small"
                  disabled={votingConfirm}
                  onClick={(e) => handleConfirmVote('not_solved', e)}
                >
                  ✕ Still Broken
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Footer: Submitter privacy tag, Created date, Upvote Action */}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-[rgba(223,231,224,0.08)] text-xs text-[#9aa5a0]">
        <div className="flex items-center gap-2">
          <span>
            {complaint.isOwner ? (
              <strong className="text-[#f5a524]">Submitted by You</strong>
            ) : (
              <span>Hostel Resident</span>
            )}
          </span>
          <span className="text-[#dfe7e0]/20">·</span>
          <span>{new Date(complaint.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>

        <div className="flex items-center gap-3">
          {showDetailLink && (
            <Link
              to={`/student/complaints/${complaint.id}`}
              className="text-xs text-[#9aa5a0] hover:text-[#dfe7e0] font-medium"
            >
              View Timeline →
            </Link>
          )}

          {/* Upvote Button with optimistic count */}
          <button
            type="button"
            onClick={handleToggleUpvote}
            disabled={upvoting || complaint.isOwner}
            aria-pressed={upvoted}
            aria-label={`Upvote complaint. Current upvotes: ${upvoteCount}`}
            className={`min-h-[36px] px-3 py-1 text-xs font-mono font-medium rounded-sm border flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524] ${
              complaint.isOwner
                ? 'opacity-60 cursor-not-allowed bg-[rgba(223,231,224,0.04)] border-[rgba(223,231,224,0.1)] text-[#9aa5a0]'
                : upvoted
                ? 'bg-[#f5a524] text-[#05070a] border-[#f5a524] font-semibold'
                : 'bg-[rgba(223,231,224,0.06)] hover:bg-[rgba(245,165,36,0.1)] hover:border-[#f5a524]/50 border-[rgba(223,231,224,0.16)] text-[#dfe7e0]'
            }`}
          >
            <span>▲</span>
            <span>{upvoteCount}</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

export default ComplaintCard;
