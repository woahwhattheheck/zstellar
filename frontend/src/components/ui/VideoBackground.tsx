"use client";

import { useEffect, useRef, useState } from "react";

// Two looping videos stacked; we crossfade between them when the theme changes
// by watching the `.dark` class on <html>. Both are served from /public
// (same-origin) so they pass the COEP `require-corp` policy that the cross-origin
// CDN sources would have failed. `fixed` (default) covers the viewport for the
// app; pass `fixed={false}` to contain it inside a `relative` hero section.
export function VideoBackground({ fixed = true }: { fixed?: boolean }) {
  const [isDark, setIsDark] = useState(true);
  const lightRef = useRef<HTMLVideoElement | null>(null);
  const darkRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Only the visible video runs a decode loop. The hidden one pauses but stays
  // mounted with its buffered frame, so the opacity crossfade still has pixels
  // to fade through instead of flashing black.
  useEffect(() => {
    const [visible, hidden] = isDark
      ? [darkRef.current, lightRef.current]
      : [lightRef.current, darkRef.current];
    hidden?.pause();
    void visible?.play().catch(() => {});
  }, [isDark]);

  return (
    <div
      className={`pointer-events-none z-0 ${fixed ? "fixed inset-0" : "absolute inset-0"}`}
    >
      <video
        ref={lightRef}
        aria-hidden
        muted
        loop
        playsInline
        preload="auto"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* WebM first (≈15× lighter), MP4 fallback for Safari/older browsers. */}
        <source src="/Assets/Videos/bg-light.webm" type="video/webm" />
        <source src="/Assets/Videos/bg-light.mp4" type="video/mp4" />
      </video>
      <video
        ref={darkRef}
        aria-hidden
        muted
        loop
        playsInline
        preload="auto"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
      >
        <source src="/Assets/Videos/bg-dark.webm" type="video/webm" />
        <source src="/Assets/Videos/bg-dark.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
