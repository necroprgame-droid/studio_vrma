import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SAMPLE_ANIMATIONS } from '../services/sampleAnimations';
import { ExtractedAsset, HumanoidBoneName, VRMAAnimationData } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Eye,
  Bone as BoneIcon,
  Shield,
  Compass,
  FlipHorizontal,
  Camera,
  Palette,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers,
} from 'lucide-react';

export type StageTheme = 'studio' | 'neon' | 'dojo' | 'grid';
export type AvatarSkin = 'indigo' | 'chrome' | 'gold' | 'white';

interface Viewport3DProps {
  animationData: VRMAAnimationData | null;
  playbackSpeed: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  showSkeleton: boolean;
  onToggleSkeleton: () => void;
  showMannequin: boolean;
  onToggleMannequin: () => void;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onInspectBone?: (boneName: HumanoidBoneName, rot: [number, number, number, number]) => void;
  // Stage Features
  importedAssets?: ExtractedAsset[];
  onSelectImportedAsset?: (asset: ExtractedAsset) => void;
  onSelectPreset?: (id: string) => void;
  currentAnimId?: string;
}

interface BoneObjectHierarchy {
  group: THREE.Group;
  bones: Partial<Record<HumanoidBoneName, THREE.Group>>;
  skeletonHelper: THREE.SkeletonHelper;
  mannequinMaterials: THREE.MeshStandardMaterial[];
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  animationData,
  playbackSpeed,
  isPlaying,
  onTogglePlay,
  showSkeleton,
  onToggleSkeleton,
  showMannequin,
  onToggleMannequin,
  currentTime,
  onTimeUpdate,
  onInspectBone,
  importedAssets = [],
  onSelectImportedAsset,
  onSelectPreset,
  currentAnimId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animTimeRef = useRef<number>(currentTime);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  const animDataRef = useRef<VRMAAnimationData | null>(animationData);
  const boneHierarchyRef = useRef<BoneObjectHierarchy | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onInspectBoneRef = useRef(onInspectBone);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const lightsRef = useRef<{
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.HemisphereLight;
    rimLight: THREE.DirectionalLight;
    spotlightA?: THREE.SpotLight;
    spotlightB?: THREE.SpotLight;
    gridHelper?: THREE.GridHelper;
  } | null>(null);

  const [activeBoneInspect, setActiveBoneInspect] = useState<string>('hips');
  const [invertOrientation, setInvertOrientation] = useState<boolean>(false);
  const invertOrientationRef = useRef(invertOrientation);

  // Stage customization states
  const [stageTheme, setStageTheme] = useState<StageTheme>('studio');
  const [avatarSkin, setAvatarSkin] = useState<AvatarSkin>('indigo');
  const [cameraAngle, setCameraAngle] = useState<'front' | 'side' | 'top' | 'close' | 'free'>('front');

  const animationCandidates = importedAssets.filter((a) => a.isAnimationCandidate);

  useEffect(() => {
    invertOrientationRef.current = invertOrientation;
    if (boneHierarchyRef.current) {
      boneHierarchyRef.current.group.rotation.y = invertOrientation ? Math.PI : 0;
    }
  }, [invertOrientation]);

  // Keep refs in sync to avoid tearing down the WebGL scene
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    animDataRef.current = animationData;
    animTimeRef.current = 0;
  }, [animationData]);

  useEffect(() => {
    animTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onInspectBoneRef.current = onInspectBone;
  }, [onTimeUpdate, onInspectBone]);

  // Switch Avatar Skin Material
  useEffect(() => {
    if (!boneHierarchyRef.current) return;
    const mats = boneHierarchyRef.current.mannequinMaterials;

    mats.forEach((mat) => {
      if (avatarSkin === 'chrome') {
        mat.color.setHex(0xe2e8f0);
        mat.roughness = 0.12;
        mat.metalness = 0.95;
      } else if (avatarSkin === 'gold') {
        mat.color.setHex(0xf59e0b);
        mat.roughness = 0.22;
        mat.metalness = 0.88;
      } else if (avatarSkin === 'white') {
        mat.color.setHex(0xf8fafc);
        mat.roughness = 0.65;
        mat.metalness = 0.05;
      } else {
        // Indigo
        mat.color.setHex(0x3b82f6);
        mat.roughness = 0.35;
        mat.metalness = 0.15;
      }
      mat.needsUpdate = true;
    });
  }, [avatarSkin]);

  // Switch Stage Environment Lighting and Grid
  useEffect(() => {
    if (!lightsRef.current) return;
    const { keyLight, fillLight, rimLight, gridHelper, spotlightA, spotlightB } = lightsRef.current;

    if (stageTheme === 'neon') {
      keyLight.color.setHex(0xc084fc); // Purple neon
      fillLight.color.setHex(0x38bdf8); // Cyan
      fillLight.groundColor.setHex(0x1e1b4b);
      rimLight.color.setHex(0x06b6d4);
      if (gridHelper) {
        (gridHelper.material as THREE.LineBasicMaterial).color.setHex(0x818cf8);
      }
      if (spotlightA) spotlightA.intensity = 3.0;
      if (spotlightB) spotlightB.intensity = 3.0;
    } else if (stageTheme === 'dojo') {
      keyLight.color.setHex(0xfef3c7); // Warm amber
      fillLight.color.setHex(0xd97706);
      fillLight.groundColor.setHex(0x451a03);
      rimLight.color.setHex(0xfde68a);
      if (gridHelper) {
        (gridHelper.material as THREE.LineBasicMaterial).color.setHex(0xb45309);
      }
      if (spotlightA) spotlightA.intensity = 0.5;
      if (spotlightB) spotlightB.intensity = 0.5;
    } else if (stageTheme === 'grid') {
      keyLight.color.setHex(0xffffff); // Pure white technical
      fillLight.color.setHex(0x94a3b8);
      fillLight.groundColor.setHex(0x0f172a);
      rimLight.color.setHex(0xe2e8f0);
      if (gridHelper) {
        (gridHelper.material as THREE.LineBasicMaterial).color.setHex(0x38bdf8);
      }
      if (spotlightA) spotlightA.intensity = 1.0;
      if (spotlightB) spotlightB.intensity = 1.0;
    } else {
      // Studio
      keyLight.color.setHex(0xfff5e6);
      fillLight.color.setHex(0x93c5fd);
      fillLight.groundColor.setHex(0x1e293b);
      rimLight.color.setHex(0x38bdf8);
      if (gridHelper) {
        (gridHelper.material as THREE.LineBasicMaterial).color.setHex(0x3b82f6);
      }
      if (spotlightA) spotlightA.intensity = 1.5;
      if (spotlightB) spotlightB.intensity = 1.5;
    }
  }, [stageTheme]);

  // Camera presets
  const handleSetCameraAngle = (angle: 'front' | 'side' | 'top' | 'close' | 'free') => {
    setCameraAngle(angle);
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (angle === 'front') {
      cam.position.set(0, 1.25, 3.2);
      ctrl.target.set(0, 0.95, 0);
    } else if (angle === 'side') {
      cam.position.set(3.2, 1.25, 0);
      ctrl.target.set(0, 0.95, 0);
    } else if (angle === 'top') {
      cam.position.set(0, 3.6, 0.6);
      ctrl.target.set(0, 0.95, 0);
    } else if (angle === 'close') {
      cam.position.set(0, 1.42, 1.3);
      ctrl.target.set(0, 1.35, 0);
    }
    ctrl.update();
  };

  // Step frame forward or backward
  const handleStepFrame = (deltaFrames: number) => {
    if (!animationData || animationData.duration <= 0) return;
    const frameDuration = 1 / (animationData.fps || 30);
    const newTime = Math.max(
      0,
      Math.min(animationData.duration, currentTime + deltaFrames * frameDuration)
    );
    onTimeUpdate(newTime);
  };

  // Build Procedural Humanoid Rig
  const buildHumanoidRig = useCallback((scene: THREE.Scene) => {
    const root = new THREE.Group();
    root.name = 'HumanoidRoot';
    root.rotation.y = invertOrientationRef.current ? Math.PI : 0;

    const bones: Partial<Record<HumanoidBoneName, THREE.Group>> = {};
    const mannequinMaterials: THREE.MeshStandardMaterial[] = [];

    // PBR Mannequin Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.35,
      metalness: 0.15,
    });
    mannequinMaterials.push(bodyMat);

    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8,
    });

    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
    });

    const limbMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.35,
      metalness: 0.1,
    });
    mannequinMaterials.push(limbMat);

    function createBoneNode(name: HumanoidBoneName, posY: number = 0, posX: number = 0, posZ: number = 0): THREE.Group {
      const g = new THREE.Group();
      g.name = name;
      g.position.set(posX, posY, posZ);
      bones[name] = g;

      const jointMesh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), jointMat);
      jointMesh.userData.isJointSphere = true;
      g.add(jointMesh);

      return g;
    }

    function addMannequinMesh(parent: THREE.Group, mesh: THREE.Mesh) {
      mesh.userData.isMannequinMesh = true;
      parent.add(mesh);
    }

    // 1. Pelvis / Hips
    const hips = createBoneNode('hips', 0.98);
    root.add(hips);
    const hipsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.16), bodyMat);
    hipsMesh.position.set(0, 0, 0);
    addMannequinMesh(hips, hipsMesh);

    // 2. Spine
    const spine = createBoneNode('spine', 0.12);
    hips.add(spine);
    const spineMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12), bodyMat);
    spineMesh.position.set(0, 0.06, 0);
    addMannequinMesh(spine, spineMesh);

    // 3. Chest
    const chest = createBoneNode('chest', 0.14);
    spine.add(chest);
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.18), bodyMat);
    chestMesh.position.set(0, 0.07, 0);
    addMannequinMesh(chest, chestMesh);

    // 4. Upper Chest
    const upperChest = createBoneNode('upperChest', 0.12);
    chest.add(upperChest);

    // 5. Neck
    const neck = createBoneNode('neck', 0.08);
    upperChest.add(neck);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 12), jointMat);
    neckMesh.position.set(0, 0.04, 0);
    addMannequinMesh(neck, neckMesh);

    // 6. Head
    const head = createBoneNode('head', 0.12);
    neck.add(head);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), bodyMat);
    headMesh.scale.set(0.9, 1.1, 1.0);
    headMesh.position.set(0, 0.08, 0);
    addMannequinMesh(head, headMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.05), visorMat);
    visorMesh.position.set(0, 0.1, 0.09);
    addMannequinMesh(head, visorMesh);

    function addBoneCapsule(parent: THREE.Group, length: number, radius: number, axis: 'x' | 'y' = 'y', dir: number = 1) {
      const geo = new THREE.CapsuleGeometry(radius, length - radius * 2, 8, 12);
      const mesh = new THREE.Mesh(geo, limbMat);
      if (axis === 'y') {
        mesh.position.set(0, (dir * length) / 2, 0);
      } else {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set((dir * length) / 2, 0, 0);
      }
      addMannequinMesh(parent, mesh);
    }

    // 7. Left Arm (+X)
    const lShoulder = createBoneNode('leftShoulder', 0.04, 0.12, 0);
    upperChest.add(lShoulder);
    const lUpperArm = createBoneNode('leftUpperArm', 0, 0.12, 0);
    lShoulder.add(lUpperArm);
    addBoneCapsule(lUpperArm, 0.22, 0.038, 'x', 1);

    const lLowerArm = createBoneNode('leftLowerArm', 0, 0.22, 0);
    lUpperArm.add(lLowerArm);
    addBoneCapsule(lLowerArm, 0.2, 0.032, 'x', 1);

    const lHand = createBoneNode('leftHand', 0, 0.2, 0);
    lLowerArm.add(lHand);
    const handGeo = new THREE.BoxGeometry(0.06, 0.04, 0.08);
    const lHandMesh = new THREE.Mesh(handGeo, jointMat);
    lHandMesh.position.set(0.04, 0, 0);
    addMannequinMesh(lHand, lHandMesh);

    // 8. Right Arm (-X)
    const rShoulder = createBoneNode('rightShoulder', 0.04, -0.12, 0);
    upperChest.add(rShoulder);
    const rUpperArm = createBoneNode('rightUpperArm', 0, -0.12, 0);
    rShoulder.add(rUpperArm);
    addBoneCapsule(rUpperArm, 0.22, 0.038, 'x', -1);

    const rLowerArm = createBoneNode('rightLowerArm', 0, -0.22, 0);
    rUpperArm.add(rLowerArm);
    addBoneCapsule(rLowerArm, 0.2, 0.032, 'x', -1);

    const rHand = createBoneNode('rightHand', 0, -0.2, 0);
    rLowerArm.add(rHand);
    const rHandMesh = new THREE.Mesh(handGeo, jointMat);
    rHandMesh.position.set(-0.04, 0, 0);
    addMannequinMesh(rHand, rHandMesh);

    // 9. Left Leg
    const lUpperLeg = createBoneNode('leftUpperLeg', -0.06, 0.09, 0);
    hips.add(lUpperLeg);
    addBoneCapsule(lUpperLeg, 0.38, 0.05, 'y', -1);

    const lLowerLeg = createBoneNode('leftLowerLeg', -0.38, 0, 0);
    lUpperLeg.add(lLowerLeg);
    addBoneCapsule(lLowerLeg, 0.4, 0.042, 'y', -1);

    const lFoot = createBoneNode('leftFoot', -0.4, 0, 0.04);
    lLowerLeg.add(lFoot);
    const footGeo = new THREE.BoxGeometry(0.08, 0.05, 0.16);
    const lFootMesh = new THREE.Mesh(footGeo, jointMat);
    lFootMesh.position.set(0, -0.02, 0.06);
    addMannequinMesh(lFoot, lFootMesh);

    const lToes = createBoneNode('leftToes', 0, 0, 0.1);
    lFoot.add(lToes);

    // 10. Right Leg
    const rUpperLeg = createBoneNode('rightUpperLeg', -0.06, -0.09, 0);
    hips.add(rUpperLeg);
    addBoneCapsule(rUpperLeg, 0.38, 0.05, 'y', -1);

    const rLowerLeg = createBoneNode('rightLowerLeg', -0.38, 0, 0);
    rUpperLeg.add(rLowerLeg);
    addBoneCapsule(rLowerLeg, 0.4, 0.042, 'y', -1);

    const rFoot = createBoneNode('rightFoot', -0.4, 0, 0.04);
    rLowerLeg.add(rFoot);
    const rFootMesh = new THREE.Mesh(footGeo, jointMat);
    rFootMesh.position.set(0, -0.02, 0.06);
    addMannequinMesh(rFoot, rFootMesh);

    const rToes = createBoneNode('rightToes', 0, 0, 0.1);
    rFoot.add(rToes);

    // Skeleton Helper
    const skeletonHelper = new THREE.SkeletonHelper(root);
    (skeletonHelper.material as THREE.LineBasicMaterial).color.set(0x10b981);
    (skeletonHelper.material as THREE.LineBasicMaterial).linewidth = 2;
    skeletonHelper.visible = false;
    scene.add(skeletonHelper);

    return {
      group: root,
      bones,
      skeletonHelper,
      mannequinMaterials,
    };
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.Fog(0x090d16, 5, 20);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.set(0, 1.25, 3.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.95, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 0.8;
    controls.maxDistance = 8.0;
    controlsRef.current = controls;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio & Stage Lights Rig
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-2, 3, -2);
    scene.add(rimLight);

    // Stage Spotlights
    const spotlightA = new THREE.SpotLight(0x818cf8, 1.5, 10, Math.PI / 4, 0.3);
    spotlightA.position.set(1.5, 3.5, 1.5);
    scene.add(spotlightA);

    const spotlightB = new THREE.SpotLight(0x06b6d4, 1.5, 10, Math.PI / 4, 0.3);
    spotlightB.position.set(-1.5, 3.5, 1.5);
    scene.add(spotlightB);

    // Stage Ground Grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    lightsRef.current = {
      keyLight,
      fillLight,
      rimLight,
      spotlightA,
      spotlightB,
      gridHelper,
    };

    // Forward Direction Arrow (+Z)
    const dirArrowGroup = new THREE.Group();
    const arrowShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8),
      new THREE.MeshBasicMaterial({ color: 0x4f46e5 })
    );
    arrowShaft.rotation.x = Math.PI / 2;
    arrowShaft.position.set(0, 0.005, 0.85);

    const arrowHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.18, 12),
      new THREE.MeshBasicMaterial({ color: 0x6366f1 })
    );
    arrowHead.rotation.x = Math.PI / 2;
    arrowHead.position.set(0, 0.005, 1.2);

    dirArrowGroup.add(arrowShaft);
    dirArrowGroup.add(arrowHead);
    scene.add(dirArrowGroup);

    // Shadow catcher
    const shadowGeo = new THREE.PlaneGeometry(3, 3);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.001;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Humanoid Rig
    const rig = buildHumanoidRig(scene);
    scene.add(rig.group);
    boneHierarchyRef.current = rig;

    // Animation Loop
    const clock = new THREE.Clock();
    let animationFrameId = 0;

    function renderLoop() {
      const delta = clock.getDelta();

      if (animDataRef.current && animDataRef.current.duration > 0) {
        const anim = animDataRef.current;
        if (isPlayingRef.current) {
          animTimeRef.current = (animTimeRef.current + delta * playbackSpeedRef.current) % anim.duration;
          onTimeUpdateRef.current(animTimeRef.current);
        }

        const keyframes = anim.keyframes;
        if (keyframes.length > 0 && rig.bones) {
          const t = Math.max(0, Math.min(animTimeRef.current, anim.duration));
          let kfIndex = 0;
          for (let i = 0; i < keyframes.length - 1; i++) {
            if (t >= keyframes[i].time && t <= keyframes[i + 1].time) {
              kfIndex = i;
              break;
            }
          }

          const kf1 = keyframes[kfIndex];
          const kf2 = keyframes[Math.min(kfIndex + 1, keyframes.length - 1)];
          const dt = kf2.time - kf1.time;
          const alpha = dt > 0.0001 ? (t - kf1.time) / dt : 0;

          for (const [boneName, boneGroup] of Object.entries(rig.bones)) {
            const bKey = boneName as HumanoidBoneName;
            const r1 = kf1.rotations[bKey];
            const r2 = kf2.rotations[bKey];

            if (r1 && r2 && boneGroup) {
              const q1 = new THREE.Quaternion(r1[0], r1[1], r1[2], r1[3]);
              const q2 = new THREE.Quaternion(r2[0], r2[1], r2[2], r2[3]);
              q1.slerp(q2, alpha);
              boneGroup.quaternion.copy(q1);

              if (boneName === activeBoneInspect && onInspectBoneRef.current) {
                onInspectBoneRef.current(bKey, [q1.x, q1.y, q1.z, q1.w]);
              }
            }
          }

          if (kf1.rootTranslation && kf2.rootTranslation && rig.bones.hips) {
            const t1 = kf1.rootTranslation;
            const t2 = kf2.rootTranslation;
            rig.bones.hips.position.set(
              t1[0] + (t2[0] - t1[0]) * alpha,
              t1[1] + (t2[1] - t1[1]) * alpha,
              t1[2] + (t2[2] - t1[2]) * alpha
            );
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(renderLoop);
    }

    animationFrameId = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [buildHumanoidRig, activeBoneInspect]);

  // Update visibility of Mannequin vs Skeleton
  useEffect(() => {
    if (boneHierarchyRef.current) {
      const { group, skeletonHelper } = boneHierarchyRef.current;
      group.traverse((child) => {
        if (child.userData.isMannequinMesh) {
          child.visible = showMannequin;
        }
        if (child.userData.isJointSphere) {
          child.visible = showSkeleton || showMannequin;
        }
      });
      if (skeletonHelper) {
        skeletonHelper.visible = showSkeleton;
      }
    }
  }, [showMannequin, showSkeleton]);

  return (
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing flex-1" />

      {/* Floating HUD: Top Left - Active Animation Info & Stage Selector */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-10 max-w-sm">
        <div className="bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 flex items-center gap-2 pointer-events-auto shadow-lg">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Film className="w-4 h-4" />
          </div>
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate max-w-[170px]">
                {animationData ? animationData.name : 'Palco 3D VRM'}
              </span>
              <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                {animationData?.sourceFormat || 'vrma'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {animationData ? `${animationData.fps} FPS · ${animationData.duration.toFixed(2)}s` : 'Pronto'}
            </div>
          </div>
        </div>

        {/* Quick Dropdown: Switch directly to any preset or imported animation */}
        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2 pointer-events-auto shadow-md">
          <span className="text-[11px] text-slate-400 shrink-0">Trocar no Palco:</span>
          <select
            value={currentAnimId ? (SAMPLE_ANIMATIONS.some((p) => p.id === currentAnimId) ? `preset:${currentAnimId}` : currentAnimId) : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith('preset:')) {
                const presetId = val.replace('preset:', '');
                if (onSelectPreset) onSelectPreset(presetId);
              } else {
                const found = animationCandidates.find(
                  (a) => a.guid === val || a.filename === val || a.filename.replace(/\.[^/.]+$/, '') === val
                );
                if (found && onSelectImportedAsset) {
                  onSelectImportedAsset(found);
                }
              }
            }}
            className="bg-slate-950 text-indigo-300 text-xs px-2 py-1 rounded border border-slate-700/80 focus:outline-none focus:border-indigo-500 max-w-[210px] truncate"
          >
            <optgroup label="✨ Presets de Movimento">
              {SAMPLE_ANIMATIONS.map((preset) => (
                <option key={preset.id} value={`preset:${preset.id}`}>
                  {preset.name.split('/')[0].trim()}
                </option>
              ))}
            </optgroup>
            {animationCandidates.length > 0 && (
              <optgroup label="📦 Assets do Pacote Unity">
                {animationCandidates.map((asset) => (
                  <option key={asset.guid} value={asset.guid}>
                    {asset.filename} (.{asset.extension})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Floating HUD: Top Right - Stage Lighting, Camera, Skin & Display */}
      <div className="absolute top-4 right-4 flex flex-wrap items-center justify-end gap-2 z-10 max-w-md pointer-events-auto">
        {/* Camera Angles */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-md">
          <Camera className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
          {(['front', 'side', 'top', 'close'] as const).map((ang) => (
            <button
              key={ang}
              onClick={() => handleSetCameraAngle(ang)}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-all ${
                cameraAngle === ang
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Câmera: ${ang}`}
            >
              {ang === 'front' ? 'Frente' : ang === 'side' ? 'Perfil' : ang === 'top' ? 'Topo' : 'Close'}
            </button>
          ))}
        </div>

        {/* Stage Theme Selector */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-md">
          <Layers className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
          {(['studio', 'neon', 'dojo', 'grid'] as const).map((thm) => (
            <button
              key={thm}
              onClick={() => setStageTheme(thm)}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-all ${
                stageTheme === thm
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Cenário: ${thm}`}
            >
              {thm === 'studio' ? 'Estúdio' : thm === 'neon' ? 'Neon' : thm === 'dojo' ? 'Dojo' : 'Grid'}
            </button>
          ))}
        </div>

        {/* Avatar Skin Selector */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-md">
          <Palette className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
          {(['indigo', 'chrome', 'gold', 'white'] as const).map((skin) => (
            <button
              key={skin}
              onClick={() => setAvatarSkin(skin)}
              className={`px-1.5 py-1 text-[11px] font-medium rounded transition-all ${
                avatarSkin === skin
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Material do avatar: ${skin}`}
            >
              {skin === 'indigo' ? 'Azul' : skin === 'chrome' ? 'Cromo' : skin === 'gold' ? 'Ouro' : 'Branco'}
            </button>
          ))}
        </div>

        {/* 180 Flip Toggle */}
        <button
          onClick={() => setInvertOrientation(!invertOrientation)}
          title="Inverter orientação frontal (180°)"
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
            invertOrientation
              ? 'bg-amber-600/90 text-white border border-amber-400/30'
              : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
          }`}
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">180°</span>
        </button>

        {/* Model & Skeleton Toggles */}
        <button
          onClick={onToggleMannequin}
          title="Alternar Malha Humanoide"
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
            showMannequin
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Modelo</span>
        </button>

        <button
          onClick={onToggleSkeleton}
          title="Alternar Visualizador de Esqueleto/Ossos"
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
            showSkeleton
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <BoneIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Esqueleto</span>
        </button>
      </div>

      {/* Bottom Timeline & Frame Controls */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <div className="bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-800 shadow-2xl flex items-center justify-between gap-3 sm:gap-4">
          {/* Play, Step Frame & Rewind */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onTogglePlay}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg shadow-sm transition-all"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            {/* Frame-by-Frame step buttons */}
            <button
              onClick={() => handleStepFrame(-1)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
              title="Voltar 1 quadro (-1 frame)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleStepFrame(1)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
              title="Avançar 1 quadro (+1 frame)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onTimeUpdate(0)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
              title="Voltar ao início da animação"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Timeline Scrubber */}
          <div className="flex-1 flex items-center gap-2 sm:gap-3">
            <span className="text-xs font-mono text-slate-400 tabular-nums min-w-[36px]">
              {currentTime.toFixed(2)}s
            </span>
            <input
              type="range"
              min="0"
              max={animationData?.duration || 1}
              step="0.01"
              value={currentTime}
              onChange={(e) => onTimeUpdate(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-xs font-mono text-slate-400 tabular-nums min-w-[36px]">
              {(animationData?.duration || 1).toFixed(2)}s
            </span>
          </div>

          {/* Bone selector for live transform monitoring */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs text-slate-400">Inspecionar Osso:</span>
            <select
              value={activeBoneInspect}
              onChange={(e) => setActiveBoneInspect(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="hips">Hips (Quadril)</option>
              <option value="spine">Spine (Coluna)</option>
              <option value="chest">Chest (Peito)</option>
              <option value="head">Head (Cabeça)</option>
              <option value="leftUpperArm">Left Upper Arm</option>
              <option value="rightUpperArm">Right Upper Arm</option>
              <option value="leftLowerArm">Left Lower Arm</option>
              <option value="rightLowerArm">Right Lower Arm</option>
              <option value="leftUpperLeg">Left Upper Leg</option>
              <option value="rightUpperLeg">Right Upper Leg</option>
              <option value="leftLowerLeg">Left Lower Leg</option>
              <option value="rightLowerLeg">Right Lower Leg</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
