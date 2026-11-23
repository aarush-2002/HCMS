import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen z-10 flex flex-col justify-center items-center p-6 text-center">
      <div className="max-w-md w-full bg-[rgba(10,14,18,0.88)] border border-[rgba(223,231,224,0.16)] rounded-sm p-8 backdrop-blur-md shadow-2xl flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-[#ff5a5f]/10 border border-[#ff5a5f]/30 flex items-center justify-center text-[#ff5a5f] text-xl font-mono mb-4">
          403
        </div>

        <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight mb-2">
          Access Restricted
        </h1>
        <p className="text-xs text-[#9aa5a0] leading-relaxed mb-6">
          Your active role ({user?.role || 'Guest'}) does not have permission to access this resource. Wardens cannot submit student votes or ratings, and students cannot access operational queues.
        </p>

        <div className="flex flex-col gap-3 w-full">
          {user?.role === 'STUDENT' && (
            <Link to="/student" className="w-full">
              <Button variant="primary" fullWidth>
                Go to Student Portal
              </Button>
            </Link>
          )}
          {user?.role === 'WARDEN' && (
            <Link to="/warden" className="w-full">
              <Button variant="primary" fullWidth>
                Go to Warden Workspace
              </Button>
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="w-full">
              <Button variant="primary" fullWidth>
                Go to Admin Console
              </Button>
            </Link>
          )}
          <Link to="/" className="w-full">
            <Button variant="ghost" fullWidth>
              Return to Overview
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
