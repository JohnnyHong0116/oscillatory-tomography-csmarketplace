import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { ContextInspectionPanel } from './PlotInspection';

/** Enlarge the live chart in place: no remount, duplicated data, or lost selection. */
export function ExpandablePlot({ title, children, square = false, showInspection = false, inspectionPanel }: {
  title: string; children: React.ReactNode; square?: boolean; showInspection?: boolean;
  inspectionPanel?: (expanded: boolean) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inlineHeight, setInlineHeight] = useState<number>();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded || !root.current) return;
    // Make everything outside the viewer inert, including controls in the same card.
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = root.current;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          siblings.push({ element: sibling, inert: sibling.inert }); sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const scroller = root.current.closest('main');
    const oldOverflow = scroller?.style.overflow;
    if (scroller) scroller.style.overflow = 'hidden';
    close.current?.focus({ preventScroll: true });
    return () => {
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      if (scroller) scroller.style.overflow = oldOverflow ?? '';
      trigger.current?.focus({ preventScroll: true });
    };
  }, [expanded]);
  return <div className="group relative min-w-0" style={expanded ? { height: inlineHeight } : undefined}>
  <div ref={root} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined}
    aria-label={expanded ? `${title} enlarged plot` : undefined}
    className={expanded ? 'fixed inset-0 z-[100] flex flex-col bg-slate-100 text-slate-900' : 'group relative min-w-0'}
    onKeyDownCapture={event => {
      // Escape closes the viewer without clearing the chart's existing pinned selection.
      if (expanded && event.key === 'Escape') { event.stopPropagation(); setExpanded(false); }
    }}
    onKeyDown={event => {
      if (!expanded) return;
      if (event.key === 'Tab') {
        const targets = Array.from(root.current!.querySelectorAll<HTMLElement>('button, [tabindex="0"], summary, a[href]'))
          .filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    {expanded && <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-white px-5 py-3 shadow-sm">
      <div><h2 className="text-base font-bold">{title}</h2><p className="text-xs text-slate-500">Enlarged view · hover or click to inspect</p></div>
      <button ref={close} type="button" onClick={() => setExpanded(false)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-100 focus-ring" aria-label="Close enlarged plot"><X size={18} /> Close</button>
    </header>}
    <div className={expanded ? 'min-h-0 flex-1 overflow-auto p-4 sm:p-6' : ''}>
      <div className={expanded ? 'mx-auto grid w-full max-w-[1800px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]' : ''}>
        <div className={expanded ? `min-w-0 w-full mx-auto ${square ? 'max-w-[min(78vh,900px)]' : ''}` : ''}>{children}</div>
        {(inspectionPanel || (expanded && showInspection)) && <aside aria-label="Plot inspection details"
          className={expanded ? 'min-w-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto' : ''}>
          {inspectionPanel ? inspectionPanel(expanded) : <ContextInspectionPanel compact />}
        </aside>}
      </div>
    </div>
    {!expanded && <button ref={trigger} type="button" onClick={() => { setInlineHeight(root.current?.getBoundingClientRect().height); setExpanded(true); }}
      aria-label={`Enlarge ${title}`} title="Enlarge plot"
      className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300/60 bg-white/70 text-slate-700 shadow-sm backdrop-blur-sm opacity-0 transition duration-200 hover:bg-white/95 hover:scale-105 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-ring [@media(hover:none)]:opacity-100 motion-reduce:transition-none motion-reduce:hover:scale-100"><Maximize2 size={17} /></button>}
  </div></div>;
}
