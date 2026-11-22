import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = { children: ReactNode };

// Keep 3D canvases off screen until the user scrolls near them.
// Once visible, keep mounted so saved progress changes remain smooth.
export default function SceneWhenVisible({ children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = host.current;
    if (!element || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      // React state update occurs from browser capability fallback only.
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '180px 0px', threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={host} className="vyra-scene-window">
      {visible ? children : <div className="vyra-scene-loading">V / LIVING VAULT</div>}
    </div>
  );
}