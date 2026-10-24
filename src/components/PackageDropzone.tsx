import React, { useRef, useState } from 'react';
import { UploadCloud, FileArchive, Sparkles, FolderUp, RefreshCw } from 'lucide-react';

interface PackageDropzoneProps {
  onFileLoaded: (file: File) => void;
  onLoadSamplePackage: () => void;
  isExtracting: boolean;
  statusText?: string;
}

export const PackageDropzone: React.FC<PackageDropzoneProps> = ({
  onFileLoaded,
  onLoadSamplePackage,
  isExtracting,
  statusText,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileLoaded(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileLoaded(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-200 text-center flex flex-col items-center justify-center ${
        isDragOver
          ? 'border-indigo-500 bg-indigo-500/10'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".unitypackage,.fbx,.anim,.tar,.gz,.zip"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
        {isExtracting ? (
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
        ) : (
          <UploadCloud className="w-6 h-6" />
        )}
      </div>

      <h3 className="text-sm font-semibold text-white mb-1">
        {isExtracting ? 'Processando e descompactando assets...' : 'Arraste seu arquivo .unitypackage, .anim ou .fbx aqui'}
      </h3>

      <p className="text-xs text-slate-400 max-w-md mb-4">
        {statusText || 'Descompactação de pacotes Unity (.unitypackage / .tar.gz / .zip), decodificação de clips .anim e exportação direta para VRMA (glTF 2.0).'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isExtracting}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-2"
        >
          <FolderUp className="w-4 h-4" />
          <span>Selecionar do Computador</span>
        </button>

        <button
          onClick={onLoadSamplePackage}
          disabled={isExtracting}
          className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-all flex items-center gap-2 border border-slate-700/60"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Carregar Pacote de Demonstração</span>
        </button>
      </div>
    </div>
  );
};
