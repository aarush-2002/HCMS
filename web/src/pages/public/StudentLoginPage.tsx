import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export const StudentLoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginStudent } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Please enter your institutional email or Student ID.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await loginStudent(identifier.trim(), password);
      navigate('/student', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please verify your Student ID and password.'
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
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#f5a524]/10 text-[#f5a524] border border-[#f5a524]/30 font-medium">
              आवाज़
            </span>
          </Link>
          <h1 className="text-xl font-medium tracking-tight text-[#dfe7e0]">
            Student Portal Login
          </h1>
          <p className="text-xs text-[#9aa5a0] mt-1">
            Access your hostel complaints, community feed, and active votes
          </p>
        </div>

        {/* Login Form Card */}
        <Card padded={false} className="p-6 sm:p-8">
          <CardHeader className="pb-4">
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in with your administrator-issued credentials.
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
                label="Institutional Email or Student ID"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. aarav@hostel.edu or STU-B-302"
                required
                autoComplete="username"
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
                  Sign In as Student
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer links */}
        <div className="mt-6 text-center flex flex-col gap-2 text-xs text-[#9aa5a0]">
          <p>
            Warden or Administrator?{' '}
            <Link
              to="/warden/login"
              className="text-[#f5a524] hover:underline underline-offset-2 font-medium"
            >
              Sign in to Warden Workspace →
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

export default StudentLoginPage;
