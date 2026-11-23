import React from 'react';

export type PriorityType = 'NORMAL' | 'EMERGENCY';
export type StatusType =
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'MARKED_RESOLVED'
  | 'RESOLVED'
  | 'REOPENED'
  | 'CLOSED'
  | 'REJECTED';

export type BadgeVariant = 'priority' | 'status' | 'category' | 'generic';

export interface BadgeProps {
  variant?: BadgeVariant;
  priority?: PriorityType;
  status?: StatusType;
  label?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'generic',
  priority,
  status,
  label,
  className = '',
}) => {
  // 1. Priority Badges: Always text + icon, never color alone
  if (variant === 'priority' || priority) {
    const isEmergency = priority === 'EMERGENCY';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm border uppercase tracking-wider ${
          isEmergency
            ? 'bg-[#ff5a5f]/10 text-[#ff5a5f] border-[#ff5a5f]/40'
            : 'bg-[#7fb4c9]/10 text-[#7fb4c9] border-[#7fb4c9]/40'
        } ${className}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isEmergency ? 'bg-[#ff5a5f] animate-pulse' : 'bg-[#7fb4c9]'
          }`}
          aria-hidden="true"
        />
        <span>{isEmergency ? 'Emergency (24h)' : 'Normal (72h)'}</span>
      </span>
    );
  }

  // 2. Status Badges: Always explicit text + semantic indicator
  if (variant === 'status' || status) {
    const statusConfig: Record<
      StatusType,
      { text: string; bg: string; textCol: string; border: string; icon: string }
    > = {
      SUBMITTED: {
        text: 'Submitted',
        bg: 'bg-[rgba(223,231,224,0.06)]',
        textCol: 'text-[#dfe7e0]',
        border: 'border-[rgba(223,231,224,0.2)]',
        icon: '○',
      },
      ACKNOWLEDGED: {
        text: 'Acknowledged',
        bg: 'bg-[#7fb4c9]/10',
        textCol: 'text-[#7fb4c9]',
        border: 'border-[#7fb4c9]/30',
        icon: '◐',
      },
      IN_PROGRESS: {
        text: 'In Progress',
        bg: 'bg-[#f5a524]/10',
        textCol: 'text-[#f5a524]',
        border: 'border-[#f5a524]/40',
        icon: '⚙',
      },
      MARKED_RESOLVED: {
        text: 'Marked Resolved',
        bg: 'bg-[#f5a524]/15',
        textCol: 'text-[#f5a524]',
        border: 'border-[#f5a524]/50',
        icon: '◈',
      },
      RESOLVED: {
        text: 'Resolved',
        bg: 'bg-[#6fcf97]/15',
        textCol: 'text-[#6fcf97]',
        border: 'border-[#6fcf97]/40',
        icon: '✓',
      },
      REOPENED: {
        text: 'Reopened',
        bg: 'bg-[#ff5a5f]/15',
        textCol: 'text-[#ff5a5f]',
        border: 'border-[#ff5a5f]/40',
        icon: '↺',
      },
      CLOSED: {
        text: 'Closed',
        bg: 'bg-[#9aa5a0]/10',
        textCol: 'text-[#9aa5a0]',
        border: 'border-[#9aa5a0]/30',
        icon: '●',
      },
      REJECTED: {
        text: 'Rejected',
        bg: 'bg-[#ff5a5f]/10',
        textCol: 'text-[#ff5a5f]',
        border: 'border-[#ff5a5f]/30',
        icon: '✕',
      },
    };

    const cfg = (status && statusConfig[status]) || statusConfig.SUBMITTED;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-sm border ${cfg.bg} ${cfg.textCol} ${cfg.border} ${className}`}
      >
        <span className="font-mono text-[10px]" aria-hidden="true">
          {cfg.icon}
        </span>
        <span>{cfg.text}</span>
      </span>
    );
  }

  // 3. Category or generic badge
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-normal rounded-sm bg-[rgba(223,231,224,0.06)] text-[#dfe7e0] border border-[rgba(223,231,224,0.12)] ${className}`}
    >
      {label || 'Tag'}
    </span>
  );
};

export default Badge;
