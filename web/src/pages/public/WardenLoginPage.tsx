import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export const WardenLoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginWarden } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Please enter your staff institutional email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await loginWarden(identifier.trim(), password);
      if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/warden', { replace: true });
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Invalid credentials or unauthorized role access.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen z-10 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group mb-3">
            <span className="font-bold text-2xl tracking-tight text-[#dfe7e0] group-hover:text-[#f5a524] transition-colors">
              HCMS
            </span>
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#7fb4c9]/10 text-[#7fb4c9] border border-[#7fb4c9]/30 font-medium">
              OPERATIONS
            </span>
          </Link>
          <h1 className="text-xl font-medium tracking-tight text-[#dfe7e0]">
            Warden &amp; Administration Portal
          </h1>
          <p className="text-xs text-[#9aa5a0] mt-1">
            Manage complaint queues, resolution workflows, and SLAs
          </p>
        </div>

        {/* Login Form Card */}
        <Card padded={false} className="p-6 sm:p-8">
          <CardHeader className="pb-4">
            <CardTitle>Staff Authentication</CardTitle>
            <CardDescription>
              Sign in with your verified warden or administrator email.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {errorMsg && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-sm border border-[#ff5a5f]/40 bg-[#ff5a5f]/10 text-[#ff5a5f] text-xs flex items-start gap-2"
              >
                <span className="font-bold shrink-0">✕</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Staff Email Address"
                type="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. warden.sharma@hostel.edu"
                required
                autoComplete="email"
                disabled={submitting}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                required
                autoComplete="current-password"
                disabled={submitting}
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <Link
                  to="/forgot-password"
                  className="text-[#9aa5a0] hover:text-[#f5a524] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={submitting}
                >
                  Sign In to Workspace
                </Button>
              </div>

              <div className="mt-4 p-3 rounded-sm border border-[#7fb4c9]/20 bg-[#7fb4c9]/5 text-xs">
                <div className="flex items-center justify-between font-medium text-[#7fb4c9] mb-1">
                  <span>💡 Quick Demo Access</span>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIdentifier('warden.singh@hostel.edu');
                        setPassword('password123');
                      }}
                      className="underline hover:text-[#b4dcf0]"
                    >
                      Fill Warden
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIdentifier('admin@hostel.edu');
                        setPassword('password123');
                      }}
                      className="underline hover:text-[#b4dcf0]"
                    >
                      Fill Admin
                    </button>
                  </div>
                </div>
                <p className="text-[#9aa5a0] text-[11px]">
                  Warden: <code className="text-[#dfe7e0]">warden.singh@hostel.edu</code> | Admin: <code className="text-[#dfe7e0]">admin@hostel.edu</code> (Pass: <code className="text-[#dfe7e0]">password123</code>)
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer links */}
        <div className="mt-6 text-center flex flex-col gap-2 text-xs text-[#9aa5a0]">
          <p>
            Resident student?{' '}
            <Link
              to="/student/login"
              className="text-[#f5a524] hover:underline underline-offset-2 font-medium"
            >
              Sign in to Student Portal →
            </Link>
          </p>
          <p>
            <Link to="/" className="hover:text-[#dfe7e0] transition-colors">
              ← Return to HCMS Overview
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WardenLoginPage;
