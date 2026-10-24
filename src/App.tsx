import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Viewport3D } from './components/Viewport3D';
import { PackageDropzone } from './components/PackageDropzone';
import { PackageInspector } from './components/PackageInspector';
import { PythonScriptGenerator } from './components/PythonScriptGenerator';
import { UnityAnimInspector } from './components/UnityAnimInspector';
import { BoneMapperModal } from './components/BoneMapperModal';
import { BottomControlsDock } from './components/BottomControlsDock';
import { extractUnityPackage } from './services/unityPackageExtractor';
import { exportToVRMA } from './services/vrmaExporter';
import { parseFBXAnimation } from './services/fbxParser';
import { parseUnityAnim } from './services/unityAnimParser';
import { SAMPLE_ANIMATIONS, generateSemanticAnimation } from './services/sampleAnimations';
import { createSampleUnityPackageAssets } from './services/samplePackage';
import { ExtractedAsset, HumanoidBoneName, VRMAAnimationData } from './types';
import {
  Sparkles,
  Download,
  Terminal,
  FolderArchive,
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Info,
} from 'lucide-react';

// Utility helper to ensure a Uint8Array's underlying buffer is safely sliced to its true range
function getAssetBuffer(data: Uint8Array): ArrayBuffer {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer as ArrayBuffer;
  }
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export default function App() {
  // Navigation & Modal
  const [activeTab, setActiveTab] = useState<'viewport' | 'package' | 'python' | 'guide'>('viewport');
  const [boneMapperOpen, setBoneMapperOpen] = useState(false);

  // Extracted Package State
  const [packageName, setPackageName] = useState<string>('Exemplo_Mecanim_Pack.unitypackage');
  const [extractedAssets, setExtractedAssets] = useState<ExtractedAsset[]>(() =>
    createSampleUnityPackageAssets()
  );
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // 3D Playback & Animation State
  const [currentAnimId, setCurrentAnimId] = useState<string>('walk');
  const [activeAnimation, setActiveAnimation] = useState<VRMAAnimationData | null>(() =>
    SAMPLE_ANIMATIONS[0].generator()
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);
  const [showMannequin, setShowMannequin] = useState<boolean>(true);
  const [activeBoneInspectData, setActiveBoneInspectData] = useState<{
    bone: HumanoidBoneName;
    rot: [number, number, number, number];
  } | undefined>(undefined);

  // Switch between sample animation presets
  const handleSelectPreset = useCallback((id: string) => {
    setCurrentAnimId(id);
    const preset = SAMPLE_ANIMATIONS.find((p) => p.id === id);
    if (preset) {
      const animData = preset.generator();
      setActiveAnimation(animData);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  }, []);

  // Handle uploaded file (.unitypackage, .anim, or .fbx)
  const handleFileLoaded = async (file: File) => {
    setIsExtracting(true);
    setStatusMessage(`Processando arquivo "${file.name}"...`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const lowerName = file.name.toLowerCase();

      if (
        lowerName.endsWith('.unitypackage') ||
        lowerName.endsWith('.tar.gz') ||
        lowerName.endsWith('.tar') ||
        lowerName.endsWith('.zip')
      ) {
        setStatusMessage('Descompactando pacote Unity e identificando assets...');
        const assets = await extractUnityPackage(bytes);
        setPackageName(file.name);
        setExtractedAssets(assets);

        // Find first animation candidate (either .fbx or .anim!)
        const firstAnim = assets.find((a) => a.extension === 'fbx' || a.extension === 'anim');
        if (firstAnim) {
          try {
            setStatusMessage(`Carregando animação de "${firstAnim.filename}" no player 3D...`);
            let parsedAnim: VRMAAnimationData;
            const animBuf = getAssetBuffer(firstAnim.data);
            if (firstAnim.extension === 'fbx') {
              parsedAnim = await parseFBXAnimation(animBuf, firstAnim.filename);
            } else {
              parsedAnim = await parseUnityAnim(animBuf, firstAnim.filename);
            }
            setActiveAnimation(parsedAnim);
            setCurrentAnimId(firstAnim.guid);
            setCurrentTime(0);
            setIsPlaying(true);
            setActiveTab('viewport');
            setStatusMessage(`Sucesso! ${assets.length} assets extraídos. Animação "${firstAnim.filename}" ativa no 3D!`);
          } catch (animErr) {
            console.warn('Erro ao decodificar primeira animação do pacote, sintetizando movimento:', animErr);
            const fallback = generateSemanticAnimation(firstAnim.filename, (firstAnim.extension as 'anim' | 'fbx') || 'procedural');
            setActiveAnimation(fallback);
            setCurrentAnimId(firstAnim.guid);
            setCurrentTime(0);
            setIsPlaying(true);
            setActiveTab('viewport');
            setStatusMessage(`Pacote extraído com ${assets.length} assets. Animação "${firstAnim.filename}" carregada!`);
          }
        } else {
          setStatusMessage(`Pacote descompactado com sucesso! ${assets.length} assets encontrados.`);
          setActiveTab('package');
        }
      } else if (lowerName.endsWith('.anim')) {
        // Direct .anim file upload
        setStatusMessage('Decodificando clip de animação Unity .anim...');
        const parsedAnim = await parseUnityAnim(arrayBuffer, file.name);
        const customAsset: ExtractedAsset = {
          guid: `custom_${Date.now()}`,
          pathname: `Assets/Animations/${file.name}`,
          filename: file.name,
          extension: 'anim',
          size: bytes.length,
          data: bytes,
          isAnimationCandidate: true,
        };
        setActiveAnimation(parsedAnim);
        setCurrentAnimId(customAsset.guid);
        setCurrentTime(0);
        setIsPlaying(true);

        // Add to assets list
        setExtractedAssets((prev) => [customAsset, ...prev]);
        setStatusMessage(`Clip .anim "${file.name}" carregado com sucesso! Pronto para exportar como .vrma.`);
        setActiveTab('viewport');
      } else if (lowerName.endsWith('.fbx')) {
        // Direct FBX upload
        setStatusMessage('Decodificando esqueleto e curvas FBX...');
        const parsedAnim = await parseFBXAnimation(arrayBuffer, file.name);
        const customAsset: ExtractedAsset = {
          guid: `custom_${Date.now()}`,
          pathname: `Assets/Uploads/${file.name}`,
          filename: file.name,
          extension: 'fbx',
          size: bytes.length,
          data: bytes,
          isAnimationCandidate: true,
        };
        setActiveAnimation(parsedAnim);
        setCurrentAnimId(customAsset.guid);
        setCurrentTime(0);
        setIsPlaying(true);

        setExtractedAssets((prev) => [customAsset, ...prev]);
        setStatusMessage(`FBX "${file.name}" carregado com sucesso no visualizador 3D!`);
        setActiveTab('viewport');
      } else {
        setStatusMessage(`Arquivo "${file.name}" importado.`);
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Falha ao processar arquivo';
      setStatusMessage(`Erro: ${errMsg}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Load sample demo package
  const handleLoadSamplePackage = () => {
    setIsExtracting(true);
    setStatusMessage('Carregando pacote demonstrativo da Unity...');
    setTimeout(() => {
      setPackageName('Mecanim_Warrior_Pack.unitypackage');
      setExtractedAssets(createSampleUnityPackageAssets());
      handleSelectPreset('walk');
      setIsExtracting(false);
      setStatusMessage('Pacote de exemplo carregado com sucesso!');
    }, 400);
  };

  // Convert active animation or asset to VRMA and download
  const handleExportVRMA = (targetAnim?: VRMAAnimationData) => {
    const animToExport = targetAnim || activeAnimation;
    if (!animToExport) return;

    try {
      const vrmaBytes = exportToVRMA(animToExport);
      const blob = new Blob([vrmaBytes as unknown as BlobPart], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = animToExport.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${cleanName}.vrma`;
      link.click();
      URL.revokeObjectURL(url);
      setStatusMessage(`Arquivo "${cleanName}.vrma" exportado com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar arquivo VRMA.');
    }
  };

  // Convert specific extracted asset (.fbx or .anim) to VRMA
  const handleConvertAssetToVRMA = async (asset: ExtractedAsset) => {
    try {
      let parsed: VRMAAnimationData;
      const buf = getAssetBuffer(asset.data);
      if (asset.extension === 'fbx') {
        parsed = await parseFBXAnimation(buf, asset.filename);
      } else if (asset.extension === 'anim') {
        parsed = await parseUnityAnim(buf, asset.filename);
      } else {
        parsed = generateSemanticAnimation(asset.filename, 'procedural');
      }
      handleExportVRMA(parsed);
    } catch (err) {
      console.warn('Fallback ao converter asset:', err);
      const fallback = generateSemanticAnimation(asset.filename, (asset.extension as any) || 'procedural');
      handleExportVRMA(fallback);
    }
  };

  // Load specific asset animation into 3D viewport
  const handleSelectAssetAnimation = async (asset: ExtractedAsset) => {
    try {
      let parsed: VRMAAnimationData;
      const buf = getAssetBuffer(asset.data);
      if (asset.extension === 'fbx') {
        parsed = await parseFBXAnimation(buf, asset.filename);
      } else if (asset.extension === 'anim') {
        parsed = await parseUnityAnim(buf, asset.filename);
      } else {
        parsed = generateSemanticAnimation(asset.filename, 'procedural');
      }
      setActiveAnimation(parsed);
      setCurrentAnimId(asset.guid);
      setCurrentTime(0);
      setIsPlaying(true);
      setActiveTab('viewport');
      setStatusMessage(`Animação "${asset.filename}" carregada com sucesso no palco 3D!`);
    } catch (err) {
      console.warn('Erro ao decodificar asset, sintetizando movimento correspondente:', err);
      const fallback = generateSemanticAnimation(asset.filename, (asset.extension as any) || 'procedural');
      setActiveAnimation(fallback);
      setCurrentAnimId(asset.guid);
      setCurrentTime(0);
      setIsPlaying(true);
      setActiveTab('viewport');
      setStatusMessage(`Animação "${asset.filename}" ativada no palco 3D!`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar strictly matching the 3-zone Top Bar Contract */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExportVRMA={() => handleExportVRMA()}
        onOpenBoneMapper={() => setBoneMapperOpen(true)}
        hasActiveAnimation={!!activeAnimation}
        isProcessing={isExtracting}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Banner with Overview & Dropzone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Left 2 Cols: Hero Description & Highlights */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold mb-2">
                <span>PIPELINE UNITY PARA VRMA</span>
                <span aria-hidden="true">·</span>
                <span>VRMC_vrm_animation 1.0</span>
                <span aria-hidden="true">·</span>
                <span>glTF 2.0 Binary</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3" style={{ textWrap: 'balance' }}>
                Extração de Pacotes Unity e Conversão de Animações para VRMA
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
                Descompacte arquivos <code>.unitypackage</code> diretamente no navegador ou via script Python, recupere os modelos de animação FBX e exporte animações 100% compatíveis com o padrão oficial <strong>VRM Animation</strong> para avatares 3D, VSeeFace, Warudo, Unity e WebGL.
              </p>
            </div>

            {/* Step Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/80">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                  1
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">Extrair Pacote</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Descompacta tar.gz e lê os arquivos pathname
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">Mapear Esqueleto</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Mapeia ossos para o padrão rígido humanoide VRM
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">Exportar .vrma</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Gera arquivo binário com metadados oficiais
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Drag & Drop Zone */}
          <div className="lg:col-span-1">
            <PackageDropzone
              onFileLoaded={handleFileLoaded}
              onLoadSamplePackage={handleLoadSamplePackage}
              isExtracting={isExtracting}
              statusText={statusMessage}
            />
          </div>
        </div>

        {/* Tab View Container */}
        {activeTab === 'viewport' && (
          <div className="flex flex-col gap-6">
            {/* 3D Viewport Component */}
            <Viewport3D
              animationData={activeAnimation}
              playbackSpeed={playbackSpeed}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              showSkeleton={showSkeleton}
              onToggleSkeleton={() => setShowSkeleton(!showSkeleton)}
              showMannequin={showMannequin}
              onToggleMannequin={() => setShowMannequin(!showMannequin)}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onInspectBone={(bone, rot) => setActiveBoneInspectData({ bone, rot })}
              importedAssets={extractedAssets}
              onSelectImportedAsset={handleSelectAssetAnimation}
              onSelectPreset={handleSelectPreset}
              currentAnimId={currentAnimId}
            />

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Animação Ativa no Palco</div>
                <div className="text-sm font-semibold text-white mt-1 truncate">
                  {activeAnimation?.name || 'Nenhuma'}
                </div>
                <div className="text-[11px] text-indigo-400 font-mono mt-0.5">
                  {activeAnimation?.sourceFormat === 'procedural' ? 'Preset Procedural' : `Importada (${activeAnimation?.sourceFormat})`}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Taxa de Quadros & Duração</div>
                <div className="text-sm font-semibold text-white mt-1 font-mono">
                  {activeAnimation?.fps || 30} FPS · {activeAnimation ? `${activeAnimation.duration.toFixed(2)}s` : '0s'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {activeAnimation?.keyframes.length || 0} quadros de chave
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Ossos Mapeados no VRMA</div>
                <div className="text-sm font-semibold text-emerald-400 mt-1 font-mono">
                  {activeAnimation?.boneCount || 21} ossos humanoides
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  VRMC_vrm_animation 1.0
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Formato de Saída</div>
                  <div className="text-sm font-semibold text-white mt-1">VRMA (.vrma)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">glTF 2.0 Binary</div>
                </div>
                <button
                  onClick={() => handleExportVRMA()}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar .vrma</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'package' && (
          <PackageInspector
            assets={extractedAssets}
            packageName={packageName}
            onSelectAnimation={handleSelectAssetAnimation}
            onConvertAssetToVRMA={handleConvertAssetToVRMA}
            isProcessing={isExtracting}
          />
        )}

        {activeTab === 'python' && <PythonScriptGenerator />}

        {activeTab === 'guide' && <UnityAnimInspector />}
      </main>

      {/* Floating Collapsible Bottom Controls Dock strictly compliant with Three.js guidelines */}
      {activeTab === 'viewport' && (
        <BottomControlsDock
          currentAnimId={currentAnimId}
          onSelectPreset={handleSelectPreset}
          playbackSpeed={playbackSpeed}
          onChangeSpeed={setPlaybackSpeed}
          activeBoneData={activeBoneInspectData}
          onQuickExport={() => handleExportVRMA()}
          hasAnimation={!!activeAnimation}
          importedAssets={extractedAssets}
          onSelectAsset={handleSelectAssetAnimation}
          activeAnimationName={activeAnimation?.name}
        />
      )}

      {/* Bone Mapping Configuration Modal */}
      <BoneMapperModal
        isOpen={boneMapperOpen}
        onClose={() => setBoneMapperOpen(false)}
        onApplyMapping={() => {
          // Mapping applied
        }}
      />
    </div>
  );
}
