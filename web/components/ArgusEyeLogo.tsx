"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

interface ArgusEyeLogoProps {
  size?: number;
  interactive?: boolean;
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export const ArgusEyeLogo: React.FC<ArgusEyeLogoProps> = ({
  size = 48,
  interactive = true,
  showText = false,
  subtitle = "Safety Intelligence",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse tracking for pupil
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 200 };
  const pupilX = useSpring(mouseX, springConfig);
  const pupilY = useSpring(mouseY, springConfig);

  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDist = 7; // Max pupil offset in px

      if (dist > 0) {
        const factor = Math.min(dist / 200, 1) * maxDist;
        mouseX.set((deltaX / dist) * factor);
        mouseY.set((deltaY / dist) * factor);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [interactive, mouseX, mouseY]);

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div
        ref={containerRef}
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Rotating Aperture Ring */}
          <g className="origin-center">
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="rgba(198, 117, 43, 0.35)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
            <circle
              cx="50"
              cy="50"
              r="41"
              stroke="rgba(74, 122, 155, 0.3)"
              strokeWidth="1"
              strokeDasharray="16 28"
            />
            {/* Tech tick marks */}
            <line x1="50" y1="2" x2="50" y2="6" stroke="#C6752B" strokeWidth="2" />
            <line x1="50" y1="94" x2="50" y2="98" stroke="#C6752B" strokeWidth="2" />
            <line x1="2" y1="50" x2="6" y2="50" stroke="#C6752B" strokeWidth="2" />
            <line x1="94" y1="50" x2="98" y2="50" stroke="#C6752B" strokeWidth="2" />
          </g>

          {/* Eye Almond Contour */}
          <path
            d="M 12 50 C 26 26, 74 26, 88 50 C 74 74, 26 74, 12 50 Z"
            stroke="rgba(198, 117, 43, 0.8)"
            strokeWidth="2.5"
            fill="#211D17"
          />

          {/* Inner Glowing Iris */}
          <defs>
            <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C6752B" stopOpacity="1" />
              <stop offset="55%" stopColor="#B26521" stopOpacity="0.9" />
              <stop offset="85%" stopColor="#4A7A9B" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#16140F" stopOpacity="1" />
            </radialGradient>
            <filter id="irisGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <circle
            cx="50"
            cy="50"
            r="19"
            fill="url(#irisGrad)"
            filter="url(#irisGlowFilter)"
          />

          {/* Iris Reticle Rings */}
          <circle
            cx="50"
            cy="50"
            r="15"
            stroke="rgba(243, 239, 230, 0.35)"
            strokeWidth="0.75"
            strokeDasharray="2 3"
          />
        </svg>

        {/* Interactive Pupil tracking mouse */}
        <motion.div
          className="absolute w-[14px] h-[14px] rounded-full bg-[#16140F] border border-copper shadow-[0_0_8px_rgba(198,117,43,0.9)] flex items-center justify-center pointer-events-none"
          style={{
            x: pupilX,
            y: pupilY,
          }}
        >
          {/* Pupil Glint */}
          <div className="w-1 h-1 rounded-full bg-white opacity-90 -translate-x-0.5 -translate-y-0.5" />
        </motion.div>
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="leading-tight">
          <div className="font-display font-black text-sm tracking-[0.08em] uppercase text-text-primary flex items-center gap-1.5">
            <span>ARGUS</span>
            <span className="text-copper font-extrabold">AI</span>
          </div>
          <div className="font-sans text-[9px] font-medium tracking-[0.08em] text-text-secondary uppercase">
            {subtitle}
          </div>
        </div>
      )}
    </div>
  );
};
