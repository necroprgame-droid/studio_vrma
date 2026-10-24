export type HumanoidBoneName =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'upperChest'
  | 'neck'
  | 'head'
  | 'leftShoulder'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightShoulder'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'leftToes'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot'
  | 'rightToes';

export interface ExtractedAsset {
  guid: string;
  pathname: string;
  filename: string;
  extension: string;
  size: number;
  data: Uint8Array;
  isAnimationCandidate: boolean;
  metaContent?: string;
  previewUrl?: string;
}

export interface AnimationKeyframe {
  time: number;
  // Bone rotations as quaternions [x, y, z, w]
  rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>>;
  // Root translation [x, y, z] (usually hips)
  rootTranslation?: [number, number, number];
}

export interface VRMAAnimationData {
  name: string;
  duration: number;
  fps: number;
  keyframes: AnimationKeyframe[];
  sourceFormat: 'unitypackage' | 'fbx' | 'anim' | 'procedural';
  boneCount: number;
}

export interface BoneMappingConfig {
  sourceName: string;
  targetVrmaBone: HumanoidBoneName;
  confidence: number;
}
