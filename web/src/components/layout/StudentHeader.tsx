import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import Button from '../ui/Button';

export const StudentHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: '/student', label: 'Community Feed' },
    { to: '/student/my-complaints', label: 'My Complaints' },
    { to: '/student/new', label: '+ Report Issue', highlight: true },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[rgba(5,7,10,0.88)] border-b border-[rgba(223,231,224,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link to="/student" className="flex items-center gap-2 group">
            <span className="font-bold text-xl tracking-tight text-[#dfe7e0] group-hover:text-[#f5a524] transition-colors">
              HCMS
            </span>
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#f5a524]/10 text-[#f5a524] border border-[#f5a524]/30 font-medium">
              आवाज़
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-sm flex items-center transition-colors ${
                    link.highlight
                      ? 'bg-[#f5a524] text-[#05070a] hover:bg-[#e09319] ml-2 font-semibold'
                      : isActive
                      ? 'bg-[rgba(245,165,36,0.1)] text-[#f5a524] border border-[rgba(245,165,36,0.3)]'
                      : 'text-[#9aa5a0] hover:text-[#dfe7e0] hover:bg-[rgba(223,231,224,0.06)]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Hostel info badge */}
          {user?.hostel && (
            <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-sm bg-[rgba(223,231,224,0.06)] text-[11px] text-[#9aa5a0] border border-[rgba(223,231,224,0.12)]">
              {user.hostel.name} {user.roomNumber ? `· Room ${user.roomNumber}` : ''}
            </span>
          )}

          {/* Real-time SSE Notification Bell */}
          <NotificationBell />

          {/* User profile / Logout */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[rgba(223,231,224,0.12)]">
            <span className="text-xs font-medium text-[#dfe7e0] truncate max-w-[120px]">
              {user?.name}
            </span>
            <Button variant="ghost" size="small" onClick={() => logout()}>
              Sign Out
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-[#dfe7e0] hover:text-[#f5a524]"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[rgba(223,231,224,0.1)] bg-[#05070a] p-4 flex flex-col gap-2">
          {user?.hostel && (
            <div className="text-xs text-[#9aa5a0] pb-2 border-b border-[rgba(223,231,224,0.1)]">
              Signed in as <strong>{user.name}</strong> ({user.hostel.name} {user.roomNumber ? `· ${user.roomNumber}` : ''})
            </div>
          )}
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center px-3 text-sm text-[#dfe7e0] hover:text-[#f5a524]"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-[rgba(223,231,224,0.1)]">
            <Button variant="ghost" fullWidth onClick={() => logout()}>
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default StudentHeader;
