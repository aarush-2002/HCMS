import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  showCount?: boolean;
  maxLength?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      showCount = false,
      maxLength,
      value,
      id,
      className = '',
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="w-full flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          {label && (
            <label htmlFor={textareaId} className="text-xs font-medium uppercase tracking-wider text-[#9aa5a0]">
              {label}
            </label>
          )}
          {showCount && maxLength && (
            <span
              className={`text-xs ${
                currentLength >= maxLength ? 'text-[#ff5a5f]' : 'text-[#9aa5a0]'
              }`}
            >
              {currentLength} / {maxLength}
            </span>
          )}
        </div>

        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          className={`w-full bg-[rgba(10,14,18,0.84)] text-[#dfe7e0] placeholder-[#9aa5a0]/50 text-sm rounded-sm border p-3 transition-colors ${
            error
              ? 'border-[#ff5a5f] focus:border-[#ff5a5f] focus:ring-1 focus:ring-[#ff5a5f]'
              : 'border-[rgba(223,231,224,0.16)] focus:border-[#f5a524] focus:ring-1 focus:ring-[#f5a524]'
          } focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-y ${className}`}
          {...props}
        />

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

Textarea.displayName = 'Textarea';
export default Textarea;
