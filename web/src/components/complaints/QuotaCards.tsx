import React from 'react';
import { QuotaStatus } from '@hmcs/shared';
import Card from '../ui/Card';
import Countdown from '../ui/Countdown';

export interface QuotaCardsProps {
  quota: QuotaStatus | null;
  loading?: boolean;
}

export const QuotaCards: React.FC<QuotaCardsProps> = ({ quota, loading = false }) => {
  if (loading || !quota) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <Card className="animate-pulse h-28" />
        <Card className="animate-pulse h-28" />
      </div>
    );
  }

  const normalAvailable = quota.normalLeftToday > 0;
  const emergencyAvailable = quota.emergencyLeftThisWeek > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      {/* Daily Normal Quota Card */}
      <Card padded={false} className="p-4 sm:p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#7fb4c9]">
              Daily Submission Limit
            </span>
            <h3 className="text-sm font-medium text-[#dfe7e0] mt-0.5">
              Normal Complaints (72h SLA)
            </h3>
          </div>
          <div className="text-right">
            <span
              className={`text-2xl font-mono font-light ${
                normalAvailable ? 'text-[#7fb4c9]' : 'text-[#ff5a5f]'
              }`}
            >
              {quota.normalLeftToday}
            </span>
            <span className="text-xs text-[#9aa5a0] font-mono">
              {' '}/ {quota.normalDailyLimit} left today
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[rgba(223,231,224,0.08)] flex flex-wrap items-center justify-between text-xs text-[#9aa5a0]">
          <span>Resets at midnight ({quota.timezone})</span>
          <Countdown targetDate={quota.nextDailyResetTime} label="Daily Reset" showIcon={false} />
        </div>
      </Card>

      {/* Weekly Emergency Quota Card */}
      <Card padded={false} className="p-4 sm:p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#ff5a5f]">
              Weekly Emergency Allowance
            </span>
            <h3 className="text-sm font-medium text-[#dfe7e0] mt-0.5">
              Emergency Complaints (24h SLA)
            </h3>
          </div>
          <div className="text-right">
            <span
              className={`text-2xl font-mono font-light ${
                emergencyAvailable ? 'text-[#ff5a5f]' : 'text-[#9aa5a0]'
              }`}
            >
              {quota.emergencyLeftThisWeek}
            </span>
            <span className="text-xs text-[#9aa5a0] font-mono">
              {' '}/ {quota.emergencyWeeklyLimit} left this week
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[rgba(223,231,224,0.08)] flex flex-wrap items-center justify-between text-xs text-[#9aa5a0]">
          <span>Resets Mondays 00:00 ({quota.timezone})</span>
          <Countdown targetDate={quota.nextWeeklyResetTime} label="Weekly Reset" showIcon={false} />
        </div>
      </Card>
    </div>
  );
};

export default QuotaCards;
