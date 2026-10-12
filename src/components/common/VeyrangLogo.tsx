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
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* 🚀 Dynamic Premium SVG Logo Icon Matching Reference Design */}
      <div className={`relative flex-shrink-0 transition-transform duration-300 hover:scale-105 active:scale-95 ${iconDimensions}`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
        >
          {/* Circular dot above/left */}
          <circle cx="28" cy="24" r="8" fill={lightMode ? "#FFFFFF" : "#0D4F3C"} />
          
          {/* Main leaf / droplet curved shape */}
          <path
            d="M26 44C26 36 34 30 46 30C58 30 68 38 72 50C76 62 70 76 56 78C42 80 26 70 26 56V44Z"
            fill={lightMode ? "#F3EBD3" : "#0D4F3C"}
          />
          {/* Folded leaf slice highlight */}
          <path
            d="M48 30C56 36 64 46 64 58C64 68 56 76 46 78C56 72 60 58 56 46C52 38 48 32 48 30Z"
            fill="#E8C547"
          />
        </svg>
      </div>

      {/* 📝 Stylized Wordmark Matching Reference Image */}
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-baseline tracking-tight font-display">
            <span className={`text-xl sm:text-2xl font-black ${lightMode ? 'text-white' : 'text-slate-900'}`}>
              Veyra
            </span>
            <span className="text-xl sm:text-2xl font-black text-[#E8C547]">
              NG
            </span>
          </div>
          <span className={`text-[9px] font-mono tracking-[0.2em] uppercase font-bold text-left ${lightMode ? 'text-emerald-100/90' : 'text-slate-600'}`}>
            DELIVERY PRO
          </span>
        </div>
      )}
    </div>
  );
};
