import React from 'react';
import { X, Info, Layers } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#121212]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white text-[#121212] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-[#D6DADD]">
        <div className="p-4 bg-[#121212] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-5 h-5 text-[#C5050C]" />
            <h2 className="font-bold text-sm">About Aquifer Imaging Studio</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#A7ADB1] hover:text-white rounded hover:bg-[#2A2A2A] transition focus-ring"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs leading-relaxed bg-white">
          <div className="flex items-center space-x-3 bg-[#F1F2F3] p-3 rounded-lg border border-[#D6DADD]">
            <div className="w-10 h-10 rounded bg-[#C5050C] text-white font-black flex items-center justify-center text-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#121212]">Aquifer Imaging Studio</div>
              <div className="text-[11px] text-[#6B7074] font-mono">
                Version 1.1.0-proto &bull; UW–Madison Geoscience
              </div>
            </div>
          </div>

          <p className="text-[#4B4F52]">
            Developed for the <strong>University of Wisconsin–Madison Department of Geoscience</strong>.
          </p>

          <p className="text-[#6B7074]">
            This prototype presents an intuitive graphical environment transcribed from MATLAB and Python workflow scripts, enabling geoscience researchers and students to configure, simulate, and analyze oscillatory hydraulic tomography experiments without editing backend source code.
          </p>

          <div className="bg-[#FEF2F2] border border-[#FECDD3] text-[#121212] p-3 rounded-lg text-[11px] font-mono">
            <strong className="text-[#C5050C]">UW Department of Geoscience</strong>
            <br />
            Weeks Hall, 1215 W Dayton St, Madison, WI 53706
          </div>
        </div>
      </div>
    </div>
  );
};
