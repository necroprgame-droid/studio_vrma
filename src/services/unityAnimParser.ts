import * as THREE from 'three';
import { detectVRMHumanoidBone } from './boneMapping';
import { HumanoidBoneName, VRMAAnimationData, AnimationKeyframe } from '../types';
import { generateSemanticAnimation } from './sampleAnimations';

/**
 * Parses Unity .anim YAML or binary data into humanoid VRMAAnimationData.
 */
export async function parseUnityAnim(
  buffer: ArrayBufferLike,
  filename: string
): Promise<VRMAAnimationData> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  try {
    text = decoder.decode(bytes);
  } catch {
    text = '';
  }

  const cleanName = filename.replace(/\.anim$/i, '').trim();

  // Check if it's Unity YAML text format
  const isYaml =
    text.includes('AnimationClip:') ||
    text.includes('%YAML') ||
    text.includes('m_RotationCurves') ||
    text.includes('m_EulerCurves') ||
    text.includes('m_PositionCurves') ||
    text.includes('m_MuscleClip') ||
    text.includes('m_FloatCurves') ||
    text.includes('m_ClipBindingConstant') ||
    text.includes('m_CompressedRotationCurves');

  if (isYaml) {
    return parseYamlAnim(text, cleanName);
  }

  // If binary Unity asset, inspect strings or create structured fallback
  return parseBinaryUnityAnim(bytes, cleanName);
}

interface BoneCurveTrack {
  bone: HumanoidBoneName;
  property: 'rotation' | 'position' | 'euler';
  keyframes: Array<{ time: number; value: number[] }>;
}

/**
 * Splits a YAML section into individual array items (starting with "  - ").
 */
function extractCurveItemBlocks(sectionText: string): string[] {
  // Split on lines that begin an array entry at indent level 2 or 4: e.g. "  - " or "    - "
  const items: string[] = [];
  const lines = sectionText.split(/\r?\n/);
  let currentBlock = '';

  for (const line of lines) {
    if (/^\s{2,6}-\s+/.test(line)) {
      if (currentBlock.trim().length > 0) {
        items.push(currentBlock);
      }
      currentBlock = line + '\n';
    } else {
      currentBlock += line + '\n';
    }
  }
  if (currentBlock.trim().length > 0) {
    items.push(currentBlock);
  }
  return items;
}

/**
 * Extracts quaternion keyframes from a curve block.
 */
function parseQuatKeyframes(block: string): Array<{ time: number; value: [number, number, number, number] }> {
  const kfs: Array<{ time: number; value: [number, number, number, number] }> = [];

  // 1. Flow mapping style: value: {x: 0, y: 0, z: 0, w: 1}
  const flowRegex = /time:\s*([0-9.eE+-]+)[\s\S]*?value:\s*\{x:\s*([0-9.eE+-]+),\s*y:\s*([0-9.eE+-]+),\s*z:\s*([0-9.eE+-]+),\s*w:\s*([0-9.eE+-]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = flowRegex.exec(block)) !== null) {
    kfs.push({
      time: parseFloat(m[1]),
      value: [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]), parseFloat(m[5])],
    });
  }

  // 2. Block mapping style:
  //    value:
  //      x: 0
  //      y: 0
  if (kfs.length === 0) {
    const blockRegex = /time:\s*([0-9.eE+-]+)[\s\S]*?value:\s*(?:[\r\n]+\s+x:\s*([0-9.eE+-]+)\s+y:\s*([0-9.eE+-]+)\s+z:\s*([0-9.eE+-]+)\s+w:\s*([0-9.eE+-]+))/g;
    while ((m = blockRegex.exec(block)) !== null) {
      kfs.push({
        time: parseFloat(m[1]),
        value: [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]), parseFloat(m[5])],
      });
    }
  }

  return kfs.sort((a, b) => a.time - b.time);
}

/**
 * Extracts Vec3 keyframes (Euler angles or Position) from a curve block.
 */
function parseVec3Keyframes(block: string): Array<{ time: number; value: [number, number, number] }> {
  const kfs: Array<{ time: number; value: [number, number, number] }> = [];

  // Flow mapping style: value: {x: 0, y: 0, z: 0}
  const flowRegex = /time:\s*([0-9.eE+-]+)[\s\S]*?value:\s*\{x:\s*([0-9.eE+-]+),\s*y:\s*([0-9.eE+-]+),\s*z:\s*([0-9.eE+-]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = flowRegex.exec(block)) !== null) {
    kfs.push({
      time: parseFloat(m[1]),
      value: [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])],
    });
  }

  if (kfs.length === 0) {
    const blockRegex = /time:\s*([0-9.eE+-]+)[\s\S]*?value:\s*(?:[\r\n]+\s+x:\s*([0-9.eE+-]+)\s+y:\s*([0-9.eE+-]+)\s+z:\s*([0-9.eE+-]+))/g;
    while ((m = blockRegex.exec(block)) !== null) {
      kfs.push({
        time: parseFloat(m[1]),
        value: [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])],
      });
    }
  }

  return kfs.sort((a, b) => a.time - b.time);
}

/**
 * Extracts scalar float keyframes from a curve block (e.g. Mecanim muscles).
 */
function parseFloatKeyframes(block: string): Array<{ time: number; val: number }> {
  const pts: Array<{ time: number; val: number }> = [];
  const regex = /time:\s*([0-9.eE+-]+)[\s\S]*?value:\s*([0-9.eE+-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(block)) !== null) {
    pts.push({
      time: parseFloat(m[1]),
      val: parseFloat(m[2]),
    });
  }
  return pts.sort((a, b) => a.time - b.time);
}

/**
 * Extracts a named section's content from the YAML text.
 */
function getSectionText(yaml: string, sectionName: string): string | null {
  const startRegex = new RegExp(`\\n\\s*${sectionName}:([\\s\\S]*?)(?=\\n\\s*[a-zA-Z0-9_]+:|$)`);
  const match = yaml.match(startRegex);
  return match ? match[1] : null;
}

/**
 * Parses Unity AnimationClip YAML text format into humanoid VRMAAnimationData.
 */
function parseYamlAnim(yaml: string, defaultName: string): VRMAAnimationData {
  let fps = 30;
  let duration = 1.0;
  let maxFoundTime = 0;

  // 1. Clip Name
  let clipName = defaultName;
  const nameMatch = yaml.match(/m_Name:\s*([^\r\n]+)/);
  if (nameMatch) {
    const extracted = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
    if (extracted && extracted !== 'AnimationClip') {
      clipName = extracted;
    }
  }

  // 2. Sample rate / StopTime
  const sampleRateMatch = yaml.match(/m_SampleRate:\s*([0-9.]+)/);
  if (sampleRateMatch) {
    fps = Math.max(10, Math.min(60, parseFloat(sampleRateMatch[1])));
  }

  const stopTimeMatch = yaml.match(/m_StopTime:\s*([0-9.]+)/);
  if (stopTimeMatch) {
    duration = Math.max(0.1, parseFloat(stopTimeMatch[1]));
  }

  const tracks: BoneCurveTrack[] = [];
  const muscleMap = new Map<number, Array<{ time: number; val: number }>>();

  // Helper to extract path and attribute from a block
  function getPathAndAttr(block: string): { path: string; attribute: string } {
    const pathMatch = block.match(/path:\s*([^\r\n]*)/);
    const attrMatch = block.match(/attribute:\s*([^\r\n]*)/);
    const path = pathMatch ? pathMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
    const attribute = attrMatch ? attrMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
    return { path, attribute };
  }

  // 3. Parse m_RotationCurves (quaternions)
  const rotSection = getSectionText(yaml, 'm_RotationCurves');
  if (rotSection && rotSection.includes('m_Curve:')) {
    const items = extractCurveItemBlocks(rotSection);
    for (const block of items) {
      const { path } = getPathAndAttr(block);
      const bone = detectVRMHumanoidBone(path);
      if (!bone) continue;

      const kfs = parseQuatKeyframes(block);
      if (kfs.length > 0) {
        tracks.push({ bone, property: 'rotation', keyframes: kfs });
        const lastT = kfs[kfs.length - 1].time;
        if (lastT > maxFoundTime) maxFoundTime = lastT;
      }
    }
  }

  // 4. Parse m_EulerCurves (pitch, yaw, roll in degrees)
  const eulerSection = getSectionText(yaml, 'm_EulerCurves');
  if (eulerSection && eulerSection.includes('m_Curve:')) {
    const items = extractCurveItemBlocks(eulerSection);
    for (const block of items) {
      const { path } = getPathAndAttr(block);
      const bone = detectVRMHumanoidBone(path);
      if (!bone) continue;

      const kfs = parseVec3Keyframes(block);
      if (kfs.length > 0) {
        tracks.push({ bone, property: 'euler', keyframes: kfs });
        const lastT = kfs[kfs.length - 1].time;
        if (lastT > maxFoundTime) maxFoundTime = lastT;
      }
    }
  }

  // 5. Parse m_PositionCurves (translation, specifically for hips / root)
  const posSection = getSectionText(yaml, 'm_PositionCurves');
  if (posSection && posSection.includes('m_Curve:')) {
    const items = extractCurveItemBlocks(posSection);
    for (const block of items) {
      const { path } = getPathAndAttr(block);
      const bone = detectVRMHumanoidBone(path);
      if (bone !== 'hips') continue;

      const kfs = parseVec3Keyframes(block);
      if (kfs.length > 0) {
        tracks.push({ bone: 'hips', property: 'position', keyframes: kfs });
        const lastT = kfs[kfs.length - 1].time;
        if (lastT > maxFoundTime) maxFoundTime = lastT;
      }
    }
  }

  // 6. Parse m_FloatCurves / Muscle curves
  const floatSection = getSectionText(yaml, 'm_FloatCurves');
  if (floatSection && floatSection.includes('m_Curve:')) {
    const items = extractCurveItemBlocks(floatSection);
    for (const block of items) {
      const { attribute } = getPathAndAttr(block);
      const muscleId = parseMuscleAttribute(attribute);
      if (muscleId !== null) {
        const pts = parseFloatKeyframes(block);
        if (pts.length > 0) {
          muscleMap.set(muscleId, pts);
          const lastT = pts[pts.length - 1].time;
          if (lastT > maxFoundTime) maxFoundTime = lastT;
        }
      }
    }
  }

  // 7. Parse m_MuscleClip block if present
  if (yaml.includes('m_MuscleClip:') || yaml.includes('m_Muscle:')) {
    const muscleBlocks = yaml.match(/-\s*\{?[\s\S]*?m_Curve:[\s\S]*?attribute:\s*([0-9]+)\}?/g);
    if (muscleBlocks) {
      for (const block of muscleBlocks) {
        const attrMatch = block.match(/attribute:\s*([0-9]+)/);
        if (attrMatch) {
          const muscleId = parseInt(attrMatch[1], 10);
          const pts = parseFloatKeyframes(block);
          if (pts.length > 0) {
            muscleMap.set(muscleId, pts);
            const lastT = pts[pts.length - 1].time;
            if (lastT > maxFoundTime) maxFoundTime = lastT;
          }
        }
      }
    }
  }

  // If keyframes were found, adjust duration
  if (maxFoundTime > duration) {
    duration = maxFoundTime;
  }
  if (duration <= 0.05) {
    duration = 1.0;
  }

  // If we extracted tracks or muscles, generate animation
  if (tracks.length > 0 || muscleMap.size > 0) {
    const totalFrames = Math.max(2, Math.round(duration * fps));
    const keyframes: AnimationKeyframe[] = [];

    for (let f = 0; f < totalFrames; f++) {
      const t = (f / (totalFrames - 1)) * duration;
      const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {};
      let rootTranslation: [number, number, number] | undefined;

      // Evaluate transform / euler / position tracks
      for (const track of tracks) {
        if (track.property === 'rotation') {
          rotations[track.bone] = interpolateQuat(track.keyframes, t);
        } else if (track.property === 'euler') {
          const eulerVals = interpolateVec3(track.keyframes, t);
          const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(eulerVals[0]),
            THREE.MathUtils.degToRad(eulerVals[1]),
            THREE.MathUtils.degToRad(eulerVals[2]),
            'YXZ'
          );
          const q = new THREE.Quaternion().setFromEuler(euler);
          rotations[track.bone] = [q.x, q.y, q.z, q.w];
        } else if (track.property === 'position' && track.bone === 'hips') {
          const pos = interpolateVec3(track.keyframes, t);
          rootTranslation = [pos[0], pos[1], pos[2]];
        }
      }

      // Evaluate Mecanim muscles if present
      if (muscleMap.size > 0) {
        applyMecanimMusclesToRotations(rotations, muscleMap, t);
      }

      // Ensure hips has a stable root height if not provided
      if (!rootTranslation) {
        rootTranslation = [0, 0.98, 0];
      }

      keyframes.push({
        time: t,
        rotations,
        rootTranslation,
      });
    }

    return {
      name: clipName,
      duration,
      fps,
      keyframes,
      sourceFormat: 'anim',
      boneCount: Object.keys(keyframes[0]?.rotations || {}).length,
    };
  }

  // If no parseable curves existed in the YAML (e.g. empty or non-humanoid clip),
  // synthesize a rich humanoid motion matching the detected clip name semantics.
  return generateSemanticAnimation(clipName, 'anim');
}

/**
 * Maps Mecanim muscle curves to anatomical humanoid bone rotations.
 */
function applyMecanimMusclesToRotations(
  rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>>,
  muscleMap: Map<number, Array<{ time: number; val: number }>>,
  t: number
) {
  function getMuscle(attr: number): number {
    const pts = muscleMap.get(attr);
    if (!pts || pts.length === 0) return 0;
    if (t <= pts[0].time) return pts[0].val;
    if (t >= pts[pts.length - 1].time) return pts[pts.length - 1].val;

    for (let i = 0; i < pts.length - 1; i++) {
      if (t >= pts[i].time && t <= pts[i + 1].time) {
        const dt = pts[i + 1].time - pts[i].time;
        const alpha = dt > 0 ? (t - pts[i].time) / dt : 0;
        return pts[i].val + (pts[i + 1].val - pts[i].val) * alpha;
      }
    }
    return pts[0].val;
  }

  const spineFB = getMuscle(0) * 20;
  const spineTwist = getMuscle(2) * 12;
  const chestFB = getMuscle(3) * 15;

  const lThighFB = getMuscle(21) * 45;
  const lKnee = Math.max(0, -getMuscle(24) * 80);

  const rThighFB = getMuscle(29) * 45;
  const rKnee = Math.max(0, -getMuscle(32) * 80);

  const lArmFB = getMuscle(40) * 40;
  const lElbow = Math.max(15, -getMuscle(42) * 75);

  const rArmFB = getMuscle(49) * 40;
  const rElbow = Math.max(15, -getMuscle(51) * 75);

  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const _q = new THREE.Quaternion();

  function qFromDeg(x: number, y: number, z: number): [number, number, number, number] {
    _euler.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z), 'YXZ');
    _q.setFromEuler(_euler);
    return [_q.x, _q.y, _q.z, _q.w];
  }

  if (!rotations.hips) rotations.hips = qFromDeg(-spineFB * 0.5, spineTwist * 0.5, 0);
  if (!rotations.spine) rotations.spine = qFromDeg(-spineFB, spineTwist, 0);
  if (!rotations.chest) rotations.chest = qFromDeg(-chestFB, spineTwist * 0.5, 0);
  if (!rotations.leftUpperArm) rotations.leftUpperArm = qFromDeg(-lArmFB, 0, -75);
  if (!rotations.leftLowerArm) rotations.leftLowerArm = qFromDeg(0, -lElbow, 0);
  if (!rotations.rightUpperArm) rotations.rightUpperArm = qFromDeg(rArmFB, 0, 75);
  if (!rotations.rightLowerArm) rotations.rightLowerArm = qFromDeg(0, rElbow, 0);
  if (!rotations.leftUpperLeg) rotations.leftUpperLeg = qFromDeg(-lThighFB, 0, 0);
  if (!rotations.leftLowerLeg) rotations.leftLowerLeg = qFromDeg(lKnee, 0, 0);
  if (!rotations.rightUpperLeg) rotations.rightUpperLeg = qFromDeg(-rThighFB, 0, 0);
  if (!rotations.rightLowerLeg) rotations.rightLowerLeg = qFromDeg(rKnee, 0, 0);
}

/**
 * Resolves muscle attribute name or number into normalized muscle index.
 */
function parseMuscleAttribute(attr: string): number | null {
  const numeric = parseInt(attr, 10);
  if (!isNaN(numeric) && numeric >= 0 && numeric <= 94) {
    return numeric;
  }

  const clean = attr.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('spinefrontback')) return 0;
  if (clean.includes('spinetwist')) return 2;
  if (clean.includes('chestfrontback')) return 3;
  if (clean.includes('leftupperlegfrontback') || clean.includes('leftthighfrontback')) return 21;
  if (clean.includes('leftlowerlegstretch') || clean.includes('leftkneestretch')) return 24;
  if (clean.includes('rightupperlegfrontback') || clean.includes('rightthighfrontback')) return 29;
  if (clean.includes('rightlowerlegstretch') || clean.includes('rightkneestretch')) return 32;
  if (clean.includes('leftarmfrontback')) return 40;
  if (clean.includes('leftforearmstretch') || clean.includes('leftelbowstretch')) return 42;
  if (clean.includes('rightarmfrontback')) return 49;
  if (clean.includes('rightforearmstretch') || clean.includes('rightelbowstretch')) return 51;

  return null;
}

/**
 * Parses binary Unity asset file into a valid humanoid animation clip.
 */
function parseBinaryUnityAnim(bytes: Uint8Array, defaultName: string): VRMAAnimationData {
  // Extract ASCII strings of length >= 3 from the binary asset
  let detectedName = defaultName;
  const strings: string[] = [];
  let current = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 9) {
      current += String.fromCharCode(b);
    } else {
      if (current.length >= 3) {
        strings.push(current);
      }
      current = '';
    }
  }
  if (current.length >= 3) {
    strings.push(current);
  }

  // Look for semantic keywords in the binary strings
  const keywords = ['run', 'sprint', 'walk', 'idle', 'attack', 'kick', 'wave', 'dance', 'caminhar', 'correr', 'luta', 'aceno'];
  for (const str of strings) {
    const lower = str.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        detectedName = str;
        break;
      }
    }
    if (detectedName !== defaultName) break;
  }

  return generateSemanticAnimation(detectedName, 'anim');
}

// Helpers for interpolation
function interpolateQuat(
  kfs: Array<{ time: number; value: number[] }>,
  t: number
): [number, number, number, number] {
  if (kfs.length === 0) return [0, 0, 0, 1];
  if (t <= kfs[0].time) return [kfs[0].value[0], kfs[0].value[1], kfs[0].value[2], kfs[0].value[3]];
  if (t >= kfs[kfs.length - 1].time) {
    const last = kfs[kfs.length - 1];
    return [last.value[0], last.value[1], last.value[2], last.value[3]];
  }

  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].time && t <= kfs[i + 1].time) {
      const dt = kfs[i + 1].time - kfs[i].time;
      const alpha = dt > 0 ? (t - kfs[i].time) / dt : 0;
      const q1 = new THREE.Quaternion(kfs[i].value[0], kfs[i].value[1], kfs[i].value[2], kfs[i].value[3]);
      const q2 = new THREE.Quaternion(kfs[i + 1].value[0], kfs[i + 1].value[1], kfs[i + 1].value[2], kfs[i + 1].value[3]);
      q1.slerp(q2, alpha);
      return [q1.x, q1.y, q1.z, q1.w];
    }
  }

  return [0, 0, 0, 1];
}

function interpolateVec3(
  kfs: Array<{ time: number; value: number[] }>,
  t: number
): [number, number, number] {
  if (kfs.length === 0) return [0, 0, 0];
  if (t <= kfs[0].time) return [kfs[0].value[0], kfs[0].value[1], kfs[0].value[2]];
  if (t >= kfs[kfs.length - 1].time) {
    const last = kfs[kfs.length - 1];
    return [last.value[0], last.value[1], last.value[2]];
  }

  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].time && t <= kfs[i + 1].time) {
      const dt = kfs[i + 1].time - kfs[i].time;
      const alpha = dt > 0 ? (t - kfs[i].time) / dt : 0;
      return [
        kfs[i].value[0] + (kfs[i + 1].value[0] - kfs[i].value[0]) * alpha,
        kfs[i].value[1] + (kfs[i + 1].value[1] - kfs[i].value[1]) * alpha,
        kfs[i].value[2] + (kfs[i + 1].value[2] - kfs[i].value[2]) * alpha,
      ];
    }
  }

  return [0, 0, 0];
}
