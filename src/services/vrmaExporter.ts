import { HumanoidBoneName, VRMAAnimationData } from '../types';

export const VRM_HUMANOID_BONES: HumanoidBoneName[] = [
  'hips',
  'spine',
  'chest',
  'upperChest',
  'neck',
  'head',
  'leftShoulder',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightShoulder',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'leftToes',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
  'rightToes',
];

/**
 * Builds a binary glTF 2.0 (.glb) with VRMC_vrm_animation 1.0 extension.
 */
export function exportToVRMA(animData: VRMAAnimationData): Uint8Array {
  const bonesInAnim = VRM_HUMANOID_BONES.filter((b) =>
    animData.keyframes.some((kf) => kf.rotations[b] !== undefined)
  );

  // If hips translation exists, we will also export translation track for hips
  const hasRootTranslation = animData.keyframes.some(
    (kf) => kf.rootTranslation !== undefined
  );

  // Map each bone to a glTF node index
  const boneNodeIndexMap: Record<string, number> = {};
  const nodes: Array<{ name: string; children?: number[] }> = [];

  // Create nodes hierarchy
  bonesInAnim.forEach((boneName, idx) => {
    boneNodeIndexMap[boneName] = idx;
    nodes.push({ name: boneName });
  });

  // Setup basic parent-child hierarchy in nodes
  const parentMap: Partial<Record<HumanoidBoneName, HumanoidBoneName>> = {
    spine: 'hips',
    chest: 'spine',
    upperChest: 'chest',
    neck: 'upperChest',
    head: 'neck',
    leftShoulder: 'upperChest',
    leftUpperArm: 'leftShoulder',
    leftLowerArm: 'leftUpperArm',
    leftHand: 'leftLowerArm',
    rightShoulder: 'upperChest',
    rightUpperArm: 'rightShoulder',
    rightLowerArm: 'rightUpperArm',
    rightHand: 'rightLowerArm',
    leftUpperLeg: 'hips',
    leftLowerLeg: 'leftUpperLeg',
    leftFoot: 'leftLowerLeg',
    leftToes: 'leftFoot',
    rightUpperLeg: 'hips',
    rightLowerLeg: 'rightUpperLeg',
    rightFoot: 'rightLowerLeg',
    rightToes: 'rightFoot',
  };

  for (const [child, parent] of Object.entries(parentMap)) {
    const childIdx = boneNodeIndexMap[child];
    const parentIdx = boneNodeIndexMap[parent as HumanoidBoneName];
    if (childIdx !== undefined && parentIdx !== undefined) {
      if (!nodes[parentIdx].children) {
        nodes[parentIdx].children = [];
      }
      nodes[parentIdx].children!.push(childIdx);
    }
  }

  // Create binary buffers for time and rotation/translation values
  const keyframeCount = animData.keyframes.length;
  const times = new Float32Array(keyframeCount);
  for (let i = 0; i < keyframeCount; i++) {
    times[i] = animData.keyframes[i].time;
  }

  const minTime = times[0] ?? 0;
  const maxTime = times[times.length - 1] ?? 0;

  // We pack everything into a single contiguous binary buffer
  const binChunks: Uint8Array[] = [];
  let currentByteOffset = 0;

  interface BufferViewInfo {
    byteOffset: number;
    byteLength: number;
  }

  interface AccessorInfo {
    bufferView: number;
    byteOffset: number;
    componentType: number; // 5126 = FLOAT
    count: number;
    type: 'SCALAR' | 'VEC3' | 'VEC4';
    min?: number[];
    max?: number[];
  }

  const bufferViews: BufferViewInfo[] = [];
  const accessors: AccessorInfo[] = [];

  // Helper to add data to binary buffer
  function addDataToBuffer(
    dataArray: Float32Array,
    type: 'SCALAR' | 'VEC3' | 'VEC4',
    min?: number[],
    max?: number[]
  ): number {
    const uint8 = new Uint8Array(dataArray.buffer, dataArray.byteOffset, dataArray.byteLength);
    const byteLength = uint8.length;
    binChunks.push(uint8);

    const bViewIndex = bufferViews.length;
    bufferViews.push({
      byteOffset: currentByteOffset,
      byteLength: byteLength,
    });
    currentByteOffset += byteLength;

    // Pad to 4-byte alignment if needed
    const remainder = currentByteOffset % 4;
    if (remainder !== 0) {
      const pad = 4 - remainder;
      binChunks.push(new Uint8Array(pad));
      currentByteOffset += pad;
    }

    const accessorIndex = accessors.length;
    accessors.push({
      bufferView: bViewIndex,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: type === 'SCALAR' ? dataArray.length : type === 'VEC3' ? dataArray.length / 3 : dataArray.length / 4,
      type: type,
      min,
      max,
    });

    return accessorIndex;
  }

  // 1. Time accessor (SCALAR)
  const timeAccessorIdx = addDataToBuffer(times, 'SCALAR', [minTime], [maxTime]);

  // glTF Animation channels & samplers
  const channels: Array<{
    sampler: number;
    target: { node: number; path: 'rotation' | 'translation' };
  }> = [];

  const samplers: Array<{
    input: number;
    output: number;
    interpolation: 'LINEAR';
  }> = [];

  // 2. Bone rotation tracks (VEC4 quaternions [x, y, z, w])
  for (const bone of bonesInAnim) {
    const nodeIdx = boneNodeIndexMap[bone];
    const quatArray = new Float32Array(keyframeCount * 4);

    for (let i = 0; i < keyframeCount; i++) {
      const q = animData.keyframes[i].rotations[bone] ?? [0, 0, 0, 1];
      quatArray[i * 4 + 0] = q[0];
      quatArray[i * 4 + 1] = q[1];
      quatArray[i * 4 + 2] = q[2];
      quatArray[i * 4 + 3] = q[3];
    }

    const quatAccessorIdx = addDataToBuffer(quatArray, 'VEC4');
    const samplerIdx = samplers.length;
    samplers.push({
      input: timeAccessorIdx,
      output: quatAccessorIdx,
      interpolation: 'LINEAR',
    });

    channels.push({
      sampler: samplerIdx,
      target: {
        node: nodeIdx,
        path: 'rotation',
      },
    });
  }

  // 3. Optional root translation (VEC3 [x, y, z])
  if (hasRootTranslation && boneNodeIndexMap['hips'] !== undefined) {
    const transArray = new Float32Array(keyframeCount * 3);
    for (let i = 0; i < keyframeCount; i++) {
      const t = animData.keyframes[i].rootTranslation ?? [0, 0.9, 0];
      transArray[i * 3 + 0] = t[0];
      transArray[i * 3 + 1] = t[1];
      transArray[i * 3 + 2] = t[2];
    }

    const transAccessorIdx = addDataToBuffer(transArray, 'VEC3');
    const transSamplerIdx = samplers.length;
    samplers.push({
      input: timeAccessorIdx,
      output: transAccessorIdx,
      interpolation: 'LINEAR',
    });

    channels.push({
      sampler: transSamplerIdx,
      target: {
        node: boneNodeIndexMap['hips'],
        path: 'translation',
      },
    });
  }

  // Combine binary chunks into a single byte array
  const totalBinSize = currentByteOffset;
  const binaryBuffer = new Uint8Array(totalBinSize);
  let writeOffset = 0;
  for (const chunk of binChunks) {
    binaryBuffer.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  // VRMC_vrm_animation humanoid bones mapping object
  const vrmaBonesMap: Record<string, { node: number }> = {};
  for (const bone of bonesInAnim) {
    vrmaBonesMap[bone] = { node: boneNodeIndexMap[bone] };
  }

  // glTF 2.0 structure
  const gltfObject = {
    asset: {
      version: '2.0',
      generator: 'Unity2VRMA Studio - VRMC_vrm_animation 1.0',
      extras: {
        unity2vrma: {
          originalName: animData.name,
          sourceFormat: animData.sourceFormat,
          exportedAt: new Date().toISOString(),
          fps: animData.fps,
          duration: animData.duration,
        },
      },
    },
    extensionsUsed: ['VRMC_vrm_animation'],
    extensions: {
      VRMC_vrm_animation: {
        specVersion: '1.0',
        humanoid: {
          bones: vrmaBonesMap,
        },
      },
    },
    scene: 0,
    scenes: [
      {
        nodes: [0], // Root node (hips)
      },
    ],
    nodes,
    animations: [
      {
        name: animData.name || 'VRMA_Animation',
        channels,
        samplers,
      },
    ],
    bufferViews,
    accessors,
    buffers: [
      {
        byteLength: totalBinSize,
      },
    ],
  };

  const jsonString = JSON.stringify(gltfObject);
  const jsonBytes = new TextEncoder().encode(jsonString);

  // glTF chunk alignment: chunks must be 4-byte aligned
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunkLength = jsonBytes.length + jsonPadding;

  const binPadding = (4 - (binaryBuffer.length % 4)) % 4;
  const binChunkLength = binaryBuffer.length + binPadding;

  // Total GLB size = 12 (header) + 8 + jsonChunkLength + 8 + binChunkLength
  const totalGlbLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

  const glbBuffer = new Uint8Array(totalGlbLength);
  const view = new DataView(glbBuffer.buffer);

  // 1. Header (12 bytes)
  // Magic: 0x46546C67 ("glTF")
  view.setUint32(0, 0x46546c67, true);
  // Version: 2
  view.setUint32(4, 2, true);
  // Total length
  view.setUint32(8, totalGlbLength, true);

  // 2. JSON Chunk Header (8 bytes)
  let cursor = 12;
  view.setUint32(cursor, jsonChunkLength, true);
  // Chunk type: 0x4E4F534A ("JSON")
  view.setUint32(cursor + 4, 0x4e4f534a, true);
  cursor += 8;

  // JSON Chunk payload
  glbBuffer.set(jsonBytes, cursor);
  cursor += jsonBytes.length;
  // Pad with spaces (0x20)
  for (let p = 0; p < jsonPadding; p++) {
    glbBuffer[cursor++] = 0x20;
  }

  // 3. BIN Chunk Header (8 bytes)
  view.setUint32(cursor, binChunkLength, true);
  // Chunk type: 0x004E4942 ("BIN\0")
  view.setUint32(cursor + 4, 0x004e4942, true);
  cursor += 8;

  // BIN Chunk payload
  glbBuffer.set(binaryBuffer, cursor);
  cursor += binaryBuffer.length;
  // Pad with zeros (0x00)
  for (let p = 0; p < binPadding; p++) {
    glbBuffer[cursor++] = 0x00;
  }

  return glbBuffer;
}
