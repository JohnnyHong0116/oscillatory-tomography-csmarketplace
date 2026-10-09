import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface BackToTopButtonProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

/** Listen to the workspace, not the window: this app scrolls inside <main>. */
export const BackToTopButton: React.FC<BackToTopButtonProps> = ({ scrollContainerRef }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const workspace = scrollContainerRef.current;
    if (!workspace) return;
    const updateVisibility = () => setVisible(workspace.scrollTop > 200);
    updateVisibility();
    workspace.addEventListener('scroll', updateVisibility, { passive: true });
    return () => workspace.removeEventListener('scroll', updateVisibility);
  }, [scrollContainerRef]);

  const returnToTop = () => {
    const workspace = scrollContainerRef.current;
    if (!workspace) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    workspace.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // Move keyboard focus out of the button before it disappears at the top.
    workspace.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={returnToTop}
      aria-label="Back to top of test setup"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`group absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex h-11 items-center justify-center rounded-full border border-white/30 bg-slate-700/70 px-3 text-sm font-semibold text-white shadow-lg backdrop-blur-md hover:bg-slate-700/90 focus-visible:bg-slate-700/90 focus-ring transition-all duration-300 motion-reduce:transition-none ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <ArrowUp className="h-5 w-5 shrink-0" aria-hidden="true" />
      {/* Width and spacing animate together so the resting button is circular.
          Focus and touch devices reveal the same label without requiring a mouse. */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-32 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-32 group-focus-visible:opacity-100 [@media(hover:none)]:ml-2 [@media(hover:none)]:max-w-32 [@media(hover:none)]:opacity-100 motion-reduce:transition-none">
        Back to top
      </span>
    </button>
  );
};
