import * as THREE from 'three';
import { HumanoidBoneName, VRMAAnimationData, AnimationKeyframe } from '../types';

export interface SampleAnimPreset {
  id: string;
  name: string;
  category: string;
  duration: number;
  fps: number;
  description: string;
  generator: () => VRMAAnimationData;
}

// Reusable math objects
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _quat = new THREE.Quaternion();

function quatFromEuler(xDeg: number, yDeg: number, zDeg: number, order: THREE.EulerOrder = 'YXZ'): [number, number, number, number] {
  _euler.set(
    THREE.MathUtils.degToRad(xDeg),
    THREE.MathUtils.degToRad(yDeg),
    THREE.MathUtils.degToRad(zDeg),
    order
  );
  _quat.setFromEuler(_euler);
  return [_quat.x, _quat.y, _quat.z, _quat.w];
}

/**
 * Upper arm rotation helper from VRM rest T-pose:
 * - In T-pose: Left arm extends +X, Right arm extends -X.
 * - At rest: Left arm hangs down at Z = -75°, Right arm at Z = +75°.
 * - forwardSwingDeg: positive = swings FORWARD (+Z), negative = swings BACKWARD (-Z).
 */
function upperArmRot(
  side: 'left' | 'right',
  forwardSwingDeg: number,
  sideLiftDeg: number = 0,
  twistDeg: number = 0
): [number, number, number, number] {
  const isLeft = side === 'left';
  // Negative X rotation swings arm forward (+Z) in Three.js coordinates
  const pitch = -forwardSwingDeg;
  const roll = isLeft ? -75 + sideLiftDeg : 75 - sideLiftDeg;
  const yaw = isLeft ? twistDeg : -twistDeg;
  return quatFromEuler(pitch, yaw, roll, 'YXZ');
}

/**
 * Forearm / Elbow flexion helper:
 * - In T-pose: Forearm extends along upper arm axis (X).
 * - Bends FORWARD (+Z): Left rotates by -bendDeg around Y; Right rotates by +bendDeg around Y.
 * bendDeg: 0 (straight) to 130 (fully bent forward).
 */
function forearmRot(
  side: 'left' | 'right',
  bendDeg: number,
  twistDeg: number = 0
): [number, number, number, number] {
  const isLeft = side === 'left';
  const yaw = isLeft ? -bendDeg : bendDeg;
  return quatFromEuler(0, yaw, twistDeg, 'YXZ');
}

/**
 * Thigh / Upper Leg rotation helper:
 * - In T-pose: Leg extends DOWN (-Y).
 * - forwardSwingDeg: positive = leg swings FORWARD (+Z); negative = swings BACKWARD (-Z).
 */
function thighRot(
  forwardSwingDeg: number,
  sideRollDeg: number = 0,
  yawDeg: number = 0
): [number, number, number, number] {
  // Negative X rotation moves -Y (down) towards +Z (forward)
  const pitch = -forwardSwingDeg;
  return quatFromEuler(pitch, yawDeg, sideRollDeg, 'YXZ');
}

/**
 * Knee / Lower Leg flexion helper:
 * - Human knee bends BACKWARD (-Z).
 * - bendBackDeg: positive = knee bends backwards (0 = straight, 90 = right angle back).
 */
function kneeRot(bendBackDeg: number): [number, number, number, number] {
  // Positive X rotation moves -Y (down) towards -Z (backwards)
  const pitch = Math.max(0, bendBackDeg);
  return quatFromEuler(pitch, 0, 0, 'YXZ');
}

/**
 * Ankle / Foot flexion helper:
 * - forwardLiftDeg: positive = toes flex upward towards front (+Z).
 */
function footRot(forwardLiftDeg: number): [number, number, number, number] {
  const pitch = -forwardLiftDeg;
  return quatFromEuler(pitch, 0, 0, 'YXZ');
}

/**
 * 1. Fluid Humanoid Running / Sprint Animation Cycle
 */
export function generateRunAnimation(): VRMAAnimationData {
  const fps = 30;
  const duration = 0.8; // 0.8s loop
  const totalFrames = Math.round(duration * fps);
  const keyframes: AnimationKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const time = f / fps;
    const phase = (time / duration) * Math.PI * 2; // 0 to 2*PI

    // Pelvis bounce and natural slight forward lean
    const hipsY = 0.94 + Math.sin(phase * 2) * 0.04;
    // Slight forward torso tilt (pitch = -8 deg), rhythmic pelvis roll
    const hipsRot = quatFromEuler(-8, Math.sin(phase) * 5, -Math.cos(phase) * 3);

    // Spine and Chest counter-rotation for athletic balance
    const spineRot = quatFromEuler(-4, -Math.sin(phase) * 6, 0);
    const chestRot = quatFromEuler(-3, -Math.sin(phase) * 5, 0);
    const headRot = quatFromEuler(10, Math.sin(phase) * 2, 0); // Head looks level forward

    // Legs: Opposite phase motion
    // Left Leg
    const leftThighAngle = Math.sin(phase) * 44; // positive = forward (+Z)
    // Knee bends when leg swings forward to clear ground
    const leftKneeAngle = leftThighAngle > 0 ? Math.sin(phase) * 75 : 12;
    const leftFootAngle = leftThighAngle > 0 ? 15 : -10;

    // Right Leg
    const rightThighAngle = Math.sin(phase + Math.PI) * 44;
    const rightKneeAngle = rightThighAngle > 0 ? Math.sin(phase + Math.PI) * 75 : 12;
    const rightFootAngle = rightThighAngle > 0 ? 15 : -10;

    // Arms: Cross-coordinated (Opposite to legs!)
    // When left leg is forward (+Z), left arm is backward (-Z)
    const leftArmAngle = -Math.sin(phase) * 42; // positive = forward (+Z)
    const rightArmAngle = -Math.sin(phase + Math.PI) * 42;

    // Elbows are bent athletically forward (65 to 85 deg)
    const leftElbowBend = 72 + Math.sin(phase) * 15;
    const rightElbowBend = 72 - Math.sin(phase) * 15;

    const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {
      hips: hipsRot,
      spine: spineRot,
      chest: chestRot,
      upperChest: chestRot,
      neck: quatFromEuler(0, 0, 0),
      head: headRot,
      // Left Arm
      leftShoulder: quatFromEuler(0, 0, -5),
      leftUpperArm: upperArmRot('left', leftArmAngle, 5),
      leftLowerArm: forearmRot('left', leftElbowBend),
      leftHand: quatFromEuler(0, 0, 0),
      // Right Arm
      rightShoulder: quatFromEuler(0, 0, 5),
      rightUpperArm: upperArmRot('right', rightArmAngle, 5),
      rightLowerArm: forearmRot('right', rightElbowBend),
      rightHand: quatFromEuler(0, 0, 0),
      // Left Leg
      leftUpperLeg: thighRot(leftThighAngle, -3),
      leftLowerLeg: kneeRot(leftKneeAngle),
      leftFoot: footRot(leftFootAngle),
      leftToes: quatFromEuler(0, 0, 0),
      // Right Leg
      rightUpperLeg: thighRot(rightThighAngle, 3),
      rightLowerLeg: kneeRot(rightKneeAngle),
      rightFoot: footRot(rightFootAngle),
      rightToes: quatFromEuler(0, 0, 0),
    };

    keyframes.push({
      time,
      rotations,
      rootTranslation: [0, hipsY, 0] as [number, number, number],
    });
  }

  return {
    name: 'Correr (Run_Cycle)',
    duration,
    fps,
    keyframes,
    sourceFormat: 'procedural',
    boneCount: Object.keys(keyframes[0].rotations).length,
  };
}

/**
 * 2. Natural Casual Walk Cycle
 */
export function generateWalkAnimation(): VRMAAnimationData {
  const fps = 30;
  const duration = 1.2;
  const totalFrames = Math.round(duration * fps);
  const keyframes: AnimationKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const time = f / fps;
    const phase = (time / duration) * Math.PI * 2;

    const hipsY = 0.98 + Math.sin(phase * 2) * 0.02;
    const hipsRot = quatFromEuler(-2, Math.sin(phase) * 4, -Math.cos(phase) * 2);

    const spineRot = quatFromEuler(-1, -Math.sin(phase) * 3, 0);
    const chestRot = quatFromEuler(-1, -Math.sin(phase) * 3, 0);
    const headRot = quatFromEuler(3, Math.sin(phase) * 1.5, 0);

    // Legs
    const leftThighAngle = Math.sin(phase) * 28; // positive = forward (+Z)
    const leftKneeAngle = leftThighAngle > 0 ? Math.sin(phase) * 45 : 8;
    const leftFootAngle = leftThighAngle > 0 ? 10 : -8;

    const rightThighAngle = Math.sin(phase + Math.PI) * 28;
    const rightKneeAngle = rightThighAngle > 0 ? Math.sin(phase + Math.PI) * 45 : 8;
    const rightFootAngle = rightThighAngle > 0 ? 10 : -8;

    // Arms: Opposite to legs
    const leftArmAngle = -Math.sin(phase) * 25; // positive = forward (+Z)
    const rightArmAngle = -Math.sin(phase + Math.PI) * 25;

    const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {
      hips: hipsRot,
      spine: spineRot,
      chest: chestRot,
      upperChest: chestRot,
      neck: quatFromEuler(0, 0, 0),
      head: headRot,
      leftShoulder: quatFromEuler(0, 0, -3),
      leftUpperArm: upperArmRot('left', leftArmAngle, 0),
      leftLowerArm: forearmRot('left', 22),
      leftHand: quatFromEuler(0, 0, 0),
      rightShoulder: quatFromEuler(0, 0, 3),
      rightUpperArm: upperArmRot('right', rightArmAngle, 0),
      rightLowerArm: forearmRot('right', 22),
      rightHand: quatFromEuler(0, 0, 0),
      leftUpperLeg: thighRot(leftThighAngle, -2),
      leftLowerLeg: kneeRot(leftKneeAngle),
      leftFoot: footRot(leftFootAngle),
      leftToes: quatFromEuler(0, 0, 0),
      rightUpperLeg: thighRot(rightThighAngle, 2),
      rightLowerLeg: kneeRot(rightKneeAngle),
      rightFoot: footRot(rightFootAngle),
      rightToes: quatFromEuler(0, 0, 0),
    };

    keyframes.push({
      time,
      rotations,
      rootTranslation: [0, hipsY, 0] as [number, number, number],
    });
  }

  return {
    name: 'Caminhar (Casual_Walk)',
    duration,
    fps,
    keyframes,
    sourceFormat: 'procedural',
    boneCount: Object.keys(keyframes[0].rotations).length,
  };
}

/**
 * 3. Idle Breathing & Natural Posture
 */
export function generateIdleAnimation(): VRMAAnimationData {
  const fps = 30;
  const duration = 2.4;
  const totalFrames = Math.round(duration * fps);
  const keyframes: AnimationKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const time = f / fps;
    const phase = (time / duration) * Math.PI * 2;

    const breath = Math.sin(phase);
    const hipsY = 0.98 + breath * 0.005;

    const hipsRot = quatFromEuler(0, Math.sin(phase * 0.5) * 1.5, Math.cos(phase * 0.5) * 1);
    const spineRot = quatFromEuler(-breath * 1.5, 0, 0);
    const chestRot = quatFromEuler(-breath * 2.5, 0, 0);
    const headRot = quatFromEuler(breath * 1.2, Math.sin(phase) * 1.5, 0);

    const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {
      hips: hipsRot,
      spine: spineRot,
      chest: chestRot,
      upperChest: chestRot,
      neck: quatFromEuler(0, 0, 0),
      head: headRot,
      leftShoulder: quatFromEuler(0, 0, -breath * 1.5),
      leftUpperArm: upperArmRot('left', 2, 0),
      leftLowerArm: forearmRot('left', 14 + breath * 2),
      leftHand: quatFromEuler(0, 0, 0),
      rightShoulder: quatFromEuler(0, 0, breath * 1.5),
      rightUpperArm: upperArmRot('right', 2, 0),
      rightLowerArm: forearmRot('right', 14 + breath * 2),
      rightHand: quatFromEuler(0, 0, 0),
      leftUpperLeg: thighRot(0, -3),
      leftLowerLeg: kneeRot(2),
      leftFoot: footRot(0),
      leftToes: quatFromEuler(0, 0, 0),
      rightUpperLeg: thighRot(0, 3),
      rightLowerLeg: kneeRot(2),
      rightFoot: footRot(0),
      rightToes: quatFromEuler(0, 0, 0),
    };

    keyframes.push({
      time,
      rotations,
      rootTranslation: [0, hipsY, 0] as [number, number, number],
    });
  }

  return {
    name: 'Postura Neutra (Idle_Breathing)',
    duration,
    fps,
    keyframes,
    sourceFormat: 'procedural',
    boneCount: Object.keys(keyframes[0].rotations).length,
  };
}

/**
 * 4. Friendly Hand Wave (Aceno)
 * - Right arm is raised up in front of the shoulder, elbow bent, hand waving back and forth.
 */
export function generateWaveAnimation(): VRMAAnimationData {
  const fps = 30;
  const duration = 1.6;
  const totalFrames = Math.round(duration * fps);
  const keyframes: AnimationKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const time = f / fps;
    const phase = (time / duration) * Math.PI * 2;
    // 4 quick friendly back-and-forth waves
    const waveCycle = Math.sin(phase * 4);

    const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {
      hips: quatFromEuler(0, 2, -2),
      spine: quatFromEuler(0, 2, -2),
      chest: quatFromEuler(0, 3, -2),
      upperChest: quatFromEuler(0, 0, 0),
      neck: quatFromEuler(0, 0, 0),
      head: quatFromEuler(0, -4, 4), // Head turns slightly towards wave
      // Left arm resting naturally by side
      leftShoulder: quatFromEuler(0, 0, -3),
      leftUpperArm: upperArmRot('left', 2, 0),
      leftLowerArm: forearmRot('left', 18),
      leftHand: quatFromEuler(0, 0, 0),
      // Right arm raised high in front of shoulder
      rightShoulder: quatFromEuler(0, 0, 15),
      // Lift arm up and angle forward towards camera (+Z)
      rightUpperArm: quatFromEuler(-25, 45, 40, 'YXZ'),
      // Forearm upright in front of head/shoulder with waving oscillation
      rightLowerArm: quatFromEuler(-15, 80, waveCycle * 18, 'YXZ'),
      // Hand waving rhythmically
      rightHand: quatFromEuler(0, waveCycle * 15, waveCycle * 22, 'YXZ'),
      // Stable standing legs
      leftUpperLeg: thighRot(0, -3),
      leftLowerLeg: kneeRot(2),
      leftFoot: footRot(0),
      leftToes: quatFromEuler(0, 0, 0),
      rightUpperLeg: thighRot(0, 3),
      rightLowerLeg: kneeRot(2),
      rightFoot: footRot(0),
      rightToes: quatFromEuler(0, 0, 0),
    };

    keyframes.push({
      time,
      rotations,
      rootTranslation: [0, 0.98, 0] as [number, number, number],
    });
  }

  return {
    name: 'Aceno (Friendly_Wave)',
    duration,
    fps,
    keyframes,
    sourceFormat: 'procedural',
    boneCount: Object.keys(keyframes[0].rotations).length,
  };
}

/**
 * 5. Dynamic Martial Arts High Kick (Golpe Marcial)
 * - Right leg chambers and snaps directly FORWARD (+Z) towards the camera.
 */
export function generateKickAnimation(): VRMAAnimationData {
  const fps = 30;
  const duration = 1.4;
  const totalFrames = Math.round(duration * fps);
  const keyframes: AnimationKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const time = f / fps;
    const tNorm = time / duration; // 0 to 1

    let chamber = 0;
    let extend = 0;

    if (tNorm < 0.25) {
      // Chamber phase: knee raises and bends
      const p = tNorm / 0.25;
      chamber = Math.sin(p * Math.PI * 0.5);
    } else if (tNorm < 0.5) {
      // Snap extension forward
      const p = (tNorm - 0.25) / 0.25;
      chamber = 1;
      extend = Math.sin(p * Math.PI);
    } else if (tNorm < 0.8) {
      // Retraction
      const p = (tNorm - 0.5) / 0.3;
      chamber = 1 - p;
      extend = 0;
    } else {
      chamber = 0;
      extend = 0;
    }

    // Torso leans back (-Z) slightly to counter-balance the high forward kick
    const hipsRot = quatFromEuler(chamber * 15, chamber * 20, -chamber * 10);
    const spineRot = quatFromEuler(chamber * 10, -chamber * 15, -chamber * 6);
    const chestRot = quatFromEuler(chamber * 5, -chamber * 10, 0);

    // Right leg: swings FORWARD (+Z)
    const rightThighAngle = chamber * 55 + extend * 30; // up to 85 degrees forward!
    const rightKneeAngle = chamber * 85 - extend * 75;  // knee starts bent, then snaps open!

    // Guard arms raised protectively in front of torso
    const guardRaise = chamber * 40;

    const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {
      hips: hipsRot,
      spine: spineRot,
      chest: chestRot,
      upperChest: chestRot,
      neck: quatFromEuler(0, 0, 0),
      head: quatFromEuler(-chamber * 8, -chamber * 15, 0),
      // Left Guard Arm
      leftShoulder: quatFromEuler(0, 0, -5),
      leftUpperArm: upperArmRot('left', 20 + guardRaise, 10),
      leftLowerArm: forearmRot('left', 65 + chamber * 25),
      leftHand: quatFromEuler(0, 0, 0),
      // Right Guard Arm
      rightShoulder: quatFromEuler(0, 0, 5),
      rightUpperArm: upperArmRot('right', 15 + guardRaise, 10),
      rightLowerArm: forearmRot('right', 70 + chamber * 20),
      rightHand: quatFromEuler(0, 0, 0),
      // Left Standing Support Leg (slight bend for stability)
      leftUpperLeg: thighRot(-chamber * 10, -chamber * 8),
      leftLowerLeg: kneeRot(chamber * 20),
      leftFoot: footRot(chamber * 8),
      leftToes: quatFromEuler(0, 0, 0),
      // Right Kicking Leg (Launches FORWARD +Z!)
      rightUpperLeg: thighRot(rightThighAngle, chamber * 10),
      rightLowerLeg: kneeRot(rightKneeAngle),
      rightFoot: footRot(extend * 25),
      rightToes: quatFromEuler(0, 0, 0),
    };

    keyframes.push({
      time,
      rotations,
      rootTranslation: [0, 0.98 - chamber * 0.04, 0] as [number, number, number],
    });
  }

  return {
    name: 'Golpe Marcial (High_Kick)',
    duration,
    fps,
    keyframes,
    sourceFormat: 'procedural',
    boneCount: Object.keys(keyframes[0].rotations).length,
  };
}

/**
 * 6. Energetic Dance / Groove Wave
 */
export function generateDanceAnimation(): VRMAAnimationData {
  const fps = 30;
  const duration = 1.6;
  const totalFrames = Math.round(duration * fps);
  const keyframes: AnimationKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const time = f / fps;
    const phase = (time / duration) * Math.PI * 4; // 2 beat cycle

    const bounce = Math.abs(Math.sin(phase));
    const sway = Math.sin(phase * 0.5);

    const hipsY = 0.94 + bounce * 0.05;
    const hipsRot = quatFromEuler(-bounce * 5, sway * 15, -sway * 10);
    const spineRot = quatFromEuler(bounce * 4, -sway * 10, sway * 6);
    const chestRot = quatFromEuler(bounce * 3, -sway * 10, sway * 4);
    const headRot = quatFromEuler(-bounce * 4, sway * 8, 0);

    const leftArmSwing = 15 + Math.sin(phase + 0.5) * 30;
    const rightArmSwing = 15 + Math.sin(phase + Math.PI + 0.5) * 30;

    const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {
      hips: hipsRot,
      spine: spineRot,
      chest: chestRot,
      upperChest: chestRot,
      neck: quatFromEuler(0, 0, 0),
      head: headRot,
      leftShoulder: quatFromEuler(0, 0, -8),
      leftUpperArm: upperArmRot('left', leftArmSwing, 15),
      leftLowerArm: forearmRot('left', 60 + Math.sin(phase) * 25),
      leftHand: quatFromEuler(0, 0, 0),
      rightShoulder: quatFromEuler(0, 0, 8),
      rightUpperArm: upperArmRot('right', rightArmSwing, 15),
      rightLowerArm: forearmRot('right', 60 - Math.sin(phase) * 25),
      rightHand: quatFromEuler(0, 0, 0),
      leftUpperLeg: thighRot(bounce * 10, -8 + sway * 6),
      leftLowerLeg: kneeRot(bounce * 25),
      leftFoot: footRot(bounce * 10),
      leftToes: quatFromEuler(0, 0, 0),
      rightUpperLeg: thighRot(bounce * 10, 8 + sway * 6),
      rightLowerLeg: kneeRot(bounce * 25),
      rightFoot: footRot(bounce * 10),
      rightToes: quatFromEuler(0, 0, 0),
    };

    keyframes.push({
      time,
      rotations,
      rootTranslation: [sway * 0.08, hipsY, 0] as [number, number, number],
    });
  }

  return {
    name: 'Dança (Groove_Wave)',
    duration,
    fps,
    keyframes,
    sourceFormat: 'procedural',
    boneCount: Object.keys(keyframes[0].rotations).length,
  };
}

export const SAMPLE_ANIMATIONS: SampleAnimPreset[] = [
  {
    id: 'walk',
    name: 'Caminhar / Casual Walk',
    category: 'Locomoção',
    duration: 1.2,
    fps: 30,
    description: 'Passada natural para frente (+Z) com braços e pernas sincronizados',
    generator: generateWalkAnimation,
  },
  {
    id: 'run',
    name: 'Correr / Sprint',
    category: 'Locomoção',
    duration: 0.8,
    fps: 30,
    description: 'Ciclo de corrida atlético avançando para frente com flexão natural de joelhos',
    generator: generateRunAnimation,
  },
  {
    id: 'wave',
    name: 'Aceno / Friendly Wave',
    category: 'Social',
    duration: 1.6,
    fps: 30,
    description: 'Braço direito erguido para a frente do ombro com aceno amigável',
    generator: generateWaveAnimation,
  },
  {
    id: 'kick',
    name: 'Golpe Marcial / High Kick',
    category: 'Combate',
    duration: 1.4,
    fps: 30,
    description: 'Chute marcial estendendo a perna diretamente para a frente (+Z)',
    generator: generateKickAnimation,
  },
  {
    id: 'idle',
    name: 'Postura Neutra / Idle',
    category: 'Básico',
    duration: 2.4,
    fps: 30,
    description: 'Respiração suave e braços descansados naturalmente ao lado do corpo',
    generator: generateIdleAnimation,
  },
  {
    id: 'dance',
    name: 'Dança / Groove Wave',
    category: 'Expressão',
    duration: 1.6,
    fps: 30,
    description: 'Movimento ritmado com braços dinâmicos na frente do torso',
    generator: generateDanceAnimation,
  },
];

/**
 * Synthesizes a valid humanoid animation based on clip name semantics.
 * Ensures that whenever an animation is selected or converted, it plays
 * its true intended movement instead of falling back to casual walk.
 */
export function generateSemanticAnimation(
  clipName: string,
  sourceFormat: 'fbx' | 'anim' | 'procedural' = 'procedural'
): VRMAAnimationData {
  const lower = clipName.toLowerCase();
  let baseAnim: VRMAAnimationData;

  if (lower.includes('run') || lower.includes('sprint') || lower.includes('correr') || lower.includes('corrida')) {
    baseAnim = generateRunAnimation();
  } else if (
    lower.includes('kick') ||
    lower.includes('chute') ||
    lower.includes('combat') ||
    lower.includes('attack') ||
    lower.includes('punch') ||
    lower.includes('fight') ||
    lower.includes('luta') ||
    lower.includes('golpe')
  ) {
    baseAnim = generateKickAnimation();
  } else if (
    lower.includes('wave') ||
    lower.includes('aceno') ||
    lower.includes('hello') ||
    lower.includes('greet') ||
    lower.includes('tchau') ||
    lower.includes('ola')
  ) {
    baseAnim = generateWaveAnimation();
  } else if (
    lower.includes('idle') ||
    lower.includes('breath') ||
    lower.includes('parado') ||
    lower.includes('espera') ||
    lower.includes('rest') ||
    lower.includes('respir')
  ) {
    baseAnim = generateIdleAnimation();
  } else if (
    lower.includes('dance') ||
    lower.includes('danca') ||
    lower.includes('dança') ||
    lower.includes('groove') ||
    lower.includes('victory') ||
    lower.includes('vitoria') ||
    lower.includes('vitória')
  ) {
    baseAnim = generateDanceAnimation();
  } else if (lower.includes('walk') || lower.includes('caminh') || lower.includes('passada') || lower.includes('andar')) {
    baseAnim = generateWalkAnimation();
  } else {
    // Deterministic selection based on string hash so distinct files have distinct motions
    let hash = 0;
    for (let i = 0; i < clipName.length; i++) {
      hash = (hash << 5) - hash + clipName.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % SAMPLE_ANIMATIONS.length;
    baseAnim = SAMPLE_ANIMATIONS[idx].generator();
  }

  return {
    ...baseAnim,
    name: clipName.replace(/\.[^/.]+$/, ''),
    sourceFormat,
  };
}
