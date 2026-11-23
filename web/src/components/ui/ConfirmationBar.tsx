import React from 'react';

export interface ConfirmationBarProps {
  solvedCount: number;
  notSolvedCount?: number;
  requiredVotes?: number; // default 3
  className?: string;
}

export const ConfirmationBar: React.FC<ConfirmationBarProps> = ({
  solvedCount,
  notSolvedCount = 0,
  requiredVotes = 3,
  className = '',
}) => {
  const isResolved = solvedCount >= requiredVotes;
  const isReopened = notSolvedCount >= requiredVotes;

  return (
    <div className={`flex flex-col gap-2 p-3 bg-[rgba(10,14,18,0.7)] border border-[rgba(223,231,224,0.12)] rounded-sm ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#dfe7e0]">
          Resolution Confirmation
        </span>
        <span className="text-[#9aa5a0] font-mono">
          {`${solvedCount} / ${requiredVotes} confirmations`}
        </span>
      </div>

      {/* 3 Solved Pips */}
      <div className="grid grid-cols-3 gap-2" role="progressbar" aria-valuenow={solvedCount} aria-valuemin={0} aria-valuemax={requiredVotes}>
        {Array.from({ length: requiredVotes }).map((_, index) => {
          const isFilled = index < solvedCount;
          return (
            <div
              key={index}
              className={`h-2.5 rounded-sm transition-all duration-300 border ${
                isResolved
                  ? 'bg-[#6fcf97] border-[#6fcf97]'
                  : isFilled
                  ? 'bg-[#f5a524] border-[#f5a524]'
                  : 'bg-[rgba(223,231,224,0.06)] border-[rgba(223,231,224,0.16)]'
              }`}
              title={`Confirmation ${index + 1} of ${requiredVotes}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#9aa5a0]">
        <span>
          {isResolved ? (
            <strong className="text-[#6fcf97]">Verified by 3 students — Resolved</strong>
          ) : isReopened ? (
            <strong className="text-[#ff5a5f]">3 students reported issue persists — Reopened</strong>
          ) : (
            <span>Needs 3 student &ldquo;Solved&rdquo; confirmations</span>
          )}
        </span>

        {notSolvedCount > 0 && !isReopened && (
          <span className="text-[#ff5a5f] font-mono">
            {`${notSolvedCount} not solved ${notSolvedCount === 1 ? 'vote' : 'votes'}`}
          </span>
        )}
      </div>
    </div>
  );
};

export default ConfirmationBar;
