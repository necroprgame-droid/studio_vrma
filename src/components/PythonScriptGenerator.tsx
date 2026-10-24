import React, { useState } from 'react';
import { Copy, Check, Download, Terminal, FileCode, Cpu, Layers } from 'lucide-react';

export const PythonScriptGenerator: React.FC = () => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cli_script' | 'batch_script' | 'native_tar' | 'requirements'>('cli_script');
  const [packageName, setPackageName] = useState('pack_animacoes.unitypackage');
  const [outputDir, setOutputDir] = useState('./animacoes_vrma');

  const copyToClipboard = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const mainScript = `#!/usr/bin/env python3
"""
Unity2VRMA Converter - Script Automatizado Python
Passo 1: Extrai pacotes .unitypackage usando unitypackage-extractor
Passo 2: Localiza arquivos FBX/animações e converte para .vrma via fbx2vrma-converter
"""

import os
import sys
import shutil
import argparse
import subprocess
from pathlib import Path

try:
    from unitypackage_extractor.extractor import extract_package
except ImportError:
    print("[AVISO] unitypackage-extractor não encontrado. Instalando automaticamente...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "unitypackage-extractor"])
    from unitypackage_extractor.extractor import extract_package


def verificar_requisitos():
    """Verifica se o Node.js e npx estão instalados para rodar fbx2vrma-converter."""
    if shutil.which("npx") is None:
        print("[ERRO] 'npx' não foi encontrado no PATH do sistema!")
        print("Por favor, instale o Node.js (https://nodejs.org/) para habilitar o fbx2vrma-converter.")
        sys.exit(1)


def extrair_pacote_unity(caminho_pacote: str, pasta_temp: str) -> list[str]:
    """
    Passo 1: Descompacta o arquivo .unitypackage e retorna todos os arquivos FBX encontrados.
    """
    print(f"\\n[1/3] Extraindo pacote Unity: {caminho_pacote} -> {pasta_temp}")
    os.makedirs(pasta_temp, exist_ok=True)
    
    extract_package(caminho_pacote, pasta_temp)
    
    # Busca recursiva por todos os FBX dentro da pasta de assets extraídos
    arquivos_fbx = []
    for root, _, files in os.walk(pasta_temp):
        for file in files:
            if file.lower().endswith(".fbx"):
                caminho_completo = os.path.join(root, file)
                arquivos_fbx.append(caminho_completo)
                
    print(f"-> Extração concluída! Encontrados {len(arquivos_fbx)} arquivo(s) FBX de animação/modelo.")
    return arquivos_fbx


def converter_fbx_para_vrma(caminho_fbx: str, caminho_vrma: str) -> bool:
    """
    Passo 2: Converte o modelo FBX para o formato oficial .vrma (VRMC_vrm_animation)
    utilizando a ferramenta fbx2vrma-converter via subprocess.
    """
    os.makedirs(os.path.dirname(caminho_vrma), exist_ok=True)
    
    # Monta comando npx para rodar o conversor oficial
    comando = f'npx --yes fbx2vrma-converter -i "{caminho_fbx}" -o "{caminho_vrma}"'
    
    try:
        resultado = subprocess.run(
            comando,
            shell=True,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print(f"  [OK] Exportado: {caminho_vrma}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  [FALHA] Erro ao converter {os.path.basename(caminho_fbx)}:")
        print(f"    Saída de erro: {e.stderr.strip() or e.stdout.strip()}")
        return False


def pipeline_completo(pacote_unity: str, pasta_saida: str, limpar_temp: bool = True):
    """
    Executa o fluxo completo:
    1. Descompacta pacote .unitypackage
    2. Identifica todos os FBX de animação
    3. Injeta a extensão VRMC_vrm_animation e salva como .vrma
    """
    verificar_requisitos()
    
    pasta_temp = os.path.join(pasta_saida, "_temp_unity_assets")
    arquivos_fbx = extrair_pacote_unity(pacote_unity, pasta_temp)
    
    if not arquivos_fbx:
        print("[AVISO] Nenhum arquivo .fbx encontrado dentro do pacote Unity.")
        return

    print(f"\\n[2/3] Convertendo {len(arquivos_fbx)} animação(ões) para VRMA...")
    sucessos = 0
    
    for fbx_path in arquivos_fbx:
        nome_base = Path(fbx_path).stem
        destino_vrma = os.path.join(pasta_saida, f"{nome_base}.vrma")
        
        if converter_fbx_para_vrma(fbx_path, destino_vrma):
            sucessos += 1

    # Limpeza opcional dos assets brutos
    if limpar_temp and os.path.exists(pasta_temp):
        print("\\n[3/3] Limpando arquivos temporários brutos...")
        shutil.rmtree(pasta_temp, ignore_errors=True)

    print(f"\\nConcluído com sucesso! {sucessos}/{len(arquivos_fbx)} animações VRMA geradas em: {pasta_saida}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extrai .unitypackage e converte animações FBX para .vrma")
    parser.add_argument("-i", "--input", default="${packageName}", help="Caminho do arquivo .unitypackage")
    parser.add_argument("-o", "--output", default="${outputDir}", help="Diretório de saída para os arquivos .vrma")
    parser.add_argument("--keep-temp", action="store_true", help="Manter os arquivos FBX e texturas extraídos")
    
    args = parser.parse_args()
    
    if not os.path.isfile(args.input):
        print(f"[ERRO] O arquivo '{args.input}' não foi encontrado!")
        sys.exit(1)
        
    pipeline_completo(args.input, args.output, limpar_temp=not args.keep_temp)
`;

  const batchScript = `#!/usr/bin/env python3
"""
Unity2VRMA Batch Pipeline - Processador em Lote
Converte múltiplos arquivos .unitypackage de uma pasta inteira de uma só vez!
"""

import os
import glob
from pathlib import Path
from converter import pipeline_completo

PASTA_PACOTES = "./meus_pacotes_unity"
PASTA_SAIDA_FINAL = "./animacoes_vrma_exportadas"

def processar_lote():
    pacotes = glob.glob(os.path.join(PASTA_PACOTES, "*.unitypackage"))
    
    if not pacotes:
        print(f"Nenhum pacote .unitypackage encontrado em: {PASTA_PACOTES}")
        return
        
    print(f"Iniciando conversão em lote de {len(pacotes)} pacote(s)...")
    
    for i, pacote in enumerate(pacotes, 1):
        nome_pacote = Path(pacote).stem
        pasta_destino = os.path.join(PASTA_SAIDA_FINAL, nome_pacote)
        
        print(f"\\n========================================")
        print(f"[{i}/{len(pacotes)}] Processando pacote: {os.path.basename(pacote)}")
        print(f"========================================")
        
        pipeline_completo(pacote, pasta_destino, limpar_temp=True)
        
    print("\\n[LOTE CONCLUÍDO] Todos os pacotes foram convertidos para .vrma!")

if __name__ == "__main__":
    processar_lote()
`;

  const nativeTarScript = `#!/usr/bin/env python3
"""
Extrator Nativo Python para .unitypackage (Sem bibliotecas externas)
O .unitypackage é internamente um arquivo .tar.gz contendo pastas com os GUIDs da Unity.
Este script descompacta e recupera a árvore de pastas original lendo os arquivos 'pathname'.
"""

import os
import tarfile
import shutil
from pathlib import Path

def extrair_unitypackage_nativo(caminho_pacote: str, pasta_destino: str):
    pasta_temp = os.path.join(pasta_destino, "_raw_tar_extract")
    os.makedirs(pasta_temp, exist_ok=True)
    
    print(f"Descompactando tar.gz: {caminho_pacote}...")
    with tarfile.open(caminho_pacote, "r:gz") as tar:
        tar.extractall(path=pasta_temp)
        
    print("Reconstruindo estrutura de diretórios da Unity...")
    total_recuperados = 0
    
    # Cada GUID é um diretório dentro do tar
    for item in os.listdir(pasta_temp):
        guid_dir = os.path.join(pasta_temp, item)
        if not os.path.isdir(guid_dir):
            continue
            
        pathname_file = os.path.join(guid_dir, "pathname")
        asset_file = os.path.join(guid_dir, "asset")
        
        if os.path.isfile(pathname_file) and os.path.isfile(asset_file):
            with open(pathname_file, "r", encoding="utf-8", errors="ignore") as f:
                caminho_original = f.read().strip()
                
            destino_final = os.path.join(pasta_destino, caminho_original)
            os.makedirs(os.path.dirname(destino_final), exist_ok=True)
            shutil.copy2(asset_file, destino_final)
            total_recuperados += 1
            
    # Limpa dados brutos
    shutil.rmtree(pasta_temp, ignore_errors=True)
    print(f"Concluído! {total_recuperados} assets originais restaurados em '{pasta_destino}'.")

if __name__ == "__main__":
    extrair_unitypackage_nativo("${packageName}", "./assets_restaurados")
`;

  const requirementsText = `# Dependências Python
unitypackage-extractor>=1.2.0

# Ferramenta Node.js necessária para fbx2vrma-converter
# Instalação: npm install -g fbx2vrma-converter
`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Automação em Python: UnityPackage para VRMA
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Gera o script Python completo pronto para rodar na sua máquina com CLI, tratamento de erros e suporte a lotes.
          </p>
        </div>

        {/* Inputs for dynamic customization */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-500">Pacote:</span>
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none font-mono w-44"
              placeholder="arquivo.unitypackage"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-500">Saída:</span>
            <input
              type="text"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none font-mono w-36"
              placeholder="./saida"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 mb-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('cli_script')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'cli_script'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            converter.py (Principal)
          </button>

          <button
            onClick={() => setActiveTab('batch_script')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'batch_script'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            batch_converter.py (Lote)
          </button>

          <button
            onClick={() => setActiveTab('native_tar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'native_tar'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Extrator Nativo (Sem Deps)
          </button>

          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'requirements'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            requirements.txt
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const content =
                activeTab === 'cli_script'
                  ? mainScript
                  : activeTab === 'batch_script'
                  ? batchScript
                  : activeTab === 'native_tar'
                  ? nativeTarScript
                  : requirementsText;
              copyToClipboard(content, activeTab);
            }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-all"
          >
            {copiedTab === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copiar Código
              </>
            )}
          </button>

          <button
            onClick={() => {
              const filename =
                activeTab === 'cli_script'
                  ? 'converter.py'
                  : activeTab === 'batch_script'
                  ? 'batch_converter.py'
                  : activeTab === 'native_tar'
                  ? 'extractor_tarfile.py'
                  : 'requirements.txt';
              const content =
                activeTab === 'cli_script'
                  ? mainScript
                  : activeTab === 'batch_script'
                  ? batchScript
                  : activeTab === 'native_tar'
                  ? nativeTarScript
                  : requirementsText;
              downloadFile(filename, content);
            }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar Arquivo
          </button>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="relative bg-slate-950 rounded-xl p-4 border border-slate-800/80 max-h-96 overflow-y-auto">
        <pre className="text-xs text-slate-300 font-mono leading-relaxed selection:bg-indigo-500/30">
          <code>
            {activeTab === 'cli_script' && mainScript}
            {activeTab === 'batch_script' && batchScript}
            {activeTab === 'native_tar' && nativeTarScript}
            {activeTab === 'requirements' && requirementsText}
          </code>
        </pre>
      </div>

      {/* Execution Instructions Banner */}
      <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Como executar no terminal:</span>
          <code className="bg-slate-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
            python converter.py -i {packageName} -o {outputDir}
          </code>
        </div>
        <div className="text-[11px] text-slate-500">
          Requer Python 3.9+ e Node.js 18+ para executar o fbx2vrma-converter.
        </div>
      </div>
    </div>
  );
};
