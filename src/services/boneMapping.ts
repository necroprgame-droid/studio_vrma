import { HumanoidBoneName } from '../types';

export interface BoneNamingPreset {
  id: string;
  name: string;
  description: string;
  mapping: Record<HumanoidBoneName, string>;
}

export const BONE_NAME_PRESETS: BoneNamingPreset[] = [
  {
    id: 'unity_mecanim',
    name: 'Unity Mecanim (Default)',
    description: 'Nomenclatura padrão do avatar humanoide da Unity (HumanDescription)',
    mapping: {
      hips: 'Hips',
      spine: 'Spine',
      chest: 'Chest',
      upperChest: 'UpperChest',
      neck: 'Neck',
      head: 'Head',
      leftShoulder: 'LeftShoulder',
      leftUpperArm: 'LeftUpperArm',
      leftLowerArm: 'LeftLowerArm',
      leftHand: 'LeftHand',
      rightShoulder: 'RightShoulder',
      rightUpperArm: 'RightUpperArm',
      rightLowerArm: 'RightLowerArm',
      rightHand: 'RightHand',
      leftUpperLeg: 'LeftUpperLeg',
      leftLowerLeg: 'LeftLowerLeg',
      leftFoot: 'LeftFoot',
      leftToes: 'LeftToes',
      rightUpperLeg: 'RightUpperLeg',
      rightLowerLeg: 'RightLowerLeg',
      rightFoot: 'RightFoot',
      rightToes: 'RightToes',
    },
  },
  {
    id: 'mixamo',
    name: 'Mixamo Rig',
    description: 'Padrão com prefixo mixamorig do Adobe Mixamo',
    mapping: {
      hips: 'mixamorig:Hips',
      spine: 'mixamorig:Spine',
      chest: 'mixamorig:Spine1',
      upperChest: 'mixamorig:Spine2',
      neck: 'mixamorig:Neck',
      head: 'mixamorig:Head',
      leftShoulder: 'mixamorig:LeftShoulder',
      leftUpperArm: 'mixamorig:LeftArm',
      leftLowerArm: 'mixamorig:LeftForeArm',
      leftHand: 'mixamorig:LeftHand',
      rightShoulder: 'mixamorig:RightShoulder',
      rightUpperArm: 'mixamorig:RightArm',
      rightLowerArm: 'mixamorig:RightForeArm',
      rightHand: 'mixamorig:RightHand',
      leftUpperLeg: 'mixamorig:LeftUpLeg',
      leftLowerLeg: 'mixamorig:LeftLeg',
      leftFoot: 'mixamorig:LeftFoot',
      leftToes: 'mixamorig:LeftToeBase',
      rightUpperLeg: 'mixamorig:RightUpLeg',
      rightLowerLeg: 'mixamorig:RightLeg',
      rightFoot: 'mixamorig:RightFoot',
      rightToes: 'mixamorig:RightToeBase',
    },
  },
  {
    id: 'unreal_manny',
    name: 'Unreal Engine Mannequin',
    description: 'Esqueleto UE4 / UE5 padrão da Epic Games',
    mapping: {
      hips: 'pelvis',
      spine: 'spine_01',
      chest: 'spine_02',
      upperChest: 'spine_03',
      neck: 'neck_01',
      head: 'head',
      leftShoulder: 'clavicle_l',
      leftUpperArm: 'upperarm_l',
      leftLowerArm: 'lowerarm_l',
      leftHand: 'hand_l',
      rightShoulder: 'clavicle_r',
      rightUpperArm: 'upperarm_r',
      rightLowerArm: 'lowerarm_r',
      rightHand: 'hand_r',
      leftUpperLeg: 'thigh_l',
      leftLowerLeg: 'calf_l',
      leftFoot: 'foot_l',
      leftToes: 'ball_l',
      rightUpperLeg: 'thigh_r',
      rightLowerLeg: 'calf_r',
      rightFoot: 'foot_r',
      rightToes: 'ball_r',
    },
  },
  {
    id: 'blender_rigify',
    name: 'Blender Rigify / Basic',
    description: 'Estrutura gerada pelo Rigify ou exportação padrão do Blender',
    mapping: {
      hips: 'hips',
      spine: 'spine',
      chest: 'chest',
      upperChest: 'upper_chest',
      neck: 'neck',
      head: 'head',
      leftShoulder: 'shoulder.L',
      leftUpperArm: 'upper_arm.L',
      leftLowerArm: 'forearm.L',
      leftHand: 'hand.L',
      rightShoulder: 'shoulder.R',
      rightUpperArm: 'upper_arm.R',
      rightLowerArm: 'forearm.R',
      rightHand: 'hand.R',
      leftUpperLeg: 'thigh.L',
      leftLowerLeg: 'shin.L',
      leftFoot: 'foot.L',
      leftToes: 'toe.L',
      rightUpperLeg: 'thigh.R',
      rightLowerLeg: 'shin.R',
      rightFoot: 'foot.R',
      rightToes: 'toe.R',
    },
  },
];

/**
 * Heuristically finds the matching VRM Humanoid bone from a raw bone name.
 */
export function detectVRMHumanoidBone(rawName: string): HumanoidBoneName | null {
  if (!rawName) return null;

  // Split hierarchy paths (e.g. "Armature/Hips/Spine/LeftArm" or "Root:Hips:RightLeg")
  const pathParts = rawName.split(/[/\\:]+/).filter(Boolean);
  const leafName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : rawName;
  const leafLower = leafName.toLowerCase();
  const clean = leafLower.replace(/[^a-z0-9]/g, '');

  // Detect Left vs Right from leaf name (or fallback to full path if not in leaf)
  const isLeft =
    leafLower.includes('left') ||
    leafLower.endsWith('_l') ||
    leafLower.endsWith('.l') ||
    leafLower.startsWith('l_') ||
    leafLower.includes('_l_') ||
    (rawName.toLowerCase().includes('left') && !rawName.toLowerCase().includes('right'));

  const isRight =
    leafLower.includes('right') ||
    leafLower.endsWith('_r') ||
    leafLower.endsWith('.r') ||
    leafLower.startsWith('r_') ||
    leafLower.includes('_r_') ||
    (rawName.toLowerCase().includes('right') && !rawName.toLowerCase().includes('left'));

  // 1. Pelvis / Hips (Root bone of the body)
  if (clean === 'root' || clean === 'hips' || clean === 'pelvis' || clean.includes('pelvis') || clean.endsWith('hip') || clean.endsWith('hips')) {
    return 'hips';
  }

  // 2. Head & Neck
  if (clean.includes('head')) return 'head';
  if (clean.includes('neck')) return 'neck';

  // 3. Upper body (Shoulder, Arm, Forearm, Hand)
  if (clean.includes('shoulder') || clean.includes('clavicle')) {
    return isLeft ? 'leftShoulder' : isRight ? 'rightShoulder' : null;
  }
  if (clean.includes('forearm') || clean.includes('lowerarm') || clean.includes('elbow')) {
    return isLeft ? 'leftLowerArm' : isRight ? 'rightLowerArm' : null;
  }
  if (clean.includes('upperarm') || clean.includes('uparm') || clean.includes('arm')) {
    return isLeft ? 'leftUpperArm' : isRight ? 'rightUpperArm' : null;
  }
  if (clean.includes('hand') || clean.includes('wrist')) {
    return isLeft ? 'leftHand' : isRight ? 'rightHand' : null;
  }

  // 4. Lower body (Thigh, Calf, Foot, Toes)
  if (clean.includes('toe') || clean.includes('ball')) {
    return isLeft ? 'leftToes' : isRight ? 'rightToes' : null;
  }
  if (clean.includes('foot') || clean.includes('ankle')) {
    return isLeft ? 'leftFoot' : isRight ? 'rightFoot' : null;
  }
  if (clean.includes('calf') || clean.includes('lowerleg') || clean.includes('shin') || clean.includes('knee') || clean.includes('leg')) {
    // Distinguish between upper leg and lower leg
    if (clean.includes('upperleg') || clean.includes('upleg') || clean.includes('thigh')) {
      return isLeft ? 'leftUpperLeg' : isRight ? 'rightUpperLeg' : null;
    }
    return isLeft ? 'leftLowerLeg' : isRight ? 'rightLowerLeg' : null;
  }
  if (clean.includes('thigh') || clean.includes('upperleg') || clean.includes('upleg')) {
    return isLeft ? 'leftUpperLeg' : isRight ? 'rightUpperLeg' : null;
  }

  // 5. Torso (Spine, Chest, UpperChest)
  if (clean.includes('spine2') || clean.includes('spine02') || clean.includes('upperchest')) return 'upperChest';
  if (clean.includes('spine1') || clean.includes('spine01') || clean.includes('chest')) return 'chest';
  if (clean.includes('spine')) return 'spine';

  // Fallback hips check if not matched
  if (clean.includes('hip')) return 'hips';

  return null;
}
