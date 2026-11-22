import { useEffect, useRef } from "react";
import "./VyraCursor.css";

export default function VyraCursor() {
  const cursor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)"
    );

    if (!media.matches) return;

    const root = document.documentElement;
    root.classList.add("vyra-flip-enabled");

    let x = -100;
    let y = -100;
    let px = -100;
    let py = -100;
    let frame = 0;

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;

      x = e.clientX;
      y = e.clientY;

      const element = e.target instanceof Element ? e.target : null;
      const interactive = !!element?.closest(
        "a, button, [role='button'], select"
      );
      const textInput = !!element?.closest(
        "input, textarea, [contenteditable='true']"
      );

      const node = cursor.current;
      if (!node) return;

      node.classList.toggle("is-visible", !textInput);
      node.classList.toggle("is-action", interactive);
    };

    const down = () => cursor.current?.classList.add("is-pressed");
    const up = () => cursor.current?.classList.remove("is-pressed");
    const hide = () => cursor.current?.classList.remove("is-visible");

    const animate = () => {
      px += (x - px) * 0.48;
      py += (y - py) * 0.48;

      if (cursor.current) {
        cursor.current.style.transform =
          `translate3d(${px}px, ${py}px, 0)`;
      }

      frame = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);

    frame = requestAnimationFrame(animate);

    return () => {
      root.classList.remove("vyra-flip-enabled");
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <div ref={cursor} className="vyra-flip-cursor" aria-hidden="true">
      <div className="vyra-flip-shape">
        <svg viewBox="0 0 70 78" width="100%" height="100%">
          <path
            className="flip-front"
            d="M4 3 L48 24 L29 34 L19 65 Z"
          />
          <path
            className="flip-fold"
            d="M29 34 L48 24 L63 52 L39 44 Z"
          />
          <path
            className="flip-edge"
            d="M19 65 L29 34 L39 44 L28 75 Z"
          />
        </svg>
      </div>
      <div className="vyra-flip-ticket">
        <span>GO</span>
        <span className="vyra-flip-arrow">↗</span>
      </div>
    </div>
  );
}