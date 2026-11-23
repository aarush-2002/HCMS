import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, rightIcon, id, className = '', disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-[#9aa5a0]">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#9aa5a0]">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={`w-full h-[44px] bg-[rgba(10,14,18,0.84)] text-[#dfe7e0] placeholder-[#9aa5a0]/50 text-sm rounded-sm border transition-colors ${
              error
                ? 'border-[#ff5a5f] focus:border-[#ff5a5f] focus:ring-1 focus:ring-[#ff5a5f]'
                : 'border-[rgba(223,231,224,0.16)] focus:border-[#f5a524] focus:ring-1 focus:ring-[#f5a524]'
            } focus:outline-none ${leftIcon ? 'pl-10' : 'pl-3.5'} ${
              rightIcon ? 'pr-10' : 'pr-3.5'
            } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 flex items-center text-[#9aa5a0]">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-xs text-[#ff5a5f] mt-0.5" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-[#9aa5a0] mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
