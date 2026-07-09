import { cn, getInitials, getAvatarColor } from '@/lib/utils';

interface AvatarProps {
  name: string;
  index?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export default function Avatar({ name, index = 0, size = 'md', className }: AvatarProps) {
  return (
    <div className={cn(
      'rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0',
      `bg-gradient-to-br ${getAvatarColor(index)}`,
      sizeMap[size],
      className
    )}>
      {getInitials(name)}
    </div>
  );
}
