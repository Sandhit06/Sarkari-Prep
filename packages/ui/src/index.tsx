import React from 'react';

// Apple WWDC "Designing Fluid Interfaces" Momentum Projection & Rubber-Banding Utilities
export function appleProjectMomentum(initialVelocityPxPerSec: number, decelerationRate = 0.998): number {
  return ((initialVelocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

export function appleRubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  heavy?: boolean;
  interactive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  heavy = false,
  interactive = false,
  className = '',
  children,
  ...props
}) => {
  const baseClass = heavy ? 'apple-glass-heavy' : 'apple-glass-card';
  const hoverClass = interactive ? 'apple-glass-interactive cursor-pointer' : '';
  return (
    <div className={`${baseClass} ${hoverClass} p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};
