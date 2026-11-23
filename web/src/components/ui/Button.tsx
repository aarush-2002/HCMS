import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'small' | 'default' | 'large';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'default',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm border border-transparent';

    const variantStyles = {
      primary:
        'bg-[#f5a524] text-[#05070a] hover:bg-[#e09319] active:bg-[#c98012] border-transparent font-medium shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
      ghost:
        'bg-transparent text-[#dfe7e0] border-[rgba(223,231,224,0.16)] hover:bg-[rgba(223,231,224,0.06)] active:bg-[rgba(223,231,224,0.1)]',
      danger:
        'bg-[#ff5a5f] text-[#05070a] hover:bg-[#e64c51] active:bg-[#cc3d42] border-transparent font-medium',
    };

    const sizeStyles = {
      small: 'min-h-[36px] px-3 py-1.5 text-xs gap-1.5',
      default: 'min-h-[44px] px-5 py-2.5 text-sm gap-2',
      large: 'min-h-[48px] px-6 py-3 text-base gap-2.5',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
