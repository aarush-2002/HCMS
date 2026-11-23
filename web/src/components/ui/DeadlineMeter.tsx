import React from 'react';

export interface DeadlineMeterProps {
  createdAt: string | Date;
  deadline: string | Date;
  priority?: 'NORMAL' | 'EMERGENCY';
  isResolved?: boolean;
  className?: string;
}

export const DeadlineMeter: React.FC<DeadlineMeterProps> = ({
  createdAt,
  deadline,
  priority = 'NORMAL',
  isResolved = false,
  className = '',
}) => {
  const start = new Date(createdAt).getTime();
  const end = new Date(deadline).getTime();
  const now = Date.now();

  const totalDuration = Math.max(1, end - start);
  const elapsed = Math.max(0, now - start);
  const rawPercentage = (elapsed / totalDuration) * 100;
  const clampedPercentage = Math.min(100, Math.max(0, rawPercentage));

  const remainingMs = end - now;
  const isOverdue = remainingMs < 0 && !isResolved;
  const isImminent = remainingMs > 0 && remainingMs < 6 * 60 * 60 * 1000 && !isResolved;

  // Formatting remaining time
  const absRemaining = Math.abs(remainingMs);
  const remHours = Math.floor(absRemaining / (1000 * 60 * 60));
  const remMinutes = Math.floor((absRemaining % (1000 * 60 * 60)) / (1000 * 60));

  let statusText = `${remHours}h ${remMinutes}m remaining`;
  if (isResolved) {
    statusText = 'Completed within SLA';
  } else if (isOverdue) {
    statusText = `Overdue by ${remHours}h ${remMinutes}m`;
  }

  // Meter color logic
  let barColor = 'bg-[#7fb4c9]'; // normal healthy
  if (isResolved) {
    barColor = 'bg-[#6fcf97]';
  } else if (isOverdue) {
    barColor = 'bg-[#ff5a5f]';
  } else if (isImminent || priority === 'EMERGENCY') {
    barColor = 'bg-[#f5a524]';
  }

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#9aa5a0]">
          {`SLA Tracker (${priority === 'EMERGENCY' ? '24h Emergency' : '72h Standard'})`}
        </span>
        <span
          className={`font-mono font-medium ${
            isResolved
              ? 'text-[#6fcf97]'
              : isOverdue
              ? 'text-[#ff5a5f]'
              : isImminent
              ? 'text-[#f5a524]'
              : 'text-[#dfe7e0]'
          }`}
        >
          {statusText}
        </span>
      </div>

      <div
        className="w-full h-2 rounded-sm bg-[rgba(223,231,224,0.08)] overflow-hidden border border-[rgba(223,231,224,0.1)]"
        role="progressbar"
        aria-valuenow={Math.round(clampedPercentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`SLA time elapsed: ${Math.round(clampedPercentage)}%`}
      >
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${isResolved ? 100 : clampedPercentage}%` }}
        />
      </div>
    </div>
  );
};

export default DeadlineMeter;
