import React from 'react';
import { Layers, HelpCircle, RotateCcw } from 'lucide-react';

interface HeaderProps {
  title: string;
  disabled?: boolean;
  onReset: () => void;
  onToggleHelp: () => void;
  isHelpOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  disabled = false,
  onReset,
  onToggleHelp,
  isHelpOpen,
}) => {
  return (
    <header className="shrink-0 bg-[#121212] text-white border-b border-[#2A2A2A] shadow-xs relative z-20">
      {/* UW–Madison Brand Top Red Accent Stripe */}
      <div className="h-1 bg-[#C5050C] w-full" />

      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5">
        {/* Brand & UW Madison Title */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded bg-[#C5050C] text-white shadow-xs font-black text-base">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-bold text-white text-sm sm:text-base tracking-tight leading-none">
                Aquifer Imaging Studio
              </h1>
              <span className="hidden shrink-0 sm:inline bg-[#2A2A2A] text-[#E1E5E7] border border-[#3A3A3A] text-[10px] font-mono font-medium px-1.5 py-0.2 rounded">
                v1.3.0
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-[#A7ADB1] font-medium mt-0.5">
              University of Wisconsin–Madison &bull; Department of Geoscience
            </p>
          </div>
        </div>

        {/* Active Case Tag */}
        <div className="hidden lg:flex items-center space-x-2 bg-[#2A2A2A] border border-[#3A3A3A] rounded px-3 py-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-[#A7ADB1]">Workspace:</span>
          <span className="text-xs font-semibold text-white">{title}</span>
        </div>

        {/* Quick Action Tools */}
        <div className="flex shrink-0 items-center space-x-2">
          {/* Secondary Buttons: White with neutral border & black text */}
          <button
            onClick={onReset}
            disabled={disabled}
            aria-label="Reset workflow"
            className="flex items-center space-x-1.5 text-xs bg-white text-[#121212] hover:bg-[#F1F2F3] border border-[#D6DADD] px-2.5 py-1.5 rounded font-semibold transition focus-ring disabled:opacity-40"
            title="Reset Workflow to Default"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#4B4F52]" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={onToggleHelp}
            aria-label="Help & Glossary"
            aria-expanded={isHelpOpen}
            aria-controls="help-glossary-panel"
            className={`flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition focus-ring ${
              isHelpOpen
                ? 'bg-[#C5050C] text-white border border-[#C5050C] shadow-xs'
                : 'bg-white text-[#121212] hover:bg-[#F1F2F3] border border-[#D6DADD]'
            }`}
            title="Toggle Contextual Technical Help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Help & Glossary</span>
          </button>
        </div>
      </div>
    </header>
  );
};
