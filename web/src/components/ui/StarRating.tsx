import React, { useState } from 'react';

export interface StarRatingProps {
  value?: number; // 1, 2, or 3
  onChange?: (stars: number) => void;
  readOnly?: boolean;
  size?: 'small' | 'default' | 'large';
  className?: string;
}

const STAR_LABELS: Record<number, string> = {
  1: '1 Star — Needs Improvement',
  2: '2 Stars — Satisfactory',
  3: '3 Stars — Exemplary',
};

export const StarRating: React.FC<StarRatingProps> = ({
  value = 0,
  onChange,
  readOnly = false,
  size = 'default',
  className = '',
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const starSizes = {
    small: 'w-4 h-4',
    default: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  const activeStars = hoverValue !== null ? hoverValue : value;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div
        role={readOnly ? 'img' : 'radiogroup'}
        aria-label={`Rating: ${value > 0 ? `${value} of 3 stars` : 'Not rated'}`}
        className="flex items-center gap-1.5"
      >
        {[1, 2, 3].map((starNum) => {
          const isFilled = starNum <= activeStars;

          if (readOnly) {
            return (
              <span
                key={starNum}
                className={`${starSizes[size]} ${
                  isFilled ? 'text-[#f5a524]' : 'text-[#9aa5a0]/30'
                }`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill={isFilled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </span>
            );
          }

          return (
            <button
              key={starNum}
              type="button"
              role="radio"
              aria-checked={value === starNum}
              aria-label={STAR_LABELS[starNum]}
              onClick={() => onChange && onChange(starNum)}
              onMouseEnter={() => setHoverValue(starNum)}
              onMouseLeave={() => setHoverValue(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524] transition-transform active:scale-95"
            >
              <span
                className={`${starSizes[size]} transition-colors ${
                  isFilled ? 'text-[#f5a524]' : 'text-[#9aa5a0]/40 hover:text-[#f5a524]/60'
                }`}
              >
                <svg viewBox="0 0 24 24" fill={isFilled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      {!readOnly && (
        <span className="text-xs text-[#9aa5a0] min-h-[16px]">
          {activeStars > 0 ? STAR_LABELS[activeStars] : 'Select rating (1 to 3 stars)'}
        </span>
      )}
    </div>
  );
};

export default StarRating;
