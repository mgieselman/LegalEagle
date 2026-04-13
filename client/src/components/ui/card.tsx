import * as React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border rounded-lg p-4 space-y-4', className)}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

interface CardHeaderProps {
  title: string;
  children?: React.ReactNode;
}

function CardHeader({ title, children }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-medium">{title}</h3>
      {children}
    </div>
  );
}

export { Card, CardHeader };
