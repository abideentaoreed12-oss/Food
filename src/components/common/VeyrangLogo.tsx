import React from 'react';

interface VeyrangLogoProps {
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textSize?: 'sm' | 'md' | 'lg' | 'xl';
  lightMode?: boolean;
}

export const VeyrangLogo: React.FC<VeyrangLogoProps> = ({
  className = '',
  iconSize = 'md',
  showText = true,
  textSize = 'md',
  lightMode = false,
}) => {
  // Determine dimensions of the beautiful custom SVG logo mark
  const iconDimensions = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8 sm:h-9 sm:w-9',
    lg: 'h-10 w-10 sm:h-12 sm:w-12',
    xl: 'h-14 w-14 sm:h-16 sm:w-16',
  }[iconSize];

  // Determine text styles
  const textStyles = {
    sm: 'text-lg sm:text-xl font-extrabold tracking-tight',
    md: 'text-2xl sm:text-3xl font-extrabold tracking-tight',
    lg: 'text-3xl sm:text-4xl font-extrabold tracking-tight',
    xl: 'text-4xl sm:text-5xl font-black tracking-tight',
  }[textSize];

  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 select-none ${className}`}>
      {/* 🚀 Dynamic Premium SVG Logo Icon (Dual-tone tech boomerang merged with speed wing) */}
      <div className={`relative flex-shrink-0 transition-transform duration-300 hover:scale-105 active:scale-95 ${iconDimensions}`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full filter drop-shadow-[0_2px_8px_rgba(255,85,0,0.15)]"
        >
          {/* Background Ambient Glow */}
          <circle cx="50" cy="50" r="45" fill="url(#logoGlow)" opacity="0.08" />

          {/* Left Wing / Boomerang Core (Veyrang Velocity Slate Wing) */}
          <path
            d="M20 25C20 22.2386 22.2386 20 25 20H45C52.1797 20 58 25.8203 58 33V47C58 49.7614 55.7614 52 53 52H33C25.8203 52 20 46.1797 20 39V25Z"
            fill={lightMode ? '#FFFFFF' : '#0F172A'}
            className="transition-colors duration-300"
          />

          {/* Dynamic Core Forward Boomerang (Veyrang Orange Speed Slash) */}
          <path
            d="M40 38C35.5817 38 32 41.5817 32 46V70C32 75.5228 36.4772 80 42 80H66C70.4183 80 74 76.4183 74 72V48C74 42.4772 69.5228 38 64 38H40Z"
            fill="url(#orangeGradient)"
          />

          {/* Fast-forward Chevron Spark (Tech cut-out for Speed) */}
          <path
            d="M48 48L58 54L48 60V48Z"
            fill="#FFFFFF"
            className="animate-pulse"
          />

          {/* Definition and gradients */}
          <defs>
            <linearGradient id="orangeGradient" x1="32" y1="38" x2="74" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF7700" />
              <stop offset="50%" stopColor="#FF5500" />
              <stop offset="100%" stopColor="#E03E00" />
            </linearGradient>
            <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF5500" />
              <stop offset="100%" stopColor="#FF5500" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>

        {/* Small Active Pulse Indicator */}
        <span className="absolute top-0 right-0 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5500] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5500]"></span>
        </span>
      </div>

      {/* 📝 Stylized Wordmark */}
      {showText && (
        <div className="flex flex-col justify-center leading-none">
          <div className={`${textStyles} font-display flex items-center`}>
            {/* Vey part: bold corporate slate */}
            <span className={`${lightMode ? 'text-white' : 'text-slate-800 font-extrabold'} transition-colors duration-300`}>
              Vey
            </span>
            {/* raNG part: ultra-black orange gradient */}
            <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF5500] to-[#FF8822] tracking-normal">
              raNG
            </span>
          </div>
          {/* Subtle micro-sublabel */}
          <span className={`text-[9px] font-mono tracking-widest uppercase font-bold text-left ml-0.5 mt-0.5 ${lightMode ? 'text-orange-200' : 'text-slate-400'}`}>
            Delivery pro
          </span>
        </div>
      )}
    </div>
  );
};
