import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreateComplaintSchema, ComplaintCategory, ComplaintPriority, QuotaStatus } from '@hmcs/shared';
import { createComplaint } from '../api/complaints';
import { fetchQuota } from '../api/quota';
import StudentHeader from '../components/layout/StudentHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import FileDrop from '../components/ui/FileDrop';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

export const NewComplaintPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('PLUMBING');
  const [priority, setPriority] = useState<ComplaintPriority>('NORMAL');
  const [photos, setPhotos] = useState<File[]>([]);

  // Validation & status
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Success state
  const [successData, setSuccessData] = useState<{
    id: string;
    readableId: string;
    priority: string;
    deadline: string;
  } | null>(null);

  useEffect(() => {
    fetchQuota()
      .then((data) => setQuota(data))
      .catch((err) => console.warn('Failed to load quota', err))
      .finally(() => setQuotaLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    // Client-side Zod Validation using shared schema
    const validationResult = CreateComplaintSchema.safeParse({
      title,
      description,
      category,
      priority,
    });

    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    // Check client quota ahead of time
    if (quota) {
      if (priority === 'NORMAL' && quota.normalLeftToday <= 0) {
        setServerError('Daily normal complaint quota exceeded. Resets at midnight.');
        return;
      }
      if (priority === 'EMERGENCY' && quota.emergencyLeftThisWeek <= 0) {
        setServerError('Weekly emergency complaint quota exceeded. Resets Monday.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('priority', priority);

      photos.forEach((photo) => {
        formData.append('photos', photo);
      });

      const res = await createComplaint(formData);
      setSuccessData({
        id: res.id,
        readableId: res.readableId,
        priority: res.priority,
        deadline: res.deadline,
      });
      showToast(`Complaint ${res.readableId} submitted successfully.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setServerError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <StudentHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Success Screen */}
        {successData ? (
          <Card className="text-center p-8 sm:p-12 border-[#6fcf97]/50 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-[#6fcf97]/15 border border-[#6fcf97]/40 text-[#6fcf97] flex items-center justify-center text-3xl font-mono mx-auto mb-6">
              ✓
            </div>

            <span className="text-xs font-mono uppercase tracking-widest text-[#6fcf97]">
              Submission Logged to Ledger
            </span>
            <h1 className="text-2xl sm:text-3xl font-light text-[#dfe7e0] tracking-tight mt-1 mb-2">
              Complaint Received
            </h1>

            <div className="inline-block my-4 p-4 rounded-sm bg-[#05070a] border border-[rgba(223,231,224,0.16)] font-mono">
              <span className="text-xs text-[#9aa5a0] block uppercase tracking-wider mb-1">
                Unique Tracking ID
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-[#f5a524]">
                {successData.readableId}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#9aa5a0] my-4">
              <div>
                <span className="block uppercase text-[10px] tracking-wider">Priority</span>
                <Badge priority={successData.priority as any} />
              </div>
              <div className="w-px h-8 bg-[rgba(223,231,224,0.1)]" />
              <div>
                <span className="block uppercase text-[10px] tracking-wider mb-1">SLA Resolution Target</span>
                <span className="text-[#dfe7e0] font-mono font-medium">
                  {new Date(successData.deadline).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#9aa5a0] max-w-md mx-auto my-6 leading-relaxed">
              Assigned wardens have been notified. Other students in your hostel can view and upvote this issue. If 10 students upvote, it will be automatically promoted to Emergency priority.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate(`/student/complaints/${successData.id}`)}
              >
                Track Timeline &amp; History
              </Button>
              <Button variant="ghost" onClick={() => navigate('/student')}>
                Return to Community Feed
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Page Header */}
            <div>
              <Link
                to="/student"
                className="text-xs text-[#9aa5a0] hover:text-[#f5a524] transition-colors"
              >
                ← Back to Community Feed
              </Link>
              <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#dfe7e0] mt-2">
                Report a Hostel Issue
              </h1>
              <p className="text-xs text-[#9aa5a0] mt-1">
                Submit an authenticated complaint to your assigned hostel warden.
              </p>
            </div>

            {/* Rules Explained BEFORE Submitting (Prompt Requirement) */}
            <div className="p-5 bg-[rgba(10,14,18,0.85)] border border-[rgba(245,165,36,0.3)] rounded-sm flex flex-col gap-3 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#f5a524]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#f5a524]">
                  Hostel Complaint Policy &amp; SLA Rules
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#dfe7e0]/90 pt-1">
                <div className="p-3 bg-[rgba(5,7,10,0.6)] rounded-sm border border-[rgba(223,231,224,0.08)]">
                  <span className="font-semibold text-[#7fb4c9] block mb-1">Quota Enforcement</span>
                  <p className="text-[#9aa5a0]">
                    1 Normal complaint per calendar day. 1 Emergency complaint per week. Evaluated in hostel time zone.
                  </p>
                </div>

                <div className="p-3 bg-[rgba(5,7,10,0.6)] rounded-sm border border-[rgba(223,231,224,0.08)]">
                  <span className="font-semibold text-[#f5a524] block mb-1">Escalation &amp; Deadlines</span>
                  <p className="text-[#9aa5a0]">
                    Normal issues have a 72h SLA. Emergency issues have a 24h SLA. Reaching 10 upvotes auto-promotes normal issues to emergency.
                  </p>
                </div>

                <div className="p-3 bg-[rgba(5,7,10,0.6)] rounded-sm border border-[rgba(223,231,224,0.08)]">
                  <span className="font-semibold text-[#6fcf97] block mb-1">Student Confirmation</span>
                  <p className="text-[#9aa5a0]">
                    Wardens cannot close complaints unilaterally. Once marked resolved, 3 student &ldquo;Solved&rdquo; votes confirm the fix.
                  </p>
                </div>
              </div>
            </div>

            {/* Server Error Alert */}
            {serverError && (
              <div
                role="alert"
                className="p-4 rounded-sm border border-[#ff5a5f]/40 bg-[#ff5a5f]/10 text-[#ff5a5f] text-xs flex items-start gap-2"
              >
                <span className="font-bold shrink-0">✕</span>
                <span>{serverError}</span>
              </div>
            )}

            {/* Submission Form */}
            <Card padded={false} className="p-6 sm:p-8">
              <CardHeader className="pb-4">
                <CardTitle>Complaint Details</CardTitle>
                <CardDescription>
                  Provide a clear summary so facilities staff can inspect and repair without delay.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {/* Category & Priority Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                      error={fieldErrors.category}
                      disabled={submitting}
                    >
                      <option value="PLUMBING">Plumbing (Water, leaks, drainage)</option>
                      <option value="ELECTRICAL">Electrical (Lights, fan, sockets)</option>
                      <option value="CLEANLINESS">Cleanliness (Corridors, washrooms)</option>
                      <option value="FURNITURE">Furniture (Bed, table, chair, lock)</option>
                      <option value="INTERNET">Internet (Wi-Fi, LAN port)</option>
                      <option value="OTHER">Other Facility Issue</option>
                    </Select>

                    <Select
                      label={`Priority (${
                        quota
                          ? priority === 'NORMAL'
                            ? `${quota.normalLeftToday} normal left today`
                            : `${quota.emergencyLeftThisWeek} emergency left this week`
                          : 'Checking quota...'
                      })`}
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                      error={fieldErrors.priority}
                      disabled={submitting}
                    >
                      <option value="NORMAL">Normal Priority (72-Hour Resolution SLA)</option>
                      <option value="EMERGENCY">Emergency Priority (24-Hour Resolution SLA)</option>
                    </Select>
                  </div>

                  {/* Title */}
                  <Input
                    label="Complaint Title (3–80 characters)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Geyser tripping circuit breaker on 3rd floor washroom"
                    error={fieldErrors.title}
                    disabled={submitting}
                    maxLength={80}
                  />

                  {/* Description */}
                  <Textarea
                    label="Detailed Description (10–600 characters)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the exact location, symptoms, when the issue started, and any immediate hazards..."
                    rows={5}
                    error={fieldErrors.description}
                    disabled={submitting}
                    showCount
                    maxLength={600}
                  />

                  {/* Photo Dropzone */}
                  <FileDrop
                    files={photos}
                    onChange={setPhotos}
                    disabled={submitting}
                  />

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(223,231,224,0.1)]">
                    <Link to="/student">
                      <Button variant="ghost" type="button" disabled={submitting}>
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={submitting}
                      disabled={submitting || quotaLoading}
                    >
                      Submit Complaint
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default NewComplaintPage;
