"use client";

import { useEffect, useRef, useState } from "react";

const HEALTH_VIDEOS = [
  "2vWAOAVqGlU",
  "gUWJ-6nL5-8",
  "VvLtwcpa7GA",
  "tMCbqTG1-AQ",
  "gRWSyqatWQQ",
  "zx52frblWRI",
];

type YTPlayer = {
  destroy: () => void;
  mute: () => void;
  playVideo: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      if (!window.YT?.Player) return;
      window.clearInterval(timer);
      resolve();
    }, 50);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearInterval(timer);
      resolve();
    };
    if (!document.querySelector("script[data-yt-iframe]")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.ytIframe = "1";
      document.head.appendChild(script);
    }
  });
}

export function HeroVideo() {
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "playing" | "off">("loading");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStatus("off");
      return;
    }

    let cancelled = false;
    let active: YTPlayer | null = null;
    let attemptTimer = 0;
    const pool = [...HEALTH_VIDEOS].sort(() => Math.random() - 0.5);
    let index = 0;

    const next = () => {
      index += 1;
      if (index >= pool.length) {
        setStatus("off");
        return;
      }
      start(pool[index]);
    };

    const start = (id: string) => {
      const slot = mount.current;
      if (!slot || !window.YT || cancelled) return;
      active?.destroy();
      slot.replaceChildren();
      const holder = document.createElement("div");
      slot.appendChild(holder);
      window.clearTimeout(attemptTimer);
      attemptTimer = window.setTimeout(next, 12000);
      active = new window.YT.Player(holder, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          loop: 1,
          playlist: id,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            event.target.mute();
            event.target.playVideo();
          },
          onStateChange: (event: { data: number; target: YTPlayer }) => {
            const state = window.YT?.PlayerState;
            if (!state) return;
            if (event.data === state.PLAYING) {
              window.clearTimeout(attemptTimer);
              setStatus("playing");
              return;
            }
            if (event.data === state.ENDED) event.target.playVideo();
          },
          onError: () => {
            next();
          },
        },
      });
    };

    loadYouTube().then(() => {
      if (!cancelled) start(pool[0]);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(attemptTimer);
      active?.destroy();
    };
  }, []);

  return (
    <>
      <div className={status === "playing" ? "hero-media is-playing" : "hero-media"} aria-hidden="true">
        <div className="hero-player" ref={mount} />
        <div className="hero-shade" />
      </div>
      {status === "loading" ? (
        <div className="hero-loader" role="status">
          <span className="hero-spinner" />
          Загружаем видео
        </div>
      ) : null}
    </>
  );
}
