"use client";

import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArgusEyeLogo } from "@/components/ArgusEyeLogo";

export function SystemBootSequence({ onComplete }: { onComplete?: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const statusStripRef = useRef<HTMLDivElement>(null);
  const cameraDotsRef = useRef<HTMLDivElement[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      router.push("/wall");
      if (onComplete) onComplete();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        router.push("/wall");
        if (onComplete) onComplete();
      },
    });

    // ── BEAT 1: BLACKOUT (0s → 0.3s)
    tl.to(overlayRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.in",
    });

    // ── BEAT 2: IDENTIFICATION (0.3s → 0.9s)
    tl.fromTo(
      brandRef.current,
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" },
      "<"
    );

    // Single iris pulse
    tl.to(
      ".boot-eye-iris",
      {
        scale: 1.08,
        duration: 0.25,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      },
      "-=0.1"
    );

    // ── BEAT 3: CAMERA ASSEMBLY (0.9s → 2.0s)
    tl.fromTo(
      statusStripRef.current,
      { scaleX: 1, transformOrigin: "left center" }, // scaleX: 1 target
      { scaleX: 1, duration: 0.35, ease: "power3.out" },
      "+=0.1"
    ).fromTo(
      statusStripRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: 0.35, ease: "power3.out" },
      "<"
    );

    cameraDotsRef.current.forEach((dot, i) => {
      tl.fromTo(
        dot,
        { opacity: 0, scale: 0, backgroundColor: "#6B6358" },
        { opacity: 1, scale: 1, duration: 0.18, ease: "back.out(3)" },
        `<+=${i * 0.14}`
      )
        .to(dot, { backgroundColor: "#FFFFFF", duration: 0.08, ease: "power4.out" })
        .to(dot, { backgroundColor: "#4A7A9B", duration: 0.20, ease: "power2.in" });
    });

    tl.fromTo(
      ".boot-status-text",
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "power2.out" },
      "-=0.3"
    );

    // ── BEAT 4: DOCK RISE (2.0s → 2.5s)
    tl.fromTo(
      dockRef.current,
      { y: 80, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
      "+=0.05"
    );

    tl.fromTo(
      ".boot-dock-active-dot",
      { x: -60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
      "-=0.2"
    );

    // ── BEAT 5: HANDOFF (2.5s → 2.8s)
    tl.to(overlayRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: "power2.out",
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] bg-[#0A0906] flex flex-col items-center justify-center opacity-0 pointer-events-auto"
    >
      <div ref={brandRef} className="flex flex-col items-center gap-4 opacity-0">
        <ArgusEyeLogo size={96} className="boot-eye-iris" interactive={false} />
        <div className="font-display font-extrabold text-xl tracking-[0.12em] uppercase text-text-primary">
          ARGUS AI — FACILITY 04
        </div>
        <div className="font-mono font-normal text-[11px] tracking-[0.08em] text-brand-accent animate-pulse">
          INITIALIZING EDGE CLUSTER 01
        </div>
      </div>

      <div
        ref={statusStripRef}
        className="absolute top-0 left-0 right-0 h-[36px] bg-[#211D17] border-b border-[#3A332A] flex items-center justify-between px-5 origin-left scale-x-0"
      >
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4].map((n, i) => (
            <div key={n} className="flex items-center gap-1.5">
              <div
                ref={(el) => {
                  if (el) cameraDotsRef.current[i] = el;
                }}
                className="w-2 h-2 rounded-full bg-[#6B6358]"
              />
              <span className="font-mono text-2xs text-text-secondary">
                CAM {String(n).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
        <div className="boot-status-text font-mono text-2xs text-text-primary font-bold">
          ● 4 Cameras Online · WS Live · System Armed
        </div>
      </div>

      <div
        ref={dockRef}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 h-[56px] px-6 rounded-full bg-[rgba(28,24,18,0.55)] backdrop-blur-2xl border border-[rgba(198,117,43,0.12)] opacity-0 flex items-center"
      >
        <div className="boot-dock-active-dot w-2 h-2 bg-brand-accent rounded-full" />
      </div>
    </div>
  );
}
