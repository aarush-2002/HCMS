import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import Button from '../ui/Button';

export interface AdminHeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'reports', label: 'Reports & Analytics' },
    { id: 'users', label: 'Users & Roles' },
    { id: 'hostels', label: 'Hostels & Assignments' },
    { id: 'policy', label: 'Policy Configuration' },
    { id: 'complaints', label: 'Complaint Exceptions' },
    { id: 'ratings', label: 'Rating Moderation' },
    { id: 'audit', label: 'Audit Ledger' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[rgba(5,7,10,0.95)] border-b border-[rgba(223,231,224,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link to="/admin" className="flex items-center gap-2 group">
            <span className="font-bold text-xl tracking-tight text-[#dfe7e0] group-hover:text-[#f5a524] transition-colors">
              HCMS
            </span>
            <span className="text-xs px-2 py-0.5 rounded-sm bg-[#ff5a5f]/20 text-[#ff5a5f] border border-[#ff5a5f]/40 font-mono font-medium">
              ADMIN CONSOLE
            </span>
          </Link>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          <NotificationBell />

          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[rgba(223,231,224,0.12)]">
            <span className="text-xs font-medium text-[#dfe7e0]">
              {user?.name} (Admin)
            </span>
            <Button variant="ghost" size="small" onClick={() => logout()}>
              Sign Out
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-[#dfe7e0]"
            aria-label="Toggle admin menu"
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

      {/* Admin Horizontal Subnav Tabs (Desktop) */}
      {onTabChange && (
        <div className="hidden lg:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[rgba(223,231,224,0.06)] overflow-x-auto">
          <div className="flex items-center gap-1 py-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524] ${
                    isActive
                      ? 'bg-[#f5a524] text-[#05070a] font-semibold'
                      : 'text-[#9aa5a0] hover:text-[#dfe7e0] hover:bg-[rgba(223,231,224,0.06)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[rgba(223,231,224,0.1)] bg-[#05070a] p-4 flex flex-col gap-2">
          {onTabChange &&
            tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onTabChange(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] flex items-center px-3 text-xs text-left rounded-sm ${
                  activeTab === tab.id ? 'bg-[#f5a524] text-black font-semibold' : 'text-[#dfe7e0]'
                }`}
              >
                {tab.label}
              </button>
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

export default AdminHeader;
