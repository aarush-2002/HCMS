import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Hostel,
  Policy,
  Rating,
  AuditEvent,
  Complaint,
} from '@hmcs/shared';
import {
  fetchReports,
  fetchUsers,
  createUser,
  updateUserStatus,
  fetchHostels,
  fetchPolicy,
  updatePolicy,
  fetchAdminComplaints,
  reclassifyComplaint,
  rejectComplaint,
  reassignComplaint,
  fetchRatings,
  hideRating,
  unhideRating,
  fetchAuditLogs,
  AdminReports,
} from '../api/admin';
import AdminHeader from '../components/layout/AdminHeader';
import Card, { CardTitle, CardDescription } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Dialog from '../components/ui/Dialog';
import Skeleton from '../components/ui/Skeleton';
import StarRating from '../components/ui/StarRating';
import { useToast } from '../components/ui/Toast';

export const AdminDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('reports');
  const [loading, setLoading] = useState<boolean>(true);

  // Data states
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

  // Modals & form states
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('password123');
  const [newUserRole, setNewUserRole] = useState('STUDENT');
  const [newUserHostelId, setNewUserHostelId] = useState('');
  const [newUserRoom, setNewUserRoom] = useState('');
  const [newUserStudentId, setNewUserStudentId] = useState('');

  // Policy form state
  const [policyForm, setPolicyForm] = useState<Partial<Policy>>({});
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Exception modal state
  const [exceptionComplaint, setExceptionComplaint] = useState<Complaint | null>(null);
  const [exceptionAction, setExceptionAction] = useState<'reclassify' | 'reject' | 'reassign' | null>(null);
  const [reclassifyCat, setReclassifyCat] = useState('');
  const [reclassifyPri, setReclassifyPri] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [reassignWardenId, setReassignWardenId] = useState('');
  const [submittingException, setSubmittingException] = useState(false);

  // Ratings moderation state
  const [hideReasonDialog, setHideReasonDialog] = useState<Rating | null>(null);
  const [hideReasonText, setHideReasonText] = useState('');

  // Initial load
  const loadReports = useCallback(async () => {
    try {
      const data = await fetchReports();
      setReports(data);
    } catch (err) {
      console.warn('Failed to load reports', err);
    }
  }, []);

  const loadUsersAndHostels = useCallback(async () => {
    try {
      const [uRes, hRes] = await Promise.all([fetchUsers(), fetchHostels()]);
      setUsers(uRes.users);
      setHostels(hRes.hostels);
      if (hRes.hostels.length > 0 && !newUserHostelId) {
        setNewUserHostelId(hRes.hostels[0].id);
      }
    } catch (err) {
      console.warn('Failed to load users/hostels', err);
    }
  }, [newUserHostelId]);

  const loadPolicy = useCallback(async () => {
    try {
      const pRes = await fetchPolicy();
      setPolicy(pRes.policy);
      setPolicyForm(pRes.policy);
    } catch (err) {
      console.warn('Failed to load policy', err);
    }
  }, []);

  const loadComplaints = useCallback(async () => {
    try {
      const cRes = await fetchAdminComplaints();
      setComplaints(cRes.complaints);
    } catch (err) {
      console.warn('Failed to load complaints', err);
    }
  }, []);

  const loadRatings = useCallback(async () => {
    try {
      const rRes = await fetchRatings();
      setRatings(rRes.ratings);
    } catch (err) {
      console.warn('Failed to load ratings', err);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const aRes = await fetchAuditLogs({ limit: 50 });
      setAuditLogs(aRes.auditLogs);
    } catch (err) {
      console.warn('Failed to load audit logs', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadReports(),
      loadUsersAndHostels(),
      loadPolicy(),
      loadComplaints(),
      loadRatings(),
      loadAudit(),
    ]).finally(() => setLoading(false));
  }, [loadReports, loadUsersAndHostels, loadPolicy, loadComplaints, loadRatings, loadAudit]);

  // User Actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser({
        email: newUserEmail.trim(),
        name: newUserName.trim(),
        password: newUserPassword,
        role: newUserRole,
        hostelId: newUserHostelId,
        roomNumber: newUserRoom.trim() || undefined,
        studentId: newUserStudentId.trim() || undefined,
      });
      showToast(`User ${newUserName} created successfully.`, 'success');
      setIsCreateUserOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      loadUsersAndHostels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      showToast(msg, 'error');
    }
  };

  const handleToggleUserActive = async (u: User) => {
    try {
      const nextActive = !u.isActive;
      await updateUserStatus(u.id, nextActive);
      showToast(`User ${u.name} ${nextActive ? 'activated' : 'deactivated'}.`, 'info');
      loadUsersAndHostels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast(msg, 'error');
    }
  };

  // Policy Save
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      const updated = await updatePolicy(policyForm);
      setPolicy(updated.policy);
      showToast('Policy parameters saved successfully across all hostels.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save policy';
      showToast(msg, 'error');
    } finally {
      setSavingPolicy(false);
    }
  };

  // Exception Execution
  const handleExecuteException = async () => {
    if (!exceptionComplaint || !exceptionAction) return;
    setSubmittingException(true);
    try {
      if (exceptionAction === 'reclassify') {
        await reclassifyComplaint(exceptionComplaint.id, {
          category: reclassifyCat || undefined,
          priority: reclassifyPri || undefined,
          reason: exceptionReason.trim(),
        });
        showToast(`Complaint ${exceptionComplaint.readableId} reclassified with SLA restarted.`, 'success');
      } else if (exceptionAction === 'reject') {
        await rejectComplaint(exceptionComplaint.id, exceptionReason.trim());
        showToast(`Complaint ${exceptionComplaint.readableId} rejected.`, 'warning');
      } else if (exceptionAction === 'reassign') {
        await reassignComplaint(exceptionComplaint.id, reassignWardenId);
        showToast(`Complaint ${exceptionComplaint.readableId} reassigned.`, 'success');
      }

      setExceptionComplaint(null);
      setExceptionAction(null);
      setExceptionReason('');
      loadComplaints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process exception';
      showToast(msg, 'error');
    } finally {
      setSubmittingException(false);
    }
  };

  // Rating Moderation
  const handleHideRating = async () => {
    if (!hideReasonDialog) return;
    try {
      await hideRating(hideReasonDialog.id, hideReasonText.trim());
      showToast('Rating flagged and hidden from score calculation.', 'info');
      setHideReasonDialog(null);
      setHideReasonText('');
      loadRatings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to hide rating';
      showToast(msg, 'error');
    }
  };

  const handleUnhideRating = async (r: Rating) => {
    try {
      await unhideRating(r.id);
      showToast('Rating restored to score calculation.', 'success');
      loadRatings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unhide rating';
      showToast(msg, 'error');
    }
  };

  const wardensList = users.filter((u) => u.role === 'WARDEN');

  return (
    <div className="relative min-h-screen z-10 flex flex-col bg-transparent">
      <AdminHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton height="60px" />
            <Skeleton height="200px" />
            <Skeleton height="300px" />
          </div>
        ) : (
          <>
            {/* TAB 1: REPORTS & PRD SUCCESS MEASURES */}
            {activeTab === 'reports' && reports && (
              <div className="flex flex-col gap-8">
                <div>
                  <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
                    Operational Analytics &amp; PRD Success Measures
                  </h1>
                  <p className="text-xs text-[#9aa5a0] mt-1">
                    System-wide key performance indicators, SLA resolution rates, and audit health.
                  </p>
                </div>

                {/* 6 Key PRD Measure Tiles */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card padded={false} className="p-4 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#7fb4c9] tracking-wider">Total Volume</span>
                    <span className="text-2xl font-mono text-[#dfe7e0] block mt-1">{reports.totalComplaints}</span>
                    <span className="text-[10px] text-[#9aa5a0]">tickets lodged</span>
                  </Card>

                  <Card padded={false} className="p-4 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#6fcf97] tracking-wider">Resolved</span>
                    <span className="text-2xl font-mono text-[#6fcf97] block mt-1">{reports.resolvedComplaints}</span>
                    <span className="text-[10px] text-[#9aa5a0]">student verified</span>
                  </Card>

                  <Card padded={false} className="p-4 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#f5a524] tracking-wider">SLA Compliance</span>
                    <span className="text-2xl font-mono text-[#f5a524] block mt-1">{reports.slaCompliancePercentage}%</span>
                    <span className="text-[10px] text-[#9aa5a0]">resolved in SLA</span>
                  </Card>

                  <Card padded={false} className="p-4 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#7fb4c9] tracking-wider">Median Hours</span>
                    <span className="text-2xl font-mono text-[#dfe7e0] block mt-1">{reports.medianResolutionHours}h</span>
                    <span className="text-[10px] text-[#9aa5a0]">to resolution</span>
                  </Card>

                  <Card padded={false} className="p-4 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#ff5a5f] tracking-wider">Re-open Rate</span>
                    <span className="text-2xl font-mono text-[#ff5a5f] block mt-1">{reports.reopenedRatePercentage}%</span>
                    <span className="text-[10px] text-[#9aa5a0]">3 student &apos;Not solved&apos;</span>
                  </Card>

                  <Card padded={false} className="p-4 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#f5a524] tracking-wider">Avg Star Rating</span>
                    <span className="text-2xl font-mono text-[#f5a524] block mt-1">{reports.averageStudentRating.toFixed(2)}</span>
                    <span className="text-[10px] text-[#9aa5a0]">/ 3.0 stars</span>
                  </Card>
                </div>

                {/* Accessible Visual Chart & Table Summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Breakdown */}
                  <Card className="p-6">
                    <CardTitle>Volume by Category (With Accessible Data Table)</CardTitle>
                    <CardDescription className="mt-1">
                      Visual comparison and accessible summary of complaint categories.
                    </CardDescription>

                    <div className="flex flex-col gap-3 mt-4">
                      {(reports.byCategory || []).map((cat: { category: string; count: number; resolved: number }) => {
                        const pct = reports.totalComplaints > 0 ? (cat.count / reports.totalComplaints) * 100 : 0;
                        return (
                          <div key={cat.category} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-[#dfe7e0] font-medium">{cat.category}</span>
                              <span className="text-[#9aa5a0] font-mono">{cat.count} tickets ({Math.round(pct)}%)</span>
                            </div>
                            <div className="w-full h-2 bg-[rgba(223,231,224,0.08)] rounded-sm overflow-hidden">
                              <div className="h-full bg-[#f5a524]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Hostel Performance Breakdown */}
                  <Card className="p-6">
                    <CardTitle>Hostel Residence SLA Breakdown</CardTitle>
                    <CardDescription className="mt-1">
                      Tracking resolution adherence and overdue tickets by hostel residence hall.
                    </CardDescription>

                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left text-xs text-[#dfe7e0]">
                        <thead>
                          <tr className="border-b border-[rgba(223,231,224,0.12)] text-[#9aa5a0]">
                            <th className="py-2">Hostel</th>
                            <th className="py-2">Total</th>
                            <th className="py-2">Resolved</th>
                            <th className="py-2">Overdue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(223,231,224,0.06)] font-mono">
                          {(reports.byHostel || []).map((h: { hostelName: string; total: number; resolved: number; overdue: number }) => (
                            <tr key={h.hostelName}>
                              <td className="py-2.5 font-sans font-medium">{h.hostelName}</td>
                              <td className="py-2.5 text-[#dfe7e0]">{h.total}</td>
                              <td className="py-2.5 text-[#6fcf97]">{h.resolved}</td>
                              <td className="py-2.5 text-[#ff5a5f]">{h.overdue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* TAB 2: USERS & ROLES */}
            {activeTab === 'users' && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
                      User Management &amp; Role Control
                    </h1>
                    <p className="text-xs text-[#9aa5a0] mt-1">
                      Accounts are created and administered without public signup as specified in BRIEF.md.
                    </p>
                  </div>
                  <Button variant="primary" size="small" onClick={() => setIsCreateUserOpen(true)}>
                    + Create User Account
                  </Button>
                </div>

                <Card padded={false} className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#dfe7e0]">
                    <thead className="bg-[#05070a] border-b border-[rgba(223,231,224,0.12)] text-[#9aa5a0] uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5">Name / Email</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5">Hostel</th>
                        <th className="p-3.5">Room / ID</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(223,231,224,0.06)]">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-[rgba(223,231,224,0.02)]">
                          <td className="p-3.5">
                            <span className="font-medium block text-sm">{u.name}</span>
                            <span className="text-[#9aa5a0] text-xs font-mono">{u.email}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-sm text-[11px] font-mono bg-[rgba(223,231,224,0.08)] border border-[rgba(223,231,224,0.12)]">
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#9aa5a0]">{u.hostel?.name || 'Unassigned'}</td>
                          <td className="p-3.5 font-mono text-[#9aa5a0]">
                            {u.roomNumber ? `Rm ${u.roomNumber}` : ''} {u.studentId ? `(${u.studentId})` : ''}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                                u.isActive !== false ? 'bg-[#6fcf97]/20 text-[#6fcf97]' : 'bg-[#ff5a5f]/20 text-[#ff5a5f]'
                              }`}
                            >
                              {u.isActive !== false ? 'ACTIVE' : 'DEACTIVATED'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() => handleToggleUserActive(u)}
                            >
                              {u.isActive !== false ? 'Deactivate' : 'Activate'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}

            {/* TAB 3: HOSTELS & WARDEN ASSIGNMENTS */}
            {activeTab === 'hostels' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
                    Hostel Residences &amp; Warden Assignments
                  </h1>
                  <p className="text-xs text-[#9aa5a0] mt-1">
                    Manage hostel buildings, timezones, and warden scope mapping.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {hostels.map((h) => (
                    <Card key={h.id} className="p-6 flex flex-col gap-4">
                      <div className="flex items-start justify-between pb-3 border-b border-[rgba(223,231,224,0.08)]">
                        <div>
                          <span className="font-mono text-xs text-[#f5a524]">{h.code}</span>
                          <h3 className="text-lg font-medium text-[#dfe7e0] mt-0.5">{h.name}</h3>
                          <span className="text-xs text-[#9aa5a0]">Timezone: {h.timezone}</span>
                        </div>
                      </div>

                      <div className="text-xs text-[#9aa5a0]">
                        <span className="uppercase text-[10px] font-bold tracking-wider block mb-2 text-[#dfe7e0]">
                          Assigned Wardens:
                        </span>
                        {users.filter((u) => u.wardenAssignments?.some((wa) => wa.hostelId === h.id)).length === 0 ? (
                          <p className="italic">No wardens currently assigned.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {users
                              .filter((u) => u.wardenAssignments?.some((wa) => wa.hostelId === h.id))
                              .map((w) => (
                                <div key={w.id} className="flex items-center justify-between p-2 bg-[#05070a] rounded-sm border border-[rgba(223,231,224,0.08)]">
                                  <span className="text-[#dfe7e0] font-medium">{w.name} ({w.email})</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: POLICY SETTINGS FORM */}
            {activeTab === 'policy' && policy && (
              <div className="flex flex-col gap-6 max-w-3xl">
                <div>
                  <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
                    System Policy Configuration
                  </h1>
                  <p className="text-xs text-[#9aa5a0] mt-1">
                    Configure quotas, SLAs, escalation thresholds, and confirmation parameters.
                  </p>
                </div>

                <Card className="p-6 sm:p-8">
                  <form onSubmit={handleSavePolicy} className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Normal Deadline (Hours)"
                        type="number"
                        value={policyForm.normalDeadlineHours || 72}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPolicyForm({ ...policyForm, normalDeadlineHours: parseInt(e.target.value, 10) })
                        }
                        helperText="Default: 72 hours"
                      />
                      <Input
                        label="Emergency Deadline (Hours)"
                        type="number"
                        value={policyForm.emergencyDeadlineHours || 24}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPolicyForm({ ...policyForm, emergencyDeadlineHours: parseInt(e.target.value, 10) })
                        }
                        helperText="Default: 24 hours"
                      />
                      <Input
                        label="Upvotes to Auto-Escalate"
                        type="number"
                        value={policyForm.upvotesToEscalate || 10}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPolicyForm({ ...policyForm, upvotesToEscalate: parseInt(e.target.value, 10) })
                        }
                        helperText="Default: 10 eligible upvotes"
                      />
                      <Input
                        label="Confirmations Needed to Resolve"
                        type="number"
                        value={policyForm.confirmationsNeeded || 3}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPolicyForm({ ...policyForm, confirmationsNeeded: parseInt(e.target.value, 10) })
                        }
                        helperText="Default: 3 'Solved' votes"
                      />
                      <Input
                        label="Confirmation Window (Hours)"
                        type="number"
                        value={policyForm.confirmationWindowHours || 24}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPolicyForm({ ...policyForm, confirmationWindowHours: parseInt(e.target.value, 10) })
                        }
                        helperText="Default: 24 hours"
                      />
                      <Input
                        label="Daily Normal Limit (Per Student)"
                        type="number"
                        value={policyForm.normalDailyLimit || 1}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPolicyForm({ ...policyForm, normalDailyLimit: parseInt(e.target.value, 10) })
                        }
                        helperText="Default: 1 per calendar day"
                      />
                      <Input
                        label="Weekly Emergency Limit"
                        type="number"
                        value={policyForm.emergencyWeeklyLimit || 1}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPolicyForm({ ...policyForm, emergencyWeeklyLimit: parseInt(e.target.value, 10) })
                        }
                        helperText="Default: 1 per calendar week (Monday)"
                      />
                      <Input
                        label="System Timezone"
                        type="text"
                        value={policyForm.timezone || 'Asia/Kolkata'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPolicyForm({ ...policyForm, timezone: e.target.value })}
                        helperText="Default: Asia/Kolkata"
                      />
                    </div>

                    <div className="pt-4 border-t border-[rgba(223,231,224,0.1)] flex justify-end">
                      <Button type="submit" variant="primary" isLoading={savingPolicy}>
                        Save Policy Parameters
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            )}

            {/* TAB 5: COMPLAINT AUDIT & EXCEPTION HANDLING */}
            {activeTab === 'complaints' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
                    Complaint Exceptions &amp; Administrative Overrides
                  </h1>
                  <p className="text-xs text-[#9aa5a0] mt-1">
                    Reclassify priority/category (restarting SLA), reject invalid/spam complaints, or reassign responsible wardens.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  {complaints.map((c) => (
                    <Card key={c.id} padded={false} className="p-5 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-[#05070a] text-[#dfe7e0] font-bold border border-[rgba(223,231,224,0.16)]">
                            {c.readableId}
                          </span>
                          <Badge label={c.category} />
                          <Badge priority={c.priority} />
                          <Badge status={c.status} />
                        </div>
                        <span className="text-xs text-[#9aa5a0] font-mono">
                          Hostel: {c.hostel?.name || c.hostelId}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-medium text-[#dfe7e0]">{c.title}</h3>
                          <p className="text-xs text-[#9aa5a0] mt-0.5 line-clamp-1">{c.description}</p>
                        </div>

                        {/* Admin Action Triggers */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => {
                              setExceptionComplaint(c);
                              setExceptionAction('reclassify');
                              setReclassifyCat(c.category);
                              setReclassifyPri(c.priority);
                            }}
                          >
                            Reclassify
                          </Button>
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => {
                              setExceptionComplaint(c);
                              setExceptionAction('reassign');
                              if (wardensList.length > 0) setReassignWardenId(wardensList[0].id);
                            }}
                          >
                            Reassign
                          </Button>
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => {
                              setExceptionComplaint(c);
                              setExceptionAction('reject');
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: RATINGS MODERATION & ABUSE CONTROL */}
            {activeTab === 'ratings' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
                    Student Rating Moderation &amp; Abuse Control
                  </h1>
                  <p className="text-xs text-[#9aa5a0] mt-1">
                    Admins can flag and hide abusive or fraudulent ratings. Hidden ratings are excluded from the warden&apos;s score while preserved in audit.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ratings.map((r) => (
                    <Card
                      key={r.id}
                      className={`p-5 flex flex-col justify-between ${
                        r.isFlagged ? 'border-[#ff5a5f]/40 bg-[#ff5a5f]/5' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <StarRating value={r.stars} readOnly size="small" />
                          <span
                            className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                              r.isFlagged ? 'bg-[#ff5a5f]/20 text-[#ff5a5f]' : 'bg-[#6fcf97]/20 text-[#6fcf97]'
                            }`}
                          >
                            {r.isFlagged ? 'FLAGGED (HIDDEN)' : 'INCLUDED IN SCORE'}
                          </span>
                        </div>

                        {r.comment && (
                          <p className="text-xs text-[#dfe7e0] italic mt-2">
                            &ldquo;{r.comment}&rdquo;
                          </p>
                        )}

                        {r.isFlagged && r.flagReason && (
                          <p className="text-[11px] text-[#ff5a5f] mt-2 font-mono">
                            Hide Reason: {r.flagReason}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[rgba(223,231,224,0.08)] flex items-center justify-between text-xs text-[#9aa5a0]">
                        <span>Logged: {new Date(r.createdAt).toLocaleDateString()}</span>
                        {r.isFlagged ? (
                          <Button variant="ghost" size="small" onClick={() => handleUnhideRating(r)}>
                            Restore to Score
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => {
                              setHideReasonDialog(r);
                              setHideReasonText('');
                            }}
                          >
                            Flag as Abusive
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: AUDIT LEDGER */}
            {activeTab === 'audit' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight">
                    Immutable Audit Ledger
                  </h1>
                  <p className="text-xs text-[#9aa5a0] mt-1">
                    Every vote, transition, reclassification, quota change, and penalty recorded with IP and timestamp.
                  </p>
                </div>

                <Card padded={false} className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#dfe7e0]">
                    <thead className="bg-[#05070a] border-b border-[rgba(223,231,224,0.12)] text-[#9aa5a0] uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5">Timestamp</th>
                        <th className="p-3.5">Action</th>
                        <th className="p-3.5">Entity</th>
                        <th className="p-3.5">Actor</th>
                        <th className="p-3.5">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(223,231,224,0.06)] font-mono text-[11px]">
                      {(auditLogs || []).map((log) => (
                        <tr key={log.id} className="hover:bg-[rgba(223,231,224,0.02)]">
                          <td className="p-3.5 text-[#9aa5a0]">
                            {new Date(log.timestamp).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })}
                          </td>
                          <td className="p-3.5 font-bold text-[#f5a524]">{log.action}</td>
                          <td className="p-3.5 text-[#dfe7e0]">
                            {log.entityType} ({log.entityId.substring(0, 8)}...)
                          </td>
                          <td className="p-3.5 text-[#9aa5a0] font-sans">
                            {log.actor?.name || 'System Engine'}
                          </td>
                          <td className="p-3.5 text-[#9aa5a0]">{log.ipAddress || 'Internal'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </>
        )}
      </main>

      {/* CREATE USER DIALOG */}
      <Dialog
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        title="Create Managed User Account"
        description="Creates student or warden credentials without public registration."
        actions={
          <>
            <Button variant="ghost" size="small" onClick={() => setIsCreateUserOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="small" onClick={handleCreateUser}>
              Create User
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Full Name"
            value={newUserName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserName(e.target.value)}
            placeholder="e.g. Rahul Verma"
            required
          />
          <Input
            label="Institutional Email"
            type="email"
            value={newUserEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserEmail(e.target.value)}
            placeholder="e.g. rahul@hostel.edu"
            required
          />
          <Input
            label="Initial Password"
            type="password"
            value={newUserPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserPassword(e.target.value)}
            required
          />
          <Select
            label="Account Role"
            value={newUserRole}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUserRole(e.target.value)}
          >
            <option value="STUDENT">Student</option>
            <option value="WARDEN">Warden</option>
            <option value="ADMIN">Administrator</option>
          </Select>
          <Select
            label="Hostel Residence"
            value={newUserHostelId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUserHostelId(e.target.value)}
          >
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.code})
              </option>
            ))}
          </Select>
          {newUserRole === 'STUDENT' && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Student ID"
                value={newUserStudentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserStudentId(e.target.value)}
                placeholder="STU-B-101"
              />
              <Input
                label="Room Number"
                value={newUserRoom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserRoom(e.target.value)}
                placeholder="B-101"
              />
            </div>
          )}
        </div>
      </Dialog>

      {/* EXCEPTION HANDLING MODAL */}
      <Dialog
        isOpen={!!exceptionAction && !!exceptionComplaint}
        onClose={() => {
          setExceptionAction(null);
          setExceptionComplaint(null);
        }}
        title={`Administrative Action: ${exceptionAction?.toUpperCase()}`}
        description={`Modifying ticket ${exceptionComplaint?.readableId}: ${exceptionComplaint?.title}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                setExceptionAction(null);
                setExceptionComplaint(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={exceptionAction === 'reject' ? 'danger' : 'primary'}
              size="small"
              isLoading={submittingException}
              onClick={handleExecuteException}
            >
              Confirm Exception
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-xs">
          {exceptionAction === 'reclassify' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Category"
                  value={reclassifyCat}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReclassifyCat(e.target.value)}
                >
                  <option value="PLUMBING">Plumbing</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="CLEANLINESS">Cleanliness</option>
                  <option value="FURNITURE">Furniture</option>
                  <option value="INTERNET">Internet</option>
                  <option value="OTHER">Other</option>
                </Select>
                <Select
                  label="Priority"
                  value={reclassifyPri}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReclassifyPri(e.target.value)}
                >
                  <option value="NORMAL">Normal (72h SLA)</option>
                  <option value="EMERGENCY">Emergency (24h SLA)</option>
                </Select>
              </div>
              <p className="text-[11px] text-[#f5a524]">
                Note: Reclassifying restarts the resolution SLA deadline to now + configured duration.
              </p>
            </>
          )}

          {exceptionAction === 'reassign' && (
            <Select
              label="Assign to Warden"
              value={reassignWardenId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReassignWardenId(e.target.value)}
            >
              {wardensList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.email})
                </option>
              ))}
            </Select>
          )}

          <Textarea
            label="Mandatory Reason for Override"
            value={exceptionReason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExceptionReason(e.target.value)}
            placeholder="Explain why this administrative exception is necessary..."
            rows={3}
            required
          />
        </div>
      </Dialog>

      {/* HIDE RATING DIALOG */}
      <Dialog
        isOpen={!!hideReasonDialog}
        onClose={() => setHideReasonDialog(null)}
        title="Hide Rating from Scoring"
        description="Provide a justification to exclude this rating from the warden's average."
        actions={
          <>
            <Button variant="ghost" size="small" onClick={() => setHideReasonDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="small" onClick={handleHideRating}>
              Hide Rating
            </Button>
          </>
        }
      >
        <Textarea
          label="Abuse / Invalidation Reason"
          value={hideReasonText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHideReasonText(e.target.value)}
          placeholder="e.g. Abusive language, verified mistaken complaint submission..."
          rows={3}
          required
        />
      </Dialog>
    </div>
  );
};

export default AdminDashboardPage;
