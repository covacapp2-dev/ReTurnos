import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap: Record<string, number> = {
  sm: 20,
  md: 32,
  lg: 48,
};

export default function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center w-full py-12', className)}>
      <Loader2
        size={sizeMap[size]}
        className="animate-spin text-[#DC2626]"
      />
    </div>
  );
}
