import React from 'react';
import {
  PlusCircle,
  BarChart3,
  BookOpen,
  Info,
  ChevronLeft,
  ChevronRight,
  Database,
  Activity,
  Layers,
  FlaskConical,
} from 'lucide-react';
import { StepId } from '../../types/aquifer';

interface SidebarProps {
  currentStep: StepId;
  onNavigateStep: (step: StepId) => void;
  onOpenDocs: () => void;
  onOpenAbout: () => void;
  onOpenExamples: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  onNavigateStep,
  onOpenDocs,
  onOpenAbout,
  onOpenExamples,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`bg-[#121212] border-r border-[#2A2A2A] text-[#E1E5E7] flex flex-col justify-between transition-all duration-200 z-10 ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div className="p-2 space-y-4">
        {/* Collapse button */}
        <div className="flex justify-end mb-1">
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Action Button: Badger Red */}
        <div className="space-y-1">
          <button
            onClick={() => onNavigateStep(1)}
            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-bold transition focus-ring ${
              currentStep === 1
                ? 'bg-[#C5050C] text-white shadow-xs'
                : 'bg-[#C5050C] text-white hover:bg-[#9B0000]'
            }`}
          >
            <PlusCircle className="w-4 h-4 flex-shrink-0 text-white" />
            {!isCollapsed && <span>New Analysis</span>}
          </button>
        </div>

        <hr className="border-[#2A2A2A]" />

        {/* Navigation Steps */}
        <nav className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1 text-[10px] font-bold text-[#A7ADB1] uppercase tracking-wider">
              Workflow Steps
            </div>
          )}

          {[
            { id: 1, label: '1. Select Test Case', icon: FlaskConical },
            { id: 2, label: '2. Configure Model', icon: Layers },
            { id: 3, label: '3. Review Inputs', icon: Database },
            { id: 4, label: '4. Run Analysis', icon: Activity },
            { id: 5, label: '5. Explore Results', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = currentStep === item.id;
            const isLocked = item.id > currentStep;
            return (
              <button
                key={item.id}
                onClick={() => onNavigateStep(item.id as StepId)}
                disabled={isLocked}
                aria-current={isSelected ? 'step' : undefined}
                aria-label={item.label}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs transition focus-ring ${
                  isSelected
                    ? 'bg-[#2A1215] text-white font-semibold border-l-3 border-[#C5050C]'
                    : isLocked
                    ? 'text-[#6B7074] opacity-50 cursor-not-allowed'
                    : 'text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A]'
                }`}
                title={isLocked ? `${item.label} — use the Continue button to proceed` : item.label}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isSelected ? 'text-[#C5050C]' : 'text-[#A7ADB1]'
                  }`}
                />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <hr className="border-[#2A2A2A]" />

        {/* Auxiliary Links */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1 text-[10px] font-bold text-[#A7ADB1] uppercase tracking-wider">
              Resources
            </div>
          )}

          <button
            onClick={onOpenExamples}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title="Example Cases"
          >
            <FlaskConical className="w-4 h-4 flex-shrink-0 text-[#C5050C]" />
            {!isCollapsed && <span>Example Cases</span>}
          </button>

          <button
            onClick={onOpenDocs}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title="Documentation"
          >
            <BookOpen className="w-4 h-4 flex-shrink-0 text-[#A7ADB1]" />
            {!isCollapsed && <span>Documentation</span>}
          </button>

          <button
            onClick={onOpenAbout}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title="About Project"
          >
            <Info className="w-4 h-4 flex-shrink-0 text-[#A7ADB1]" />
            {!isCollapsed && <span>About Studio</span>}
          </button>
        </div>
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-[#2A2A2A] bg-[#0A0A0A] text-[11px] text-[#A7ADB1]">
          <div className="font-semibold text-white">UW–Madison Geoscience</div>
          <div>Department of Geoscience</div>
          <div className="text-[10px] text-[#6B7074] mt-0.5">Oscillatory Tomography</div>
        </div>
      )}
    </aside>
  );
};
