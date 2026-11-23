import React, { useEffect, useState } from 'react';

export interface CountdownProps {
  targetDate: string | Date;
  label?: string;
  onExpire?: () => void;
  className?: string;
  showIcon?: boolean;
}

export const Countdown: React.FC<CountdownProps> = ({
  targetDate,
  label = 'Deadline',
  onExpire,
  className = '',
  showIcon = true,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isOverdue: false });

  useEffect(() => {
    const updateCountdown = () => {
      const target = new Date(targetDate).getTime();
      const now = Date.now();
      const diffMs = target - now;

      const isOverdue = diffMs < 0;
      const absDiff = Math.abs(diffMs);

      const totalHours = Math.floor(absDiff / (1000 * 60 * 60));
      const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

      setTimeLeft({ hours: totalHours, minutes, seconds, isOverdue });

      if (isOverdue && onExpire && Math.abs(diffMs) < 1000) {
        onExpire();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  const { hours, minutes, seconds, isOverdue } = timeLeft;
  const isImminent = !isOverdue && hours < 6;

  const formattedTime = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  return (
    <div
      className={`inline-flex items-center gap-2 font-mono text-xs px-2.5 py-1 rounded-sm border ${
        isOverdue
          ? 'bg-[#ff5a5f]/15 border-[#ff5a5f]/40 text-[#ff5a5f]'
          : isImminent
          ? 'bg-[#f5a524]/15 border-[#f5a524]/40 text-[#f5a524]'
          : 'bg-[rgba(223,231,224,0.06)] border-[rgba(223,231,224,0.16)] text-[#dfe7e0]'
      } ${className}`}
      aria-label={`${label}: ${isOverdue ? 'Overdue by' : 'Remaining'} ${formattedTime}`}
    >
      {showIcon && (
        <span className="inline-flex shrink-0 w-3.5 h-3.5" aria-hidden="true">
          {isOverdue ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
        </span>
      )}
      <span className="font-sans text-[11px] uppercase tracking-wider text-[#9aa5a0]">
        {label}:
      </span>
      <span className="font-semibold">
        {isOverdue ? `Overdue by ${formattedTime}` : `${formattedTime} left`}
      </span>
    </div>
  );
};

export default Countdown;
