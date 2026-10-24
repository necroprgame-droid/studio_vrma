import { ExtractedAsset } from '../types';

/**
 * Creates realistic sample assets simulating an extracted .unitypackage
 * containing animations, character FBX, and Unity metadata.
 */
export function createSampleUnityPackageAssets(): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];
  const dummyFbxHeader = new TextEncoder().encode('Kaydara FBX Binary  \0\x1a\0');

  // 1. Warrior_Sprint_Run.fbx (FBX Sprint cycle)
  assets.push({
    guid: 'a1b2c3d4e5f67890123456789abcdef0',
    pathname: 'Assets/Animations/Warrior_Sprint_Run.fbx',
    filename: 'Warrior_Sprint_Run.fbx',
    extension: 'fbx',
    size: 245800,
    data: dummyFbxHeader,
    isAnimationCandidate: true,
    metaContent: `fileFormatVersion: 2
guid: a1b2c3d4e5f67890123456789abcdef0
ModelImporter:
  animationType: 3 # Humanoid
  humanDescription:
    human:
      - boneName: Hips
        humanName: Hips`,
  });

  // 2. Warrior_Combat_Kick.fbx (FBX Martial Kick)
  assets.push({
    guid: 'b2c3d4e5f67890123456789abcdef01a',
    pathname: 'Assets/Animations/Warrior_Combat_Kick.fbx',
    filename: 'Warrior_Combat_Kick.fbx',
    extension: 'fbx',
    size: 312400,
    data: dummyFbxHeader,
    isAnimationCandidate: true,
    metaContent: `fileFormatVersion: 2
guid: b2c3d4e5f67890123456789abcdef01a
ModelImporter:
  animationType: 3 # Humanoid`,
  });

  // 3. Warrior_Casual_Walk.fbx (FBX Casual Walk)
  assets.push({
    guid: 'c3d4e5f67890123456789abcdef01a2b',
    pathname: 'Assets/Animations/Warrior_Casual_Walk.fbx',
    filename: 'Warrior_Casual_Walk.fbx',
    extension: 'fbx',
    size: 198200,
    data: dummyFbxHeader,
    isAnimationCandidate: true,
  });

  // 4. Idle_Breathing.anim (Unity YAML muscle clip)
  const idleAnimYaml = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!74 &7400000
AnimationClip:
  m_Name: Idle_Breathing
  m_SampleRate: 30
  m_StopTime: 2.4
  m_RotationCurves:
  - curve:
      m_Curve:
      - time: 0
        value: {x: 0, y: 0, z: 0, w: 1}
      - time: 1.2
        value: {x: 0.02, y: 0, z: 0, w: 0.999}
      - time: 2.4
        value: {x: 0, y: 0, z: 0, w: 1}
    path: Hips/Spine/Chest
`;
  assets.push({
    guid: 'd4e5f67890123456789abcdef01a2b3c',
    pathname: 'Assets/Animations/Clips/Idle_Breathing.anim',
    filename: 'Idle_Breathing.anim',
    extension: 'anim',
    size: 45200,
    data: new TextEncoder().encode(idleAnimYaml),
    isAnimationCandidate: true,
  });

  // 5. Victory_Dance.anim (Unity YAML dance clip)
  const danceAnimYaml = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!74 &7400000
AnimationClip:
  m_Name: Victory_Dance
  m_SampleRate: 30
  m_StopTime: 1.6
  m_RotationCurves:
  - curve:
      m_Curve:
      - time: 0
        value: {x: 0, y: 0.1, z: 0, w: 0.99}
      - time: 0.8
        value: {x: 0, y: -0.1, z: 0, w: 0.99}
      - time: 1.6
        value: {x: 0, y: 0.1, z: 0, w: 0.99}
    path: Hips/Spine
`;
  assets.push({
    guid: 'e1f2a3b4c5d67890123456789abcdef1',
    pathname: 'Assets/Animations/Clips/Victory_Dance.anim',
    filename: 'Victory_Dance.anim',
    extension: 'anim',
    size: 58400,
    data: new TextEncoder().encode(danceAnimYaml),
    isAnimationCandidate: true,
  });

  // 6. Friendly_Wave.anim (Unity YAML wave clip)
  const waveAnimYaml = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!74 &7400000
AnimationClip:
  m_Name: Friendly_Wave
  m_SampleRate: 30
  m_StopTime: 1.6
  m_RotationCurves:
  - curve:
      m_Curve:
      - time: 0
        value: {x: 0.2, y: 0, z: 0.3, w: 0.9}
      - time: 0.4
        value: {x: 0.2, y: 0, z: 0.5, w: 0.8}
      - time: 0.8
        value: {x: 0.2, y: 0, z: 0.3, w: 0.9}
      - time: 1.2
        value: {x: 0.2, y: 0, z: 0.5, w: 0.8}
      - time: 1.6
        value: {x: 0.2, y: 0, z: 0.3, w: 0.9}
    path: Hips/Spine/Chest/RightUpperArm
`;
  assets.push({
    guid: 'f2a3b4c5d6e7890123456789abcdef2',
    pathname: 'Assets/Animations/Clips/Friendly_Wave.anim',
    filename: 'Friendly_Wave.anim',
    extension: 'anim',
    size: 42100,
    data: new TextEncoder().encode(waveAnimYaml),
    isAnimationCandidate: true,
  });

  // 7. Character_Mannequin.fbx (Hero mesh)
  assets.push({
    guid: 'e5f67890123456789abcdef01a2b3c4d',
    pathname: 'Assets/Characters/Hero_Mannequin.fbx',
    filename: 'Hero_Mannequin.fbx',
    extension: 'fbx',
    size: 1420000,
    data: dummyFbxHeader,
    isAnimationCandidate: false,
  });

  // 8. Avatar_Texture.png (Texture)
  assets.push({
    guid: 'f67890123456789abcdef01a2b3c4d5e',
    pathname: 'Assets/Textures/Hero_Albedo.png',
    filename: 'Hero_Albedo.png',
    extension: 'png',
    size: 512000,
    data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    isAnimationCandidate: false,
  });

  // 9. Hero_Material.mat
  assets.push({
    guid: '07890123456789abcdef01a2b3c4d5ef',
    pathname: 'Assets/Materials/Hero_PBR.mat',
    filename: 'Hero_PBR.mat',
    extension: 'mat',
    size: 3200,
    data: new TextEncoder().encode('%YAML 1.1\nMaterial:\n  m_Name: Hero_PBR\n'),
    isAnimationCandidate: false,
  });

  return assets;
}
