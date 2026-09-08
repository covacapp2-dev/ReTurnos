import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
}

export default function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  iconColor = '#DC2626',
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-[#333] bg-[#1A1A1A] p-5">
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend.isPositive ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-[#9CA3AF] mt-1">{label}</p>
      </div>
    </div>
  );
}
