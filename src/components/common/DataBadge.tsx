import React from 'react';
import { DataOrigin } from '../../types';

interface DataBadgeProps {
  origin: DataOrigin;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

export const DataBadge: React.FC<DataBadgeProps> = ({
  origin,
  size = 'sm',
  className = '',
  showIcon = true,
}) => {
  const configs: Record<
    DataOrigin,
    { label: string; dot: string; text: string; bg: string; title: string }
  > = {
    official: {
      label: 'Official Bill',
      dot: 'bg-emerald-500',
      text: 'text-slate-600',
      bg: 'bg-slate-100/80',
      title: 'Official LESCO printed bill reading or invoiced units.',
    },
    calculated: {
      label: 'Calculated',
      dot: 'bg-blue-500',
      text: 'text-slate-600',
      bg: 'bg-slate-100/80',
      title: 'Derived from sequential readings or outdoor sync gap.',
    },
    estimated: {
      label: 'Projected',
      dot: 'bg-amber-500',
      text: 'text-slate-600',
      bg: 'bg-slate-100/80',
      title: 'Current run-rate projection or forecast.',
    },
    user_entered: {
      label: 'Recorded',
      dot: 'bg-slate-400',
      text: 'text-slate-600',
      bg: 'bg-slate-100/80',
      title: 'User-submitted meter reading at specified timestamp.',
    },
  };

  const c = configs[origin];
  const sizeClasses = size === 'sm' ? 'text-[11px] py-0.5 px-2' : 'text-xs py-1 px-2.5';

  return (
    <span
      title={c.title}
      className={`inline-flex items-center gap-1.5 font-medium rounded-md ${c.bg} ${c.text} ${sizeClasses} ${className}`}
    >
      {showIcon && <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />}
      <span>{c.label}</span>
    </span>
  );
};

