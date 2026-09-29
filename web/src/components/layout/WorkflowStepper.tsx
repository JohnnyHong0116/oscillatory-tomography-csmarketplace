import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { StepId } from '../../types/aquifer';

interface WorkflowStepperProps {
  currentStep: StepId;
  completedSteps: Set<StepId>;
  onSelectStep: (step: StepId) => void;
}

const STEPS: { id: StepId; label: string; subLabel: string }[] = [
  { id: 1, label: '1. Select Test Case', subLabel: 'Choose workflow' },
  { id: 2, label: '2. Configure Model', subLabel: 'Grid, wells & boundaries' },
  { id: 3, label: '3. Review Inputs', subLabel: 'Validate parameters' },
  { id: 4, label: '4. Run Analysis', subLabel: 'Python solver execution' },
  { id: 5, label: '5. Explore Results', subLabel: 'Computed responses & fields' },
];

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  completedSteps,
  onSelectStep,
}) => {
  return (
    <div className="bg-[#121212] border-b border-[#2A2A2A] px-4 py-2 text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar space-x-1 sm:space-x-2">
        {STEPS.map((step, index) => {
          const isCurrent = currentStep === step.id;
          const isCompleted = completedSteps.has(step.id);

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onSelectStep(step.id)}
                className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-lg border transition text-left flex-shrink-0 focus-ring ${
                  isCurrent
                    ? 'bg-[#2A1215] border-[#C5050C] text-white shadow-xs'
                    : isCompleted
                    ? 'bg-[#1C1C1C] border-[#383838] text-white hover:border-[#C5050C]'
                    : 'bg-[#181818] border-[#2A2A2A] text-[#888888] hover:border-[#444444] hover:text-slate-300'
                }`}
              >
                {/* Step Icon Badge */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    isCurrent
                      ? 'bg-[#C5050C] text-white'
                      : isCompleted
                      ? 'bg-[#15803D] text-white'
                      : 'bg-[#2A2A2A] text-[#888888] border border-[#3A3A3A]'
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    step.id
                  )}
                </div>

                {/* Step Labels */}
                <div className="hidden lg:block">
                  <div
                    className={`text-xs font-semibold leading-tight ${
                      isCurrent ? 'text-white font-bold' : isCompleted ? 'text-slate-200' : 'text-[#888888]'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[10px] text-[#A7ADB1] font-normal">
                    {step.subLabel}
                  </div>
                </div>

                <div className="block lg:hidden text-xs font-semibold">
                  {step.id}. {step.label.split(' ')[1]}
                </div>
              </button>

              {index < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[#444444] flex-shrink-0 hidden md:block" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
