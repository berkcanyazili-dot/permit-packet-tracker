'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export default function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex items-center gap-1.5 h-8 px-2 rounded-xl border transition-all duration-300 overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        borderColor: isDark
          ? 'rgba(255,255,255,0.10)'
          : 'rgba(15,23,42,0.12)',
      }}
    >
      {/* Sliding pill indicator */}
      <motion.div
        layout
        className="absolute inset-0.5 w-[calc(50%-2px)] rounded-lg"
        animate={{
          x: isDark ? 0 : '100%',
          background: isDark
            ? 'linear-gradient(135deg,#0891B2,#1D4ED8)'
            : 'linear-gradient(135deg,#F59E0B,#EF4444)',
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      />

      {/* Moon icon (dark) */}
      <div className="relative z-10 w-7 h-7 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key="moon"
            initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
            transition={{ duration: 0.18 }}
          >
              <Moon
                size={13}
                className="transition-colors duration-200"
              style={{ color: isDark ? '#FFFFFF' : '#475569' }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sun icon (light) */}
      <div className="relative z-10 w-7 h-7 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key="sun"
            initial={{ opacity: 0, rotate: 30, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -30, scale: 0.7 }}
            transition={{ duration: 0.18 }}
          >
              <Sun
                size={13}
                className="transition-colors duration-200"
              style={{ color: isDark ? '#64748B' : '#0F172A' }}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.button>
  );
}
