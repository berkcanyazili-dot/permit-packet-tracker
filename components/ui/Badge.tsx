import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
      {
        default: 'stt-badge-default',
        success: 'stt-badge-success',
        warning: 'stt-badge-warning',
        danger: 'stt-badge-danger',
        info: 'stt-badge-info',
        purple: 'stt-badge-purple',
      }[variant],
      className
    )}>
      {children}
    </span>
  );
}
