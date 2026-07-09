import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}

export default function GlassCard({ children, className, title, action }: GlassCardProps) {
  return (
    <div
      className={cn('rounded-2xl border backdrop-blur-sm shadow-lg transition-all duration-200 stt-surface-elevated', className)}
      style={{
        borderColor: 'var(--border-subtle)',
        boxShadow: '0 4px 24px var(--shadow-color)',
      }}
    >
      {(title || action) && (
        <div
          className="flex flex-col gap-3 px-4 py-4 border-b transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          style={{ borderColor: 'var(--border-divider)' }}
        >
          {title && (
            <h3
              className="text-sm font-semibold transition-colors duration-200"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h3>
          )}
          {action && <div className="w-full sm:w-auto">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
