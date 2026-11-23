import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center border border-dashed border-[rgba(223,231,224,0.16)] rounded-sm bg-[rgba(10,14,18,0.4)] ${className}`}
    >
      {icon ? (
        <div className="w-12 h-12 mb-3 text-[#9aa5a0] flex items-center justify-center">
          {icon}
        </div>
      ) : (
        <div className="w-12 h-12 mb-3 rounded-full bg-[rgba(223,231,224,0.06)] border border-[rgba(223,231,224,0.1)] flex items-center justify-center text-[#9aa5a0]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}

      <h4 className="text-base font-medium text-[#dfe7e0] tracking-tight">{title}</h4>
      <p className="text-xs text-[#9aa5a0] max-w-sm mt-1">{description}</p>

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
