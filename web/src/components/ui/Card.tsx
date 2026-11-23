import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  interactive?: boolean;
  padded?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  interactive = false,
  padded = true,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-[rgba(10,14,18,0.84)] backdrop-blur-md border border-[rgba(223,231,224,0.16)] rounded-sm text-[#dfe7e0] transition-colors ${
        padded ? 'p-6' : ''
      } ${
        interactive
          ? 'hover:border-[rgba(245,165,36,0.5)] hover:bg-[rgba(14,20,30,0.88)] cursor-pointer'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1 pb-4 border-b border-[rgba(223,231,224,0.08)] ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3 className={`text-lg font-medium text-[#dfe7e0] tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <p className={`text-sm text-[#9aa5a0] ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`pt-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`flex items-center justify-between pt-4 mt-4 border-t border-[rgba(223,231,224,0.08)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
