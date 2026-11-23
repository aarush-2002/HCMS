import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="relative min-h-screen z-10 flex flex-col justify-center items-center p-6 text-center">
      <div className="max-w-md w-full bg-[rgba(10,14,18,0.88)] border border-[rgba(223,231,224,0.16)] rounded-sm p-8 backdrop-blur-md shadow-2xl flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-[#f5a524]/10 border border-[#f5a524]/30 flex items-center justify-center text-[#f5a524] text-xl font-mono mb-4">
          404
        </div>

        <h1 className="text-2xl font-light text-[#dfe7e0] tracking-tight mb-2">
          Room Not Found
        </h1>
        <p className="text-xs text-[#9aa5a0] leading-relaxed mb-6">
          The requested corridor or ticket address does not exist within the HCMS network. It may have been archived or moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link to="/" className="w-full">
            <Button variant="primary" fullWidth>
              Return to Overview
            </Button>
          </Link>
          <Link to="/student/login" className="w-full">
            <Button variant="ghost" fullWidth>
              Student Portal
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
