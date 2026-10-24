import React, { useState, useEffect } from 'react';
import { SAMPLE_ANIMATIONS } from '../services/sampleAnimations';
import { ExtractedAsset, HumanoidBoneName } from '../types';
import { ChevronDown, ChevronUp, Gauge, Activity, FolderArchive, Sparkles, Film } from 'lucide-react';

interface BottomControlsDockProps {
  currentAnimId: string;
  onSelectPreset: (id: string) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  activeBoneData?: { bone: HumanoidBoneName; rot: [number, number, number, number] };
  onQuickExport: () => void;
  hasAnimation: boolean;
  importedAssets?: ExtractedAsset[];
  onSelectAsset?: (asset: ExtractedAsset) => void;
  activeAnimationName?: string;
}

export const BottomControlsDock: React.FC<BottomControlsDockProps> = ({
  currentAnimId,
  onSelectPreset,
  playbackSpeed,
  onChangeSpeed,
  activeBoneData,
  importedAssets = [],
  onSelectAsset,
  activeAnimationName,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const animationCandidates = importedAssets.filter((a) => a.isAnimationCandidate);

  const [animSourceTab, setAnimSourceTab] = useState<'presets' | 'imported'>(() => {
    return SAMPLE_ANIMATIONS.some((p) => p.id === currentAnimId) ? 'presets' : 'imported';
  });

  // Keep tab in sync with currentAnimId
  useEffect(() => {
    if (SAMPLE_ANIMATIONS.some((p) => p.id === currentAnimId)) {
      setAnimSourceTab('presets');
    } else if (animationCandidates.some((a) => a.guid === currentAnimId)) {
      setAnimSourceTab('imported');
    }
  }, [currentAnimId, animationCandidates]);

  const presetIcons: Record<string, string> = {
    walk: '🚶',
    run: '🏃',
    wave: '👋',
    kick: '🥋',
    idle: '🧘',
    dance: '💃',
  };

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 transition-transform duration-300 w-full max-w-[min(980px,96vw)] pointer-events-auto ${
        isCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse Toggle Handle */}
      <div className="flex justify-center mb-1">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1 rounded-t-xl border border-b-0 border-slate-700/80 backdrop-blur-md text-xs flex items-center gap-1.5 shadow-lg transition-all"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mostrar Controles do Palco</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Recolher Dock (Modo Cinema)</span>
            </>
          )}
        </button>
      </div>

      {/* Dock Container */}
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Animation Source Selector + Animation Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 max-w-full overflow-hidden w-full lg:w-auto">
            {/* Source switch (Presets vs Importadas) */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                onClick={() => setAnimSourceTab('presets')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                  animSourceTab === 'presets'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Presets ({SAMPLE_ANIMATIONS.length})</span>
              </button>
              {animationCandidates.length > 0 && (
                <button
                  onClick={() => setAnimSourceTab('imported')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                    animSourceTab === 'imported'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FolderArchive className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Pacote Unity ({animationCandidates.length})</span>
                </button>
              )}
            </div>

            {/* Animation Buttons Scrollable List */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
              {animSourceTab === 'presets' ? (
                SAMPLE_ANIMATIONS.map((preset) => {
                  const isSelected = currentAnimId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => onSelectPreset(preset.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50 font-semibold'
                          : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{presetIcons[preset.id] || '✨'}</span>
                      <span>{preset.name.split('/')[0].trim()}</span>
                    </button>
                  );
                })
              ) : (
                animationCandidates.map((asset) => {
                  const isSelected =
                    currentAnimId === asset.guid ||
                    activeAnimationName === asset.filename ||
                    activeAnimationName === asset.filename.split('.')[0];
                  return (
                    <button
                      key={asset.guid}
                      onClick={() => onSelectAsset && onSelectAsset(asset)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50 font-semibold'
                          : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                      }`}
                      title={`Testar ${asset.filename} no palco`}
                    >
                      <Film className="w-3 h-3 text-indigo-400" />
                      <span className="truncate max-w-[130px]">
                        {asset.filename.replace(/\.(fbx|anim)$/i, '')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        .{asset.extension}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Speed & Live Bone Monitor */}
          <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
            {/* Speed Multiplier with 0.25x Slow-Mo */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <Gauge className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              {[0.25, 0.5, 1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => onChangeSpeed(s)}
                  className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                    playbackSpeed === s
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`${s}x de velocidade`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Live Bone Monitor */}
            {activeBoneData && (
              <div className="hidden xl:flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">{activeBoneData.bone}:</span>
                <span className="text-indigo-300">
                  [{activeBoneData.rot[0].toFixed(2)}, {activeBoneData.rot[1].toFixed(2)}]
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
