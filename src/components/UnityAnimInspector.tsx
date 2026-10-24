import React, { useState } from 'react';
import { BookOpen, GitBranch, AlertCircle, HelpCircle, ArrowRight, Check } from 'lucide-react';

export const UnityAnimInspector: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState<'muscle' | 'transform' | 'fbx_baked'>('muscle');

  const muscleClipYaml = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!74 &7400000
AnimationClip:
  m_ObjectHideFlags: 0
  m_Name: Running_Humanoid
  m_AnimationType: 2 # 2 = Humanoid (Muscle Clip)
  m_MuscleClip:
    m_StartTime: 0
    m_StopTime: 0.8
    m_OrientationOffsetY: 0
    m_Level: 0
    m_CycleOffset: 0
    m_LoopTime: 1
    m_Muscle:
      # 95 canais de músculos Mecanim normalizados (-1.0 a +1.0)
      - { curve: { m_Curve: [{ time: 0, value: -0.12 }, { time: 0.4, value: 0.35 }] }, attribute: 9 } # Spine Front-Back
      - { curve: { m_Curve: [{ time: 0, value: 0.45 }, { time: 0.4, value: -0.45 }] }, attribute: 37 } # Left Upper Leg Front-Back
      - { curve: { m_Curve: [{ time: 0, value: -0.5 }, { time: 0.4, value: 0.5 }] }, attribute: 49 } # Left Arm Down-Up
  m_ClipBindingConstant:
    genericBindings: []`;

  const transformCurveYaml = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!74 &7400000
AnimationClip:
  m_ObjectHideFlags: 0
  m_Name: Object_Transform_Anim
  m_AnimationType: 1 # 1 = Generic / Legacy
  m_RotationCurves:
    - curve:
        m_Curve:
          - time: 0
            value: { x: 0, y: 0.7071, z: 0, w: 0.7071 }
          - time: 1.0
            value: { x: 0, y: -0.7071, z: 0, w: 0.7071 }
      path: Hips/Spine/Chest
      attribute: m_LocalRotation`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-5 h-5 text-indigo-400" />
        <h3 className="text-base font-semibold text-white">
          Guia Técnico: Por que converter FBX em vez de .anim puro?
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-6">
        Entenda a diferença arquitetural entre o sistema <strong>Mecanim Muscle</strong> da Unity e o padrão glTF 2.0 / <strong>VRMC_vrm_animation</strong>.
      </p>

      {/* 3 Step Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-400">Unity .anim (Muscle Clip)</span>
              <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded">Proprietário</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Armazena 95 canais musculares matemáticos (Mecanim Muscle Curves) normalizados entre -1 e +1. Não contém posições ou rotações de ossos no espaço 3D real até que o motor da Unity calcule com o Avatar rig.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
            Requer motor Unity C# ou conversor específico para FBX.
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-400">Modelo FBX (Esqueleto Assado)</span>
              <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded">Padrão da Indústria</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Armazena transformações completas de cada osso (quaternions de rotação + posição XYZ de raiz por frame). É o formato que acompanha os pacotes Unity descompactados e que o <code>fbx2vrma-converter</code> lê com precisão.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-emerald-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Recomendado para o fluxo Python
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400">VRMA (VRMC_vrm_animation)</span>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded">glTF 2.0 / VRM 1.0</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Arquivo binário .glb contendo a extensão oficial da especificação VRM. Mapeia nós padronizados (hips, spine, leftUpperArm, etc.) diretamente para qualquer avatar VRM em WebGL, VSeeFace ou Blender.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
            Formato final exportado por este aplicativo.
          </div>
        </div>
      </div>

      {/* YAML Structure Interactive Inspector */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            Estrutura Interna de Arquivos .anim do Unity (YAML)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedExample('muscle')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                selectedExample === 'muscle'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mecanim Humanoid
            </button>
            <button
              onClick={() => setSelectedExample('transform')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                selectedExample === 'transform'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Generic Transform
            </button>
          </div>
        </div>

        <div className="p-4 max-h-60 overflow-y-auto font-mono text-xs text-slate-300">
          <pre>
            <code>{selectedExample === 'muscle' ? muscleClipYaml : transformCurveYaml}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
