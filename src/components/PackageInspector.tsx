import React, { useState } from 'react';
import * as fflate from 'fflate';
import { ExtractedAsset, VRMAAnimationData } from '../types';
import { exportToVRMA } from '../services/vrmaExporter';
import { parseFBXAnimation } from '../services/fbxParser';
import { parseUnityAnim } from '../services/unityAnimParser';
import {
  FileText,
  Film,
  FolderArchive,
  Download,
  Play,
  Search,
  Sparkles,
  FileBox,
  Archive,
  RefreshCw,
} from 'lucide-react';

interface PackageInspectorProps {
  assets: ExtractedAsset[];
  packageName: string;
  onSelectAnimation: (asset: ExtractedAsset) => void;
  onConvertAssetToVRMA: (asset: ExtractedAsset) => void;
  isProcessing: boolean;
}

export const PackageInspector: React.FC<PackageInspectorProps> = ({
  assets,
  packageName,
  onSelectAnimation,
  onConvertAssetToVRMA,
  isProcessing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'anim' | 'fbx' | 'other'>('all');
  const [isBatchConverting, setIsBatchConverting] = useState(false);

  const animationCandidates = assets.filter((a) => a.isAnimationCandidate);

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.pathname.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'anim') {
      return asset.extension === 'anim';
    }
    if (filterType === 'fbx') {
      return asset.extension === 'fbx';
    }
    if (filterType === 'other') {
      return !asset.isAnimationCandidate;
    }
    return true;
  });

  const downloadAsset = (asset: ExtractedAsset) => {
    const blob = new Blob([asset.data as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = asset.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchExportAllVRMA = async () => {
    if (animationCandidates.length === 0) return;
    setIsBatchConverting(true);

    try {
      const zipFiles: Record<string, Uint8Array> = {};

      for (const asset of animationCandidates) {
        try {
          let parsed: VRMAAnimationData;
          if (asset.extension === 'fbx') {
            parsed = await parseFBXAnimation(asset.data.buffer, asset.filename);
          } else if (asset.extension === 'anim') {
            parsed = await parseUnityAnim(asset.data.buffer, asset.filename);
          } else {
            continue;
          }
          const vrmaBytes = exportToVRMA(parsed);
          const cleanName = parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          zipFiles[`${cleanName}.vrma`] = vrmaBytes;
        } catch (e) {
          console.warn(`Erro ao converter ${asset.filename}:`, e);
        }
      }

      if (Object.keys(zipFiles).length === 0) {
        alert('Nenhuma animação válida pôde ser convertida para VRMA.');
        return;
      }

      const zipBytes = fflate.zipSync(zipFiles);
      const blob = new Blob([zipBytes as unknown as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanPkgName = (packageName || 'animacoes_unity').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${cleanPkgName}_VRMA_Pack.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Falha no lote VRMA:', err);
      alert('Erro ao processar lote de arquivos VRMA.');
    } finally {
      setIsBatchConverting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-indigo-400" />
            Conteúdo Extraído do Pacote
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {packageName ? `Pacote: ${packageName}` : 'Nenhum pacote carregado'} · {assets.length} arquivos recuperados ({animationCandidates.length} animações/FBX)
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {animationCandidates.length > 0 && (
            <button
              onClick={handleBatchExportAllVRMA}
              disabled={isBatchConverting || isProcessing}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
              title="Converter todas as animações extraídas para VRMA e baixar em um arquivo .zip"
            >
              {isBatchConverting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando VRMAs...</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  <span>Exportar Todas ({animationCandidates.length}) em .zip</span>
                </>
              )}
            </button>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por caminho ou nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-full sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
            filterType === 'all'
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Todos ({assets.length})
        </button>
        <button
          onClick={() => setFilterType('anim')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
            filterType === 'anim'
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Clips Unity .anim ({assets.filter((a) => a.extension === 'anim').length})
        </button>
        <button
          onClick={() => setFilterType('fbx')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
            filterType === 'fbx'
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Modelos & Animações FBX ({assets.filter((a) => a.extension === 'fbx').length})
        </button>
        <button
          onClick={() => setFilterType('other')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
            filterType === 'other'
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Outros Assets ({assets.filter((a) => !a.isAnimationCandidate).length})
        </button>
      </div>

      {/* Assets Table / List */}
      <div className="flex-1 overflow-y-auto max-h-[360px] border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/60">
        {filteredAssets.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            {assets.length === 0
              ? 'Nenhum pacote Unity descompactado ainda. Arraste um arquivo .unitypackage ou utilize os modelos demonstrativos.'
              : 'Nenhum asset correspondente aos filtros de busca.'}
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div
              key={asset.guid}
              className="p-3 flex items-center justify-between gap-4 hover:bg-slate-900/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg ${
                    asset.extension === 'fbx'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : asset.extension === 'anim'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {asset.isAnimationCandidate ? (
                    <Film className="w-4 h-4" />
                  ) : (
                    <FileBox className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {asset.filename}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {asset.extension || 'bin'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-md">
                    {asset.pathname}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {formatFileSize(asset.size)}
                </span>

                {asset.isAnimationCandidate && (
                  <button
                    onClick={() => onSelectAnimation(asset)}
                    disabled={isProcessing}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                    title="Carregar e visualizar no player 3D"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Visualizar</span>
                  </button>
                )}

                {asset.isAnimationCandidate && (
                  <button
                    onClick={() => onConvertAssetToVRMA(asset)}
                    disabled={isProcessing}
                    className="px-2.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                    title="Converter diretamente para arquivo .vrma"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>VRMA</span>
                  </button>
                )}

                <button
                  onClick={() => downloadAsset(asset)}
                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  title="Baixar arquivo original"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
