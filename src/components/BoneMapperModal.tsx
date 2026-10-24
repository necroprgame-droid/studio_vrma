import React, { useState } from 'react';
import { BONE_NAME_PRESETS } from '../services/boneMapping';
import { VRM_HUMANOID_BONES } from '../services/vrmaExporter';
import { HumanoidBoneName } from '../types';
import { X, Check, Sliders, RefreshCw, Cpu } from 'lucide-react';

interface BoneMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMapping: (customMap: Record<HumanoidBoneName, string>) => void;
}

export const BoneMapperModal: React.FC<BoneMapperModalProps> = ({
  isOpen,
  onClose,
  onApplyMapping,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('unity_mecanim');
  const [currentMapping, setCurrentMapping] = useState<Record<HumanoidBoneName, string>>(
    () => BONE_NAME_PRESETS[0].mapping
  );

  if (!isOpen) return null;

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = BONE_NAME_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setCurrentMapping({ ...found.mapping });
    }
  };

  const handleBoneChange = (bone: HumanoidBoneName, val: string) => {
    setCurrentMapping((prev) => ({
      ...prev,
      [bone]: val,
    }));
  };

  const handleSave = () => {
    onApplyMapping(currentMapping);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">
              Mapeamento de Ossos: Rig Humanoide para VRMC_vrm_animation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Selector */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-950/40">
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Preset de Convenção de Nomes:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BONE_NAME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedPresetId === preset.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="text-xs font-semibold">{preset.name}</div>
                <div className="text-[10px] text-slate-500 mt-1 truncate">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bone Mapping Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="text-xs text-slate-400 mb-2">
            Configuração individual dos 21 ossos padrão da especificação VRM 1.0:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {VRM_HUMANOID_BONES.map((boneName) => (
              <div
                key={boneName}
                className="flex items-center justify-between gap-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800"
              >
                <div className="min-w-0">
                  <span className="text-xs font-mono font-medium text-indigo-300">
                    {boneName}
                  </span>
                </div>
                <input
                  type="text"
                  value={currentMapping[boneName] || ''}
                  onChange={(e) => handleBoneChange(boneName, e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 w-44"
                  placeholder="Nome no FBX"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="text-[11px] text-slate-500">
            A especificação VRMA exige mapeamento rígido para compatibilidade universal.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Aplicar Mapeamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
