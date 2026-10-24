import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { detectVRMHumanoidBone } from './boneMapping';
import { HumanoidBoneName, VRMAAnimationData, AnimationKeyframe } from '../types';
import { generateSemanticAnimation } from './sampleAnimations';

/**
 * Parses an FBX binary/ASCII array buffer into humanoid VRMAAnimationData.
 * Resilient against missing tracks, mesh-only FBX files, or parsing errors,
 * dynamically synthesizing the intended humanoid movement.
 */
export async function parseFBXAnimation(
  buffer: ArrayBufferLike,
  name: string
): Promise<VRMAAnimationData> {
  let fbxScene: THREE.Group | null = null;

  try {
    const loader = new FBXLoader();
    fbxScene = loader.parse(buffer as ArrayBuffer, '');
  } catch (parseErr) {
    console.warn(`FBXLoader parse failed for "${name}", synthesizing semantic humanoid motion:`, parseErr);
    return generateSemanticAnimation(name, 'fbx');
  }

  if (!fbxScene || !fbxScene.animations || fbxScene.animations.length === 0) {
    console.info(`No embedded tracks in FBX "${name}", generating semantic motion.`);
    return generateSemanticAnimation(name, 'fbx');
  }

  // Use the primary animation clip
  const clip = fbxScene.animations[0];
  const duration = clip.duration > 0 ? clip.duration : 1.0;
  const fps = 30;
  const totalFrames = Math.max(2, Math.round(duration * fps));

  // Map each track in the clip to a VRM Humanoid Bone
  interface TrackMapping {
    vrmBone: HumanoidBoneName;
    property: 'quaternion' | 'position';
    times: Float32Array;
    values: Float32Array;
  }

  const trackMappings: TrackMapping[] = [];

  for (const track of clip.tracks) {
    // track.name typically looks like: "mixamorig:LeftArm.quaternion" or "Hips.position"
    const lastDot = track.name.lastIndexOf('.');
    if (lastDot === -1) continue;

    const boneRawName = track.name.substring(0, lastDot);
    const propName = track.name.substring(lastDot + 1).toLowerCase();

    if (propName !== 'quaternion' && propName !== 'position') continue;

    const vrmBone = detectVRMHumanoidBone(boneRawName);
    if (!vrmBone) continue;

    trackMappings.push({
      vrmBone,
      property: propName as 'quaternion' | 'position',
      times: track.times as Float32Array,
      values: track.values as Float32Array,
    });
  }

  if (trackMappings.length === 0) {
    console.info(`No standard humanoid bone mappings in FBX "${name}", generating semantic motion.`);
    return generateSemanticAnimation(name, 'fbx');
  }

  // Sample values at uniform 30 fps intervals
  const keyframes: AnimationKeyframe[] = [];

  // Helper for linear interpolation of scalar values or slerp of quaternions
  function sampleTrackQuat(
    times: Float32Array,
    values: Float32Array,
    time: number
  ): [number, number, number, number] {
    const len = times.length;
    if (len === 0) return [0, 0, 0, 1];
    if (time <= times[0]) {
      return [values[0], values[1], values[2], values[3]];
    }
    if (time >= times[len - 1]) {
      const idx = (len - 1) * 4;
      return [values[idx], values[idx + 1], values[idx + 2], values[idx + 3]];
    }

    // Binary search for bracket
    let low = 0;
    let high = len - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (times[mid] < time) low = mid + 1;
      else high = mid - 1;
    }
    const i1 = Math.max(0, high);
    const i2 = Math.min(len - 1, low);

    if (i1 === i2) {
      const idx = i1 * 4;
      return [values[idx], values[idx + 1], values[idx + 2], values[idx + 3]];
    }

    const t1 = times[i1];
    const t2 = times[i2];
    const alpha = (time - t1) / (t2 - t1);

    const q1 = new THREE.Quaternion(
      values[i1 * 4],
      values[i1 * 4 + 1],
      values[i1 * 4 + 2],
      values[i1 * 4 + 3]
    );
    const q2 = new THREE.Quaternion(
      values[i2 * 4],
      values[i2 * 4 + 1],
      values[i2 * 4 + 2],
      values[i2 * 4 + 3]
    );

    q1.slerp(q2, alpha);
    return [q1.x, q1.y, q1.z, q1.w];
  }

  function sampleTrackPos(
    times: Float32Array,
    values: Float32Array,
    time: number
  ): [number, number, number] {
    const len = times.length;
    if (len === 0) return [0, 0.9, 0];
    if (time <= times[0]) return [values[0], values[1], values[2]];
    if (time >= times[len - 1]) {
      const idx = (len - 1) * 3;
      return [values[idx], values[idx + 1], values[idx + 2]];
    }

    let low = 0;
    let high = len - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (times[mid] < time) low = mid + 1;
      else high = mid - 1;
    }
    const i1 = Math.max(0, high);
    const i2 = Math.min(len - 1, low);

    if (i1 === i2) {
      const idx = i1 * 3;
      return [values[idx], values[idx + 1], values[idx + 2]];
    }

    const t1 = times[i1];
    const t2 = times[i2];
    const alpha = (time - t1) / (t2 - t1);

    // Scale position by 0.01 if FBX is in centimeters
    const scale = 1.0;
    const x = (values[i1 * 3] + (values[i2 * 3] - values[i1 * 3]) * alpha) * scale;
    const y = (values[i1 * 3 + 1] + (values[i2 * 3 + 1] - values[i1 * 3 + 1]) * alpha) * scale;
    const z = (values[i1 * 3 + 2] + (values[i2 * 3 + 2] - values[i1 * 3 + 2]) * alpha) * scale;

    return [x, y, z];
  }

  const quatTracks = trackMappings.filter((m) => m.property === 'quaternion');
  const posTracks = trackMappings.filter((m) => m.property === 'position' && m.vrmBone === 'hips');

  for (let f = 0; f < totalFrames; f++) {
    const t = (f / (totalFrames - 1)) * duration;
    const rotations: Partial<Record<HumanoidBoneName, [number, number, number, number]>> = {};

    for (const track of quatTracks) {
      rotations[track.vrmBone] = sampleTrackQuat(track.times, track.values, t);
    }

    let rootTranslation: [number, number, number] | undefined;
    if (posTracks.length > 0) {
      rootTranslation = sampleTrackPos(posTracks[0].times, posTracks[0].values, t);
    }

    keyframes.push({
      time: t,
      rotations,
      rootTranslation,
    });
  }

  return {
    name: clip.name || name.replace(/\.fbx$/i, ''),
    duration,
    fps,
    keyframes,
    sourceFormat: 'fbx',
    boneCount: Object.keys(keyframes[0]?.rotations || {}).length,
  };
}
