'use client';
import { useEffect } from 'react';
import gsap from 'gsap';

export function GSAPInitializer() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      gsap.globalTimeline.timeScale(Infinity);
    }
  }, []);
  return null;
}
