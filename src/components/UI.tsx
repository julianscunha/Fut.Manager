import React from 'react';
import { motion } from 'motion/react';

/**
 * Reusable Visual Tokens for Design Consistency
 */
export const VISUAL_TOKENS = {
  colors: {
    bgTurf: 'bg-[#0b110e]',
    emerald: 'text-emerald-400',
    emeraldDark: 'text-emerald-500',
    textMuted: 'text-zinc-500',
    textMain: 'text-zinc-100',
    textActive: 'text-white',
    zincBorder: 'border-zinc-900/80',
    zincBorderHover: 'hover:border-zinc-700/60',
  },
  gradients: {
    card: 'bg-zinc-950/70 border border-zinc-900/80',
    sportsCard: 'bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-zinc-900/80 border border-zinc-850',
    hero: 'bg-gradient-to-br from-zinc-950/95 via-[#0c1611]/80 to-zinc-950/95 border border-zinc-850',
    primary: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
    danger: 'bg-gradient-to-r from-rose-950 to-rose-900/85',
  },
  shadows: {
    soft: 'shadow-md',
    premium: 'shadow-2xl shadow-black/60',
    glowGreen: 'shadow-[0_0_15px_rgba(34,197,94,0.12)]',
    glowSky: 'shadow-[0_0_15px_rgba(56,189,248,0.1)]',
    glowPurple: 'shadow-[0_0_15px_rgba(192,132,252,0.1)]',
  },
  animations: {
    hoverScale: 'hover:scale-[1.015] hover:border-zinc-750 transition-all duration-300 ease-out',
    pressScale: 'active:scale-[0.97] transition-transform duration-150',
  },
  spacings: {
    cardPadding: 'p-4 sm:p-6 md:p-8',
    itemPadding: 'p-3 sm:p-4',
    gapLarge: 'space-y-6',
    gapMedium: 'space-y-4',
  }
};

/**
 * 1. SportsCard Component
 */
interface SportsCardProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  glowColor?: 'green' | 'sky' | 'purple' | 'none';
  onClick?: () => void;
}

export const SportsCard: React.FC<SportsCardProps> = ({
  id,
  children,
  className = '',
  hoverEffect = true,
  glowColor = 'none',
  onClick,
}) => {
  const glowClasses = {
    green: `${VISUAL_TOKENS.shadows.glowGreen} hover:border-emerald-500/20`,
    sky: `${VISUAL_TOKENS.shadows.glowSky} hover:border-sky-500/20`,
    purple: `${VISUAL_TOKENS.shadows.glowPurple} hover:border-purple-500/20`,
    none: '',
  };

  const interactiveClasses = onClick 
    ? 'cursor-pointer active:scale-[0.99] transition-all duration-200' 
    : '';

  return (
    <motion.div
      id={id}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        sports-card 
        rounded-2xl 
        ${VISUAL_TOKENS.gradients.sportsCard} 
        ${hoverEffect ? VISUAL_TOKENS.animations.hoverScale : 'transition-colors duration-300'} 
        ${glowClasses[glowColor]} 
        ${interactiveClasses} 
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

/**
 * 2. SportsHero Component (Standard display layout)
 */
interface SportsHeroProps {
  id?: string;
  title: string;
  subtitle?: string | React.ReactNode;
  badgeText?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  className?: string;
}

export const SportsHero: React.FC<SportsHeroProps> = ({
  id,
  title,
  subtitle,
  badgeText,
  icon,
  rightElement,
  className = '',
}) => {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`
        rounded-2xl 
        border 
        border-zinc-800 
        ${VISUAL_TOKENS.gradients.hero} 
        p-6 
        space-y-6 
        shadow-2xl 
        relative 
        overflow-hidden 
        ${className}
      `}
    >
      {/* Decorative grass pitch line background */}
      <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />
      
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-900/80 pb-4 relative z-10">
        <div className="flex items-center gap-2">
          {icon}
          {badgeText && (
            <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              {badgeText}
            </span>
          )}
        </div>
        {rightElement && <div className="flex items-center gap-2">{rightElement}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
        <div className="md:col-span-12 space-y-2">
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight leading-none">
            {title}
          </h1>
          {subtitle && (
            <div className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * 3. SportsButton Component
 */
interface SportsButtonProps {
  id?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'confirm' | 'danger' | 'ghost' | 'outline' | 'whatsapp';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

export const SportsButton: React.FC<SportsButtonProps> = ({
  id,
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  onClick,
  type = 'button',
}) => {
  const baseStyle = "flex items-center justify-center gap-2 font-mono font-black tracking-wider uppercase transition-all duration-200 cursor-pointer active:scale-[0.97] rounded-xl border select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100";
  
  const sizeStyles = {
    sm: 'text-[9.5px] px-3 py-1.5 h-8 rounded-lg',
    md: 'text-xs px-4 py-2.5 h-11',
    lg: 'text-xs sm:text-sm px-6 py-3.5 h-13 rounded-2xl',
  };

  const variantStyles = {
    primary: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20',
    confirm: 'bg-gradient-to-r from-emerald-600 to-emerald-500 border-emerald-500/40 text-white shadow-[0_4px_20px_-2px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)]',
    secondary: 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white',
    danger: 'bg-gradient-to-r from-rose-950 to-rose-900 border-rose-500/30 text-rose-400 hover:text-rose-350 shadow-[0_4px_20px_-2px_rgba(244,63,94,0.15)]',
    ghost: 'bg-transparent hover:bg-zinc-900/60 border-transparent text-zinc-400 hover:text-white',
    outline: 'bg-transparent hover:bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white',
    whatsapp: 'bg-emerald-950/15 hover:bg-emerald-950/30 border-emerald-900/35 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300',
  };

  return (
    <button
      id={id}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        ${baseStyle} 
        ${sizeStyles[size]} 
        ${variantStyles[variant]} 
        ${className}
      `}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        icon
      )}
      {children}
    </button>
  );
};

/**
 * 4. SportsBadge Component
 */
interface SportsBadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'muted';
  children: React.ReactNode;
  className?: string;
}

export const SportsBadge: React.FC<SportsBadgeProps> = ({
  variant = 'muted',
  children,
  className = '',
}) => {
  const badgeStyles = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    muted: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg border font-mono font-semibold text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 ${badgeStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

/**
 * 5. SportsIndicator Component
 */
interface SportsIndicatorProps {
  status?: 'active' | 'warning' | 'error' | 'inactive';
  label?: string;
  pulse?: boolean;
}

export const SportsIndicator: React.FC<SportsIndicatorProps> = ({
  status = 'inactive',
  label,
  pulse = true,
}) => {
  const dotColor = {
    active: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
    inactive: 'bg-zinc-600',
  };

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && status !== 'inactive' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor[status]}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor[status]}`} />
      </span>
      {label && <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">{label}</span>}
    </div>
  );
};

/**
 * 6. SportsHeading Component
 */
interface SportsHeadingProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  className?: string;
}

export const SportsHeading: React.FC<SportsHeadingProps> = ({
  title,
  subtitle,
  badge,
  icon,
  rightElement,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between border-b border-zinc-900 pb-3.5 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">
              {title}
            </h3>
            {badge && (
              <span className="text-[8px] font-mono font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[10px] text-zinc-500 font-mono">{subtitle}</p>}
        </div>
      </div>
      {rightElement && <div>{rightElement}</div>}
    </div>
  );
};

/**
 * 7. SportsContainer Component
 */
interface SportsContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const SportsContainer: React.FC<SportsContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 ${className}`}>
      {children}
    </div>
  );
};

/**
 * 8. SportsSkeleton Component
 */
export const SportsSkeleton = {
  Card: () => (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 space-y-4 animate-pulse">
      <div className="flex justify-between items-center border-b border-zinc-900 pb-3.5">
        <div className="h-4 bg-zinc-800 rounded w-1/3" />
        <div className="h-6 bg-zinc-800 rounded-lg w-16" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
      </div>
    </div>
  ),
  Header: () => (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 space-y-6 animate-pulse">
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
        <div className="h-4 bg-zinc-800 rounded w-28" />
        <div className="h-6 bg-zinc-800 rounded-lg w-32" />
      </div>
      <div className="space-y-4">
        <div className="h-10 bg-zinc-800 rounded-xl w-2/3" />
        <div className="h-6 bg-zinc-850 rounded-lg w-1/2" />
      </div>
    </div>
  ),
  List: ({ itemsCount = 4 }) => (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: itemsCount }).map((_, idx) => (
        <div key={idx} className="flex justify-between items-center p-3 bg-zinc-950/40 border border-zinc-900/60 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-3 bg-zinc-800 rounded w-28" />
              <div className="h-2 bg-zinc-800 rounded w-16" />
            </div>
          </div>
          <div className="h-6 bg-zinc-850 rounded-lg w-16" />
        </div>
      ))}
    </div>
  )
};
