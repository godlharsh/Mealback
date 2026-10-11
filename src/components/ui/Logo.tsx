import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showTagline = false, className = '' }: LogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-14 h-14 p-3',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`${iconSizes[size]} rounded-full bg-brand-primary text-white flex items-center justify-center shadow-md flex-shrink-0 transition-transform hover:scale-105`}
      >
        <UtensilsCrossed className="w-full h-full stroke-[2.2]" />
      </div>
      <div>
        <div className={`font-extrabold tracking-tight text-brand-dark ${textSizes[size]}`}>
          Meal<span className="text-brand-primary">Back</span>
        </div>
        {showTagline && (
          <p className="text-xs font-medium text-brand-muted tracking-wide -mt-0.5">
            Skip a meal. Get value back.
          </p>
        )}
      </div>
    </div>
  );
}
