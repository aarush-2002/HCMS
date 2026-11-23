import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Complaint, ComplaintStatus } from '@hmcs/shared';
import { fetchWardenComplaint, updateWardenStatus } from '../api/warden';
import WardenHeader from '../components/layout/WardenHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Countdown from '../components/ui/Countdown';
import Skeleton from '../components/ui/Skeleton';
import Dialog from '../components/ui/Dialog';
import ConfirmationBar from '../components/ui/ConfirmationBar';
import { useToast } from '../components/ui/Toast';

export const WardenComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Status transition form state
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [transitionNote, setTransitionNote] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadComplaint = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchWardenComplaint(id);
      setComplaint(res.complaint);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load complaint.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadComplaint();
  }, [loadComplaint]);

  // Determine allowed status transitions based on current status
  const getAllowedTransitions = (status: ComplaintStatus): Array<{ value: string; label: string }> => {
    switch (status) {
      case 'SUBMITTED':
        return [{ value: 'ACKNOWLEDGED', label: 'Acknowledge Complaint' }];
      case 'ACKNOWLEDGED':
        return [{ value: 'IN_PROGRESS', label: 'Move to In Progress' }];
      case 'IN_PROGRESS':
        return [{ value: 'MARKED_RESOLVED', label: 'Mark Resolved (Opens 24h Student Confirmation)' }];
      case 'REOPENED':
        return [{ value: 'IN_PROGRESS', label: 'Resume Remediation (In Progress)' }];
      case 'MARKED_RESOLVED':
        return [{ value: 'IN_PROGRESS', label: 'Return to In Progress' }];
      default:
        return [];
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !targetStatus) return;
    setFormError(null);

    // Validate resolution note when moving to MARKED_RESOLVED
    if (targetStatus === 'MARKED_RESOLVED') {
      if (!resolutionNote.trim() || resolutionNote.trim().length < 10) {
        setFormError('A detailed resolution note (at least 10 characters) is mandatory to mark resolved.');
        return;
      }
    }

    setSubmittingStatus(true);
    try {
      await updateWardenStatus(complaint.id, {
        status: targetStatus,
        note: transitionNote.trim() || undefined,
        resolutionNote: targetStatus === 'MARKED_RESOLVED' ? resolutionNote.trim() : undefined,
      });

      showToast(`Complaint status updated to ${targetStatus}.`, 'success');
      setTargetStatus('');
      setTransitionNote('');
      setResolutionNote('');
      loadComplaint();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmittingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <WardenHeader />
        <main className="max-w-5xl w-full mx-auto p-6 flex flex-col gap-6">
          <Skeleton height="40px" />
          <Skeleton height="240px" />
          <Skeleton height="200px" />
        </main>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen flex flex-col">
        <WardenHeader />
        <main className="max-w-md w-full mx-auto p-8 text-center my-auto">
          <Card className="p-8">
            <h1 className="text-xl font-medium text-[#dfe7e0] mb-2">Complaint Not Found</h1>
            <p className="text-xs text-[#9aa5a0] mb-6">
              This ticket does not exist or falls outside your assigned hostel buildings.
            </p>
            <Link to="/warden">
              <Button variant="primary" fullWidth>
                Return to Queue
              </Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  const allowedTransitions = getAllowedTransitions(complaint.status);

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <WardenHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/warden"
            className="text-xs text-[#9aa5a0] hover:text-[#f5a524] transition-colors"
          >
            ← Back to Prioritised Queue
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#9aa5a0] font-mono">
              Ticket: <strong className="text-[#dfe7e0]">{complaint.readableId}</strong>
            </span>
            <Badge priority={complaint.priority} />
            <Badge status={complaint.status} />
          </div>
        </div>

        {/* Complaint Detail Card */}
        <Card className="p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[rgba(223,231,224,0.1)]">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm px-2.5 py-1 rounded-sm bg-[#05070a] border border-[rgba(223,231,224,0.16)] text-[#f5a524] font-bold">
                {complaint.readableId}
              </span>
              <Badge label={complaint.category} />
              {complaint.upvoteCount > 0 && (
                <span className="text-xs font-mono text-[#f5a524] px-2 py-0.5 bg-[#f5a524]/10 rounded-sm">
                  ▲ {complaint.upvoteCount} Community Upvotes
                </span>
              )}
            </div>

            <Countdown targetDate={complaint.deadline} label="SLA Deadline" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-medium text-[#dfe7e0] tracking-tight">
              {complaint.title}
            </h1>
            <p className="text-sm text-[#dfe7e0]/90 mt-3 whitespace-pre-wrap leading-relaxed">
              {complaint.description}
            </p>
          </div>

          {/* Submitter Details (Visible to Warden) */}
          <div className="p-4 rounded-sm bg-[#05070a] border border-[rgba(223,231,224,0.12)] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="block uppercase text-[10px] text-[#9aa5a0] tracking-wider">Complainant Name</span>
              <span className="text-[#dfe7e0] font-medium text-sm">
                {complaint.submitter?.name || 'Resident Student'}
              </span>
            </div>
            <div>
              <span className="block uppercase text-[10px] text-[#9aa5a0] tracking-wider">Room / Block</span>
              <span className="text-[#dfe7e0] font-medium text-sm">
                {complaint.submitter?.roomNumber || 'Unassigned'}
              </span>
            </div>
            <div>
              <span className="block uppercase text-[10px] text-[#9aa5a0] tracking-wider">Student ID</span>
              <span className="text-[#dfe7e0] font-mono text-sm">
                {complaint.submitter?.studentId || 'N/A'}
              </span>
            </div>
          </div>

          {/* Photo Gallery with Lightbox */}
          {complaint.photos && complaint.photos.length > 0 && (
            <div>
              <span className="text-xs uppercase font-medium tracking-wider text-[#9aa5a0] block mb-2">
                Attached Evidence Photos ({complaint.photos.length})
              </span>
              <div className="flex flex-wrap gap-3">
                {complaint.photos.map((photo, idx) => (
                  <button
                    key={photo.id || idx}
                    type="button"
                    onClick={() => setSelectedPhoto(photo.url)}
                    className="relative group w-24 h-24 rounded-sm border border-[rgba(223,231,224,0.16)] bg-[#0a0e12] overflow-hidden focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524]"
                    aria-label={`Open photo ${idx + 1}`}
                  >
                    <img
                      src={photo.url}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-[#dfe7e0]">
                      Inspect
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Status Transition Action Card */}
        {allowedTransitions.length > 0 && (
          <Card className="p-6 sm:p-8 border-[#f5a524]/40 bg-[rgba(14,20,30,0.85)]">
            <h3 className="text-base font-medium text-[#dfe7e0] tracking-tight">
              Advance Complaint Workflow
            </h3>
            <p className="text-xs text-[#9aa5a0] mt-1 mb-4">
              Transition this ticket through the official remediation sequence. All transitions are logged permanently in the audit ledger.
            </p>

            {formError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-sm border border-[#ff5a5f]/40 bg-[#ff5a5f]/10 text-[#ff5a5f] text-xs flex items-start gap-2"
              >
                <span className="font-bold shrink-0">✕</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="flex flex-col gap-4">
              <Select
                label="Select Next Allowed Status"
                value={targetStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetStatus(e.target.value)}
                required
              >
                <option value="">-- Choose Status Transition --</option>
                {allowedTransitions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>

              {/* Mandatory Resolution Note when marking resolved */}
              {targetStatus === 'MARKED_RESOLVED' && (
                <Textarea
                  label="Mandatory Resolution Note (Min 10 characters)"
                  value={resolutionNote}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResolutionNote(e.target.value)}
                  placeholder="Detail exactly what repair was completed, which parts were replaced, or steps taken to resolve the issue..."
                  rows={4}
                  required
                  helperText="This note is displayed to students during the 24-hour confirmation voting window."
                />
              )}

              {/* Optional general note for other transitions */}
              {targetStatus && targetStatus !== 'MARKED_RESOLVED' && (
                <Textarea
                  label="Internal Action Note (Optional)"
                  value={transitionNote}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTransitionNote(e.target.value)}
                  placeholder="e.g. Electrician scheduled for 2:00 PM today..."
                  rows={2}
                />
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submittingStatus}
                  disabled={!targetStatus || submittingStatus}
                >
                  Confirm &amp; Update Status
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* 24-Hour Confirmation Window Progress (if MARKED_RESOLVED) */}
        {complaint.status === 'MARKED_RESOLVED' && (
          <Card className="p-6 border-[#f5a524]/40">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-xs font-semibold text-[#f5a524] uppercase tracking-wider">
                  24-Hour Student Confirmation Window Active
                </span>
                <p className="text-xs text-[#9aa5a0]">
                  The service deadline has stopped. Waiting for resident verification (3 Solved votes needed to close).
                </p>
              </div>

              {complaint.confirmationWindowEndsAt && (
                <Countdown targetDate={complaint.confirmationWindowEndsAt} label="Window Ends" />
              )}
            </div>

            <ConfirmationBar
              solvedCount={complaint.confirmationSummary?.solvedCount || 0}
              notSolvedCount={complaint.confirmationSummary?.notSolvedCount || 0}
              requiredVotes={complaint.confirmationSummary?.requiredVotes || 3}
            />
          </Card>
        )}

        {/* Audit & Lifecycle History Timeline */}
        <Card className="p-6 sm:p-8">
          <h3 className="text-base font-medium text-[#dfe7e0] tracking-tight mb-4 pb-2 border-b border-[rgba(223,231,224,0.08)]">
            Complete Audit &amp; Progression History
          </h3>

          <div className="flex flex-col gap-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-[rgba(223,231,224,0.12)]">
            {complaint.statusHistory && complaint.statusHistory.length > 0 ? (
              complaint.statusHistory.map((item, idx) => (
                <div key={item.id || idx} className="flex items-start gap-4 relative">
                  <div className="w-6 h-6 rounded-full bg-[#05070a] border border-[#f5a524] flex items-center justify-center text-[10px] text-[#f5a524] shrink-0 font-mono">
                    ●
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[#dfe7e0]">
                        Status: <strong className="text-[#f5a524]">{item.toStatus}</strong>
                      </span>
                      <span className="text-[11px] text-[#9aa5a0] font-mono">
                        {new Date(item.createdAt).toLocaleString()}
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
                Current status is {complaint.status}.
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Lightbox Dialog */}
      <Dialog
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        title="High-Resolution Photo Inspection"
        maxWidth="xl"
        actions={
          <Button variant="ghost" size="small" onClick={() => setSelectedPhoto(null)}>
            Close Viewer
          </Button>
        }
      >
        {selectedPhoto && (
          <div className="max-h-[75vh] flex items-center justify-center overflow-hidden">
            <img
              src={selectedPhoto}
              alt="Expanded preview"
              className="max-w-full max-h-[70vh] object-contain rounded-sm"
            />
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default WardenComplaintDetailPage;
