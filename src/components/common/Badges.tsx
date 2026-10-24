import React from 'react';
import { ContentStatus, ContentFormat, BrandMemberRole } from '../../types/database.ts';

interface StatusBadgeProps {
  status: ContentStatus;
  label?: string | null;
  dotColor?: string | null;
  className?: string;
}

function humanizeStatus(status: string): string {
  if (!status) return 'Tanpa status';
  return status
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  dotColor,
  className = '',
}) => {
  const configs: Record<ContentStatus, { label: string; dot: string; text: string }> = {
    idea: { label: 'Ide', dot: 'bg-[#8E8E93]', text: 'text-slate-600' },
    draft: { label: 'Draft', dot: 'bg-[#FF9500]', text: 'text-amber-700' },
    production: { label: 'Produksi', dot: 'bg-indigo-500', text: 'text-indigo-700' },
    in_review: { label: 'Review', dot: 'bg-[#FF3B30]', text: 'text-rose-700' },
    approved: { label: 'Disetujui', dot: 'bg-[#007AFF]', text: 'text-[#007AFF]' },
    scheduled: { label: 'Terjadwal', dot: 'bg-[#5856D6]', text: 'text-[#5856D6]' },
    published: { label: 'Tayang', dot: 'bg-[#34C759]', text: 'text-[#34C759]' },
  };

  const known = configs[status];
  const current = {
    label: label || known?.label || humanizeStatus(status),
    dot: dotColor || known?.dot || 'bg-slate-400',
    text: known?.text || 'text-slate-600',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${current.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot} shrink-0`} />
      <span>{current.label}</span>
    </span>
  );
};

interface FormatBadgeProps {
  format: ContentFormat;
  className?: string;
}

export const FormatBadge: React.FC<FormatBadgeProps> = ({ format, className = '' }) => {
  const configs: Record<ContentFormat, { label: string }> = {
    single_image: { label: 'Single Post' },
    carousel: { label: 'Carousel' },
    reel_short: { label: 'Reels / Short' },
    video: { label: 'Video' },
    story: { label: 'Story' },
    text_thread: { label: 'Thread' },
  };

  const current = configs[format] || configs.single_image;

  return (
    <span className={`text-xs text-slate-500 font-normal ${className}`}>
      {current.label}
    </span>
  );
};

interface RoleBadgeProps {
  role: BrandMemberRole;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
  const configs: Record<BrandMemberRole, { label: string; text: string; dot: string }> = {
    owner: { label: 'Pemilik', text: 'text-slate-900 font-semibold', dot: 'bg-slate-900' },
    admin: { label: 'Admin', text: 'text-[#007AFF] font-medium', dot: 'bg-[#007AFF]' },
    editor: { label: 'Editor', text: 'text-[#34C759] font-medium', dot: 'bg-[#34C759]' },
    viewer: { label: 'Anggota', text: 'text-slate-500 font-medium', dot: 'bg-[#8E8E93]' },
  };

  const current = configs[role] || configs.viewer;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${current.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot} shrink-0`} />
      <span>{current.label}</span>
    </span>
  );
};
