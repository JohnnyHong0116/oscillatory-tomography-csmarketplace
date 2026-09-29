import React from 'react';
import {
  Layers,
  Activity,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { TestCaseType } from '../../types/aquifer';

interface Step1Props {
  selectedTestCase: TestCaseType;
  onSelectTestCase: (type: TestCaseType) => void;
  onNext: () => void;
}

export const Step1SelectTestCase: React.FC<Step1Props> = ({
  selectedTestCase,
  onSelectTestCase,
  onNext,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Introduction Banner */}
      <div className="bg-white border border-[#D6DADD] rounded-xl p-5 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-[#FEF2F2] border border-[#FECDD3] text-[#C5050C] text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#C5050C]" />
              <span>Step 1: Select Tomography Preset</span>
            </div>
            <h2 className="text-xl font-bold text-[#121212] tracking-tight">
              Select Test Case Configuration
            </h2>
            <p className="text-xs text-[#4B4F52] mt-1 max-w-3xl leading-relaxed">
              Run the translated Python workflows with real solver progress, field reconstruction, diagnostics, and multi-test response plots.
            </p>
          </div>
        </div>
      </div>

      {/* Test Case Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: P = 10s 2-D Geostatistical Inversion */}
        <div
          onClick={() => onSelectTestCase('inversion_10s')}
          className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all flex flex-col justify-between ${
            selectedTestCase === 'inversion_10s'
              ? 'bg-[#FEF2F2]/40 text-[#121212] border-[#C5050C] shadow-md ring-2 ring-[#C5050C]/10'
              : 'bg-white text-[#121212] border-[#D6DADD] hover:border-[#A7ADB1] hover:shadow-xs'
          }`}
        >
          {selectedTestCase === 'inversion_10s' && (
            <div className="absolute -top-3 right-4 bg-[#C5050C] text-white font-bold text-[11px] px-3 py-0.5 rounded-full shadow-xs flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ACTIVE SELECTION</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  selectedTestCase === 'inversion_10s'
                    ? 'bg-[#C5050C] text-white'
                    : 'bg-[#F1F2F3] text-[#4B4F52] border border-[#D6DADD]'
                }`}
              >
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[#C5050C]">
                  Primary Inversion Workflow
                </span>
                <h3 className="text-base font-bold leading-tight text-[#121212]">
                  P = 10 s Multi-Test Tomography
                </h3>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#4B4F52]">
              Faithful 50×50 reconstruction of the original P = 10 s geostatistical case: nine wells, 36 responses, checkerboard truth, and joint inversion.
            </p>

            <div className="space-y-2 pt-2 border-t border-[#D6DADD]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7074]">
                Key Workflow Features:
              </div>
              <ul className="space-y-1.5 text-xs text-[#121212]">
                {[
                  'Runs all eight original pumping configurations',
                  'Displays true and estimated ln(K) and ln(S_s) fields',
                  'Maps estimation error and final-Jacobian sensitivity',
                  'Plots response fit, residuals, and inversion convergence',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-[#C5050C]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-[#D6DADD] flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#6B7074]">
              50×50 cells · 9 wells · 36 responses
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectTestCase('inversion_10s');
                onNext();
              }}
              className="flex items-center space-x-1.5 bg-[#C5050C] hover:bg-[#9B0000] text-white px-3.5 py-1.5 rounded text-xs font-bold transition focus-ring"
            >
              <span>Load Configuration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: Multi-frequency Black–Kipp Analytical Comparison */}
        <div
          onClick={() => onSelectTestCase('black_kipp')}
          className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all flex flex-col justify-between ${
            selectedTestCase === 'black_kipp'
              ? 'bg-[#FEF2F2]/40 text-[#121212] border-[#C5050C] shadow-md ring-2 ring-[#C5050C]/10'
              : 'bg-white text-[#121212] border-[#D6DADD] hover:border-[#A7ADB1] hover:shadow-xs'
          }`}
        >
          {selectedTestCase === 'black_kipp' && (
            <div className="absolute -top-3 right-4 bg-[#C5050C] text-white font-bold text-[11px] px-3 py-0.5 rounded-full shadow-xs flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ACTIVE SELECTION</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  selectedTestCase === 'black_kipp'
                    ? 'bg-[#C5050C] text-white'
                    : 'bg-[#F1F2F3] text-[#4B4F52] border border-[#D6DADD]'
                }`}
              >
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[#C5050C]">
                  Validation & Theory Suite
                </span>
                <h3 className="text-base font-bold leading-tight text-[#121212]">
                  Multi-frequency Black–Kipp Comparison
                </h3>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#4B4F52]">
              Frequency-response benchmarking over nine pumping periods from 10 to 10,000 s, comparing the numerical solver with the Black–Kipp analytical solution.
            </p>

            <div className="space-y-2 pt-2 border-t border-[#D6DADD]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7074]">
                Key Workflow Features:
              </div>
              <ul className="space-y-1.5 text-xs text-[#121212]">
                {[
                  'Runs a nine-period interactive subset of the MATLAB sweep',
                  'Compares numerical vs exact analytical amplitude attenuation',
                  'Compares numerical vs analytical phase delay Δφ',
                  'Plots amplitude, phase, and three effective properties',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-[#C5050C]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-[#D6DADD] flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#6B7074]">
              60×60 cells · 5 wells · 9 periods
            </span>
            <button
              onClick={(event) => { event.stopPropagation(); onSelectTestCase('black_kipp'); onNext(); }}
              className="flex items-center space-x-1.5 bg-[#C5050C] hover:bg-[#9B0000] text-white px-3.5 py-1.5 rounded text-xs font-bold"
            >
              <span>Load Configuration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: Disabled Field Data Card */}
      <div className="bg-[#F1F2F3] border border-dashed border-[#D6DADD] rounded-xl p-5 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#E1E5E7] text-[#6B7074] border border-[#D6DADD] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-[#4B4F52]">
                  Field Data Analysis — Planned
                </h3>
                <span className="bg-[#E1E5E7] text-[#4B4F52] border border-[#A7ADB1] text-[10px] font-semibold px-2 py-0.5 rounded">
                  Phase 2 Roadmap
                </span>
              </div>
              <p className="text-xs text-[#6B7074] mt-0.5">
                Direct integration with high-frequency pressure transducer datalogger feeds, irregular well field geometries, and real-time noise filtering.
              </p>
            </div>
          </div>
          <button
            disabled
            className="hidden sm:flex items-center space-x-1 bg-[#E1E5E7] text-[#6B7074] px-3 py-1.5 rounded text-xs font-medium cursor-not-allowed border border-[#D6DADD]"
          >
            <span>Disabled</span>
          </button>
        </div>
      </div>

      {/* Bottom Step Actions */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="flex items-center space-x-2 bg-[#C5050C] hover:bg-[#9B0000] text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-xs transition focus-ring"
        >
          <span>Proceed to Model Configuration</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
