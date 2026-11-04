"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { HeroVideo } from "./HeroVideo";

export function HeroParallax({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const visual = el.querySelector<HTMLElement>(".hero-visual");
    let frame = 0;

    const paint = () => {
      const y = window.scrollY;
      if (visual) visual.style.transform = `translate3d(0, ${Math.min(y, 420) * -0.12}px, 0)`;
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section className="hero" ref={root}>
      <HeroVideo />
      {children}
    </section>
  );
}
