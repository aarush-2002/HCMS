import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export const ForgotPasswordPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { forgotPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please provide your institutional email or Student ID.');
      return;
    }

    setSubmitting(true);
    try {
      const msg = await forgotPassword(
        identifier.trim(),
        reason.trim() || 'User requested password reset from web portal'
      );
      setSuccessMessage(msg);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to submit password reset request. Please contact your hostel administrator.'
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
              ACCOUNT RECOVERY
            </span>
          </Link>
          <h1 className="text-xl font-medium tracking-tight text-[#dfe7e0]">
            Password Reset Request
          </h1>
          <p className="text-xs text-[#9aa5a0] mt-1">
            Accounts are managed by your hostel administrator.
          </p>
        </div>

        <Card padded={false} className="p-6 sm:p-8">
          {successMessage ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#6fcf97]/15 border border-[#6fcf97]/40 text-[#6fcf97] flex items-center justify-center text-xl font-bold mb-4">
                ✓
              </div>
              <h2 className="text-base font-medium text-[#dfe7e0] mb-2">
                Reset Request Submitted
              </h2>
              <p className="text-xs text-[#9aa5a0] leading-relaxed mb-6">
                {successMessage}
              </p>
              <div className="flex flex-col gap-2 w-full">
                <Link to="/student/login">
                  <Button variant="primary" fullWidth>
                    Return to Student Login
                  </Button>
                </Link>
                <Link to="/warden/login">
                  <Button variant="ghost" fullWidth>
                    Return to Warden Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="pb-4">
                <CardTitle>Request Reset</CardTitle>
                <CardDescription>
                  Enter your registered institutional email or Student ID. An administrative request will be queued for verification.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4">
                {errorMessage && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-sm border border-[#ff5a5f]/40 bg-[#ff5a5f]/10 text-[#ff5a5f] text-xs flex items-start gap-2"
                  >
                    <span className="font-bold shrink-0">✕</span>
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    label="Email or Student ID"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. aarav@hostel.edu or STU-B-302"
                    required
                    disabled={submitting}
                  />

                  <Textarea
                    label="Reason for Reset (Optional)"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Forgot password, locked out of room device..."
                    disabled={submitting}
                    helperText="Helps the administrator verify your identity quickly."
                  />

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      isLoading={submitting}
                    >
                      Submit Reset Request
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-[#9aa5a0]">
          <Link to="/" className="hover:text-[#dfe7e0] transition-colors">
            ← Return to HCMS Overview
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
