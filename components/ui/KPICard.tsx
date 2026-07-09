'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn, formatNumber, formatPercent } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose';
  delay?: number;
  className?: string;
}

const colorMap = {
  cyan: {
    icon: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    trend: 'text-cyan-500',
    accent: 'rgba(6,182,212,0.15)',
  },
  purple: {
    icon: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    trend: 'text-purple-400',
    accent: 'rgba(139,92,246,0.15)',
  },
  emerald: {
    icon: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    trend: 'text-emerald-400',
    accent: 'rgba(16,185,129,0.15)',
  },
  amber: {
    icon: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    trend: 'text-amber-400',
    accent: 'rgba(245,158,11,0.15)',
  },
  rose: {
    icon: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    trend: 'text-rose-400',
    accent: 'rgba(239,68,68,0.15)',
  },
};

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'cyan',
  delay = 0,
  className,
}: KPICardProps) {
  const colors = colorMap[color];
  const displayValue = typeof value === 'number' ? formatNumber(value) : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        'relative min-w-0 overflow-hidden rounded-2xl border backdrop-blur-sm p-3 shadow-lg hover:shadow-xl transition-all duration-300 sm:p-4',
        colors.border,
        className
      )}
      style={{
        background: 'var(--bg-surface)',
        boxShadow: `0 4px 24px var(--shadow-color), 0 0 0 1px ${colors.accent}`,
      }}
    >
      {/* Subtle colour glow top-right */}
      <div
        className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${colors.accent}, transparent)` }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl sm:h-9 sm:w-9', colors.bg)}>
            <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', colors.icon)} />
          </div>
          {trend && (
            <div className={cn('flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium', colors.bg, colors.trend)}>
              {trend.value >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(trend.value))}
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.2 }}
          className="mt-3"
        >
          <div className="truncate text-lg font-bold tracking-tight transition-colors duration-200 sm:text-2xl" style={{ color: 'var(--text-primary)' }}>
            {displayValue}
          </div>
          <div
            className="mt-0.5 text-xs transition-colors duration-200 sm:text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="mt-1 text-[11px] sm:text-xs" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </div>
          )}
          {trend && (
            <div className="mt-0.5 text-[11px] sm:text-xs" style={{ color: 'var(--text-muted)' }}>
              {trend.label}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
