import React from 'react';
import { BookOpen, BookOpenCheck, ChevronLeft, ChevronRight, FlaskConical, Info } from 'lucide-react';

interface Props {
  view: 'project' | 'examples' | 'example';
  disabled: boolean;
  onOpenProject: () => void;
  onOpenExamples: () => void;
  onOpenDocs: () => void;
  onOpenAbout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/** Height comes from the viewport-sized flex parent, not current page length.
 * Only nav content scrolls; the institutional footer stays at the bottom. */
export function Sidebar({
  view,
  disabled,
  onOpenProject,
  onOpenExamples,
  onOpenDocs,
  onOpenAbout,
  isCollapsed,
  onToggleCollapse,
}: Props) {
  return (
    <aside
      aria-label="Workspace navigation"
      className={`h-full min-h-0 shrink-0 flex flex-col border-r border-[#2A2A2A] bg-[#121212] text-[#A7ADB1] transition-[width] duration-200 motion-reduce:transition-none ${isCollapsed ? 'w-14' : 'w-48 xl:w-56'}`}
    >
      <div className="flex justify-end p-2">
        <button
          className="rounded p-2 hover:bg-[#2A2A2A] focus-ring"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 space-y-2">
        {[
          { label: 'Your experiment', icon: FlaskConical, active: view === 'project', action: onOpenProject },
          { label: 'Examples', icon: BookOpenCheck, active: view !== 'project', action: onOpenExamples },
        ].map(({ label, icon: Icon, active, action }) => (
          <button
            key={label}
            disabled={disabled}
            aria-current={active ? 'page' : undefined}
            title={label}
            onClick={action}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-semibold transition focus-ring disabled:opacity-40 ${active ? 'bg-[#C5050C] text-white' : 'hover:bg-[#2A2A2A] hover:text-white'}`}
          >
            <Icon size={18} className="shrink-0" />
            {!isCollapsed && label}
          </button>
        ))}
        <div className="my-4 border-t border-[#2A2A2A]" />
        {[
          { label: 'Documentation', icon: BookOpen, action: onOpenDocs },
          { label: 'About Studio', icon: Info, action: onOpenAbout },
        ].map(({ label, icon: Icon, action }) => (
          <button
            key={label}
            title={label}
            onClick={action}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs hover:bg-[#2A2A2A] hover:text-white focus-ring"
          >
            <Icon size={18} className="shrink-0" />
            {!isCollapsed && label}
          </button>
        ))}
      </nav>
      {!isCollapsed && (
        <footer className="shrink-0 border-t border-[#2A2A2A] p-4 text-[11px] leading-5">
          <strong className="text-white">UW–Madison Geoscience</strong>
          <p>Oscillatory Tomography</p>
          <p className="mt-2 text-[10px] text-[#777]">Projects stay in this browser session.</p>
        </footer>
      )}
    </aside>
  );
}
