import React from 'react';
import { Download, Sliders, Box, Terminal, Sparkles, FolderArchive } from 'lucide-react';

interface HeaderProps {
  activeTab: 'viewport' | 'package' | 'python' | 'guide';
  onTabChange: (tab: 'viewport' | 'package' | 'python' | 'guide') => void;
  onExportVRMA: () => void;
  onOpenBoneMapper: () => void;
  hasActiveAnimation: boolean;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onExportVRMA,
  onOpenBoneMapper,
  hasActiveAnimation,
  isProcessing,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Single element brand wordmark */}
      <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-sm font-bold text-sm">
          U2V
        </div>
        <a href="/" className="text-base font-bold tracking-tight text-white whitespace-nowrap">
          Unity2VRMA Studio
        </a>
      </div>

      {/* Zone 2: 4 Clean single-line nav tabs */}
      <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
        <button
          onClick={() => onTabChange('viewport')}
          className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'viewport'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          Visualizador 3D
        </button>

        <button
          onClick={() => onTabChange('package')}
          className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'package'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          Explorador de Pacote
        </button>

        <button
          onClick={() => onTabChange('python')}
          className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'python'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          Automação Python
        </button>

        <button
          onClick={() => onTabChange('guide')}
          className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeTab === 'guide'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          Guia Mecanim vs VRMA
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenBoneMapper}
          title="Configurar Mapeamento de Ossos"
          className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors hidden sm:flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Mapear Ossos</span>
        </button>

        <button
          onClick={onExportVRMA}
          disabled={!hasActiveAnimation || isProcessing}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center gap-2 shadow-md hover:shadow-indigo-500/25 whitespace-nowrap shrink-0 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Exportar .vrma</span>
        </button>
      </div>
    </header>
  );
};
