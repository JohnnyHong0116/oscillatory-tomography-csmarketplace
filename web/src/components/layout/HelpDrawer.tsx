import React, { useState } from 'react';
import { X, Search, BookOpen, HelpCircle } from 'lucide-react';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GlossaryItem {
  term: string;
  symbol?: string;
  unit?: string;
  category: string;
  definition: string;
  details: string;
}

const GLOSSARY: GlossaryItem[] = [
  {
    term: 'ln(K)',
    symbol: 'ln(K)',
    unit: 'ln(m/s)',
    category: 'Parameters',
    definition: 'Natural logarithm of hydraulic conductivity K.',
    details:
      'Hydraulic conductivity measures the ease with which water moves through pore spaces or fractures. Logging K enforces positivity and models log-normal hydraulic conductivity distributions common in natural aquifers.',
  },
  {
    term: 'ln(Ss)',
    symbol: 'ln(S_s)',
    unit: 'ln(1/m)',
    category: 'Parameters',
    definition: 'Natural logarithm of specific storage S_s.',
    details:
      'Specific storage is the volume of water released from storage per unit volume of aquifer per unit decline in hydraulic head. In oscillatory tests, S_s governs phase attenuation and time lag.',
  },
  {
    term: 'Pumping Period',
    symbol: 'P',
    unit: 'seconds (s)',
    category: 'Testing',
    definition: 'Oscillation cycle duration of the sinusoidal pumping signal.',
    details:
      'Sinusoidal water withdrawal/injection creates periodic pressure waves. High-frequency (short P) waves decay rapidly and probe near-well regions, while low-frequency (long P) waves penetrate deep into the domain.',
  },
  {
    term: 'Jacobian Matrix',
    symbol: 'J',
    unit: 'm / parameter',
    category: 'Inversion',
    definition: 'Matrix of sensitivities (partial derivatives ∂h_i / ∂m_j).',
    details:
      'The Jacobian represents how sensitive the observed hydraulic head response at well i is to changes in spatial parameter m_j. It is computed via adjoint state methods or finite differences for Gauss-Newton optimization.',
  },
  {
    term: 'Correlation Length',
    symbol: 'l_x, l_y',
    unit: 'meters (m)',
    category: 'Geostatistics',
    definition: 'Spatial autocorrelation distance in prior covariance matrix Q_ss.',
    details:
      'Specifies the distance over which aquifer parameter fluctuations remain spatially correlated. Larger correlation lengths impose smoother spatial parameter continuity.',
  },
  {
    term: 'Peak Memory',
    symbol: 'RAM',
    unit: 'Megabytes (MB)',
    category: 'Computing',
    definition: 'Peak RAM required during Jacobian storage and matrix inversions.',
    details:
      'Inversion requires solving dense linear systems involving J^T * W * J + Q_ss^-1. For a grid of Nx*Ny cells and M observations, memory scales with O(N * M) or O(N^2).',
  },
  {
    term: 'Data-Error Variance',
    symbol: 'σ_d^2',
    unit: 'm^2',
    category: 'Inversion',
    definition: 'Assumed variance of pressure transducer noise.',
    details:
      'Used to construct the data weighting matrix W = (1/σ_d^2) * I. Controls the trade-off between fitting noisy head observations and respecting the prior geostatistical model.',
  },
  {
    term: 'Oscillatory Hydraulic Tomography',
    category: 'Theory',
    definition: 'Periodic hydraulic testing method for 2-D/3-D spatial imaging.',
    details:
      'Instead of pumping to steady-state or step-drawdown, a periodic flow rate Q(t) = Q_0 sin(2π t / P) is applied. Phase lag and amplitude ratio at multiple observation wells allow high-resolution tomographic inversion without net fluid extraction.',
  },
  {
    term: 'Black–Kipp Analytical Solution',
    category: 'Theory',
    definition: 'Closed-form analytical solution for periodic flow in homogeneous radial aquifers.',
    details:
      'Provides exact solutions for pressure wave propagation in radial aquifers. Used as a benchmark to compare finite-difference numerical models against theoretical amplitude and phase curves.',
  },
];

export const HelpDrawer: React.FC<HelpDrawerProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = ['All', 'Parameters', 'Testing', 'Inversion', 'Geostatistics', 'Theory', 'Computing'];

  const filtered = GLOSSARY.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.details.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-[#121212] border-l border-[#2A2A2A] text-white shadow-2xl z-40 flex flex-col transition-all">
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#0A0A0A]">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-[#C5050C]" />
          <h2 className="font-bold text-sm text-white">Help & Technical Glossary</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 border-b border-[#2A2A2A] bg-[#121212] space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#A7ADB1]" />
          <input
            type="text"
            placeholder="Search terms (e.g., ln(K), Jacobian)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1C1C1C] border border-[#3A3A3A] text-xs rounded pl-8 pr-3 py-2 text-white focus:border-[#C5050C] outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[10px] px-2 py-0.5 rounded transition ${
                selectedCategory === cat
                  ? 'bg-[#C5050C] text-white font-bold'
                  : 'bg-[#1C1C1C] text-[#A7ADB1] hover:bg-[#2A2A2A] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Terms List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[#A7ADB1]">
            No terms found matching "{searchTerm}".
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.term}
              className="bg-[#181818] border border-[#2A2A2A] rounded-lg p-3 space-y-2 hover:border-[#444444] transition"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white text-sm flex items-center space-x-1.5">
                  <span>{item.term}</span>
                  {item.symbol && (
                    <span className="text-[11px] font-mono text-[#A7ADB1] bg-[#121212] border border-[#2A2A2A] px-1 py-0.2 rounded">
                      {item.symbol}
                    </span>
                  )}
                </div>
                {item.unit && (
                  <span className="text-[10px] text-[#C5050C] font-mono font-bold">
                    [{item.unit}]
                  </span>
                )}
              </div>

              <div className="text-slate-200 font-medium leading-relaxed">
                {item.definition}
              </div>

              <p className="text-[#A7ADB1] text-[11px] leading-normal pt-1 border-t border-[#2A2A2A]">
                {item.details}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-[#2A2A2A] bg-[#0A0A0A] text-[11px] text-[#A7ADB1] flex items-center justify-between">
        <span className="flex items-center space-x-1">
          <HelpCircle className="w-3.5 h-3.5 text-[#C5050C]" />
          <span>UW Geoscience Reference</span>
        </span>
        <span className="text-[10px] font-mono text-[#A7ADB1]">Cardiff et al.</span>
      </div>
    </div>
  );
};
