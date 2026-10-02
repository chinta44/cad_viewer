import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CADPart,
  ViewMode,
  MaterialPreset,
  ClipAxis,
  CameraView,
  PivotMode,
  MeasureResult
} from '../types/cad';
import { formatMm } from '../utils/cadMath';
import { Box, Ruler, CheckCircle2, Crosshair, Sparkles } from 'lucide-react';

interface CADViewerProps {
  parts: CADPart[];
  viewMode: ViewMode;
  materialPreset: MaterialPreset;
  clipAxis: ClipAxis;
  clipPosition: number;
  clipInverted: boolean;
  explodeFactor: number;
  isMeasuring: boolean;
  onMeasureComplete: (res: MeasureResult) => void;
  onClearMeasureRef?: (clearFn: () => void) => void;
  autoRotate: boolean;
  pivotMode: PivotMode;
  backgroundColor: string;
  showGrid: boolean;
  showDimensionsBox?: boolean;
  onToggleDimensionsBox?: () => void;
  onCameraUpdate?: (camera: THREE.Camera) => void;
  onSetCameraViewRef?: (setViewFn: (view: CameraView) => void) => void;
  onResetCameraRef?: (resetFn: () => void) => void;
  onResetPivotRef?: (resetPivotFn: () => void) => void;
  onScreenshotRef?: (screenshotFn: () => void) => void;
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
  onCustomPivotChanged?: (hasCustom: boolean) => void;
}

export const CADViewer: React.FC<CADViewerProps> = ({
  parts,
  viewMode,
  materialPreset,
  clipAxis,
  clipPosition,
  clipInverted,
  explodeFactor,
  isMeasuring,
  onMeasureComplete,
  onClearMeasureRef,
  autoRotate,
  pivotMode,
  backgroundColor,
  showGrid,
  showDimensionsBox = true,
  onToggleDimensionsBox,
  onCameraUpdate,
  onSetCameraViewRef,
  onResetCameraRef,
  onResetPivotRef,
  onScreenshotRef,
  selectedPartId,
  onSelectPart,
  onCustomPivotChanged,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Assembly hierarchy:
  // scene -> pivotGroup (always at target or 0,0,0) -> modelRoot (offset by -center in center mode)
  const pivotGroupRef = useRef<THREE.Group>(new THREE.Group());
  const modelRootRef = useRef<THREE.Group>(new THREE.Group());
  const dimBoxGroupRef = useRef<THREE.Group>(new THREE.Group());

  // Measurement state
  const measurePointsRef = useRef<THREE.Vector3[]>([]);
  const measureObjectsRef = useRef<THREE.Object3D[]>([]);
  const [activeMeasure, setActiveMeasure] = useState<MeasureResult | null>(null);
  const [measureScreenPos, setMeasureScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [measureStep, setMeasureStep] = useState<number>(0); // 0: none, 1: 1st point picked, 2: complete

  // Pivot marker object (visual feedback when double clicking)
  const pivotMarkerRef = useRef<THREE.Object3D | null>(null);
  const [hasCustomPivot, setHasCustomPivot] = useState(false);

  // Bounding box of all parts
  const boundsCenterRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const boundsSizeRef = useRef<THREE.Vector3>(new THREE.Vector3(100, 100, 100));

  // Clipping plane
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10000));

  // Raycaster for clicks
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Camera animation interpolation state
  const cameraAnimRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
    duration: number; // in frames
  } | null>(null);

  // -------------------------------------------------------------
  // INITIALIZE THREE.JS ENGINE
  // -------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100000
    );
    camera.position.set(200, 200, 200);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 50000;
    controlsRef.current = controls;

    // Lights (Studio 3-Point setup + subtle ambient)
    const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(1.5, 2.5, 2);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa5c4e8, 0.6);
    dirLight2.position.set(-2, -1, 1.5);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xffeedd, 0.4);
    dirLight3.position.set(0, -2, -1.5);
    scene.add(dirLight3);

    // Grid Helper
    const grid = new THREE.GridHelper(1000, 50, 0x38bdf8, 0x1e293b);
    grid.position.y = -0.1;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Assembly hierarchy: scene -> pivotGroup -> modelRoot + dimBoxGroup
    scene.add(pivotGroupRef.current);
    pivotGroupRef.current.add(modelRootRef.current);
    pivotGroupRef.current.add(dimBoxGroupRef.current);

    // Pivot visual marker
    const markerGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(2, 2.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.renderOrder = 999;
    markerGroup.add(ringMesh);

    const centerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false })
    );
    centerDot.renderOrder = 999;
    markerGroup.add(centerDot);
    markerGroup.visible = false;
    scene.add(markerGroup);
    pivotMarkerRef.current = markerGroup;

    // Notify parent for gizmo
    if (onCameraUpdate) onCameraUpdate(camera);

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Handle smooth camera interpolation
      if (cameraAnimRef.current && cameraAnimRef.current.active) {
        const anim = cameraAnimRef.current;
        anim.progress += 1 / anim.duration;

        // Smooth cubic ease out
        const t = Math.min(anim.progress, 1);
        const ease = 1 - Math.pow(1 - t, 3);

        camera.position.lerpVectors(anim.startPos, anim.endPos, ease);
        controls.target.lerpVectors(anim.startTarget, anim.endTarget, ease);

        if (t >= 1) {
          anim.active = false;
        }
      }

      controls.update();

      // Auto rotation: Rotates pivotGroup around its exact origin (which is the model center!)
      if (autoRotate) {
        pivotGroupRef.current.rotation.y += 0.005;
      }

      // Update measure label screen position
      if (activeMeasure && camera) {
        const midPoint = activeMeasure.p1.clone().lerp(activeMeasure.p2, 0.5);
        // Project to 2D
        const projected = midPoint.clone().project(camera);
        const halfWidth = container.clientWidth / 2;
        const halfHeight = container.clientHeight / 2;
        setMeasureScreenPos({
          x: projected.x * halfWidth + halfWidth,
          y: -projected.y * halfHeight + halfHeight,
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update background color
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(backgroundColor);
    }
  }, [backgroundColor]);

  // Update grid visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // -------------------------------------------------------------
  // RE-CENTERING AND PIVOT NORMALIZATION (Fixes Axis Center Issue)
  // -------------------------------------------------------------
  const computeAndApplyBounds = useCallback(() => {
    if (parts.length === 0) return;

    // Ensure world matrices are fully computed
    modelRootRef.current.updateMatrixWorld(true);

    const box = new THREE.Box3();
    parts.forEach((p) => {
      if (p.visible && p.mesh) {
        // Compute precise bounding box from geometry
        p.mesh.geometry.computeBoundingBox();
        const partBox = p.mesh.geometry.boundingBox;
        if (partBox) {
          const cloneBox = partBox.clone().applyMatrix4(p.mesh.matrix);
          box.union(cloneBox);
        } else {
          box.expandByObject(p.mesh);
        }
      }
    });

    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    boundsCenterRef.current.copy(center);
    boundsSizeRef.current.copy(size);

    if (pivotMode === 'center') {
      // Offset modelRoot by -center so that pivotGroup's local (0,0,0) is EXACTLY the geometric center
      modelRootRef.current.position.set(-center.x, -center.y, -center.z);
    } else {
      // In CAD origin mode, keep raw coordinates
      modelRootRef.current.position.set(0, 0, 0);
    }

    // Adaptive grid sizing: dynamically size grid according to model dimensions
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    if (sceneRef.current && gridHelperRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      gridHelperRef.current.geometry.dispose();

      // Determine clean power-of-10 grid size
      const gridSize = Math.max(maxDim * 3, 10);
      const divisions = 40;
      const newGrid = new THREE.GridHelper(gridSize, divisions, 0x38bdf8, 0x1e293b);
      const bottomY = pivotMode === 'center' ? -size.y / 2 : box.min.y;
      newGrid.position.y = bottomY - Math.max(maxDim * 0.005, 0.001);
      newGrid.visible = showGrid;
      sceneRef.current.add(newGrid);
      gridHelperRef.current = newGrid;
    }

    // Rebuild 3D Dimension Guide Box
    const dimGroup = dimBoxGroupRef.current;
    while (dimGroup.children.length > 0) {
      const child = dimGroup.children[0] as any;
      dimGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    if (size.x > 0 && size.y > 0 && size.z > 0) {
      // Outer bounding box wireframe
      const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const wireGeo = new THREE.WireframeGeometry(boxGeo);
      const wireMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25,
      });
      const boxWire = new THREE.LineSegments(wireGeo, wireMat);
      dimGroup.add(boxWire);

      // Coordinate edge lines (X: Red, Y: Green, Z: Blue)
      const halfX = size.x / 2;
      const halfY = size.y / 2;
      const halfZ = size.z / 2;

      // X dimension line at front bottom
      const xLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfX, -halfY, halfZ),
        new THREE.Vector3(halfX, -halfY, halfZ),
      ]);
      const xLine = new THREE.Line(
        xLineGeo,
        new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2.5 })
      );
      dimGroup.add(xLine);

      // Y dimension line at front left
      const yLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfX, -halfY, halfZ),
        new THREE.Vector3(-halfX, halfY, halfZ),
      ]);
      const yLine = new THREE.Line(
        yLineGeo,
        new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2.5 })
      );
      dimGroup.add(yLine);

      // Z dimension line at bottom left
      const zLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfX, -halfY, -halfZ),
        new THREE.Vector3(-halfX, -halfY, halfZ),
      ]);
      const zLine = new THREE.Line(
        zLineGeo,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2.5 })
      );
      dimGroup.add(zLine);
    }

    dimGroup.visible = showDimensionsBox;
  }, [parts, pivotMode, showGrid, showDimensionsBox]);

  // Sync dimension box visibility
  useEffect(() => {
    if (dimBoxGroupRef.current) {
      dimBoxGroupRef.current.visible = showDimensionsBox;
    }
  }, [showDimensionsBox]);

  // When parts change, populate modelRoot
  useEffect(() => {
    const root = modelRootRef.current;
    // Clear previous children
    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }

    parts.forEach((p) => {
      root.add(p.mesh);
      root.add(p.wireMesh);
    });

    computeAndApplyBounds();
    fitCamera(false);
  }, [parts, computeAndApplyBounds]);

  // Update pivot mode (center vs origin)
  useEffect(() => {
    computeAndApplyBounds();
    resetPivot();
  }, [pivotMode, computeAndApplyBounds]);

  // -------------------------------------------------------------
  // MATERIAL AND VIEW MODE APPLICATION
  // -------------------------------------------------------------
  useEffect(() => {
    const planes = clipAxis === 'off' ? [] : [clipPlaneRef.current];

    parts.forEach((p) => {
      const isSelected = selectedPartId === p.id;
      const baseColor = p.color;

      // Solid Material creation
      let mat: THREE.Material;
      if (p.isCompare) {
        mat = new THREE.MeshPhongMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
          clippingPlanes: planes,
        });
      } else if (materialPreset === 'clay') {
        mat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.9,
          metalness: 0.05,
          side: THREE.DoubleSide,
          clippingPlanes: planes,
        });
      } else if (materialPreset === 'metal') {
        mat = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.15,
          metalness: 0.9,
          side: THREE.DoubleSide,
          clippingPlanes: planes,
        });
      } else if (materialPreset === 'glass') {
        mat = new THREE.MeshPhongMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0.38,
          shininess: 120,
          side: THREE.DoubleSide,
          clippingPlanes: planes,
        });
      } else if (materialPreset === 'normalColors') {
        mat = new THREE.MeshNormalMaterial({
          side: THREE.DoubleSide,
          clippingPlanes: planes,
        });
      } else {
        // Default CAD PBR
        mat = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.45,
          metalness: 0.05,
          clearcoat: 0.25,
          side: THREE.DoubleSide,
          clippingPlanes: planes,
        });
      }

      // If Ghost mode
      if (viewMode === 'ghost') {
        mat.transparent = true;
        mat.opacity = 0.25;
        mat.depthWrite = false;
      }

      // If Selected Part
      if (isSelected) {
        (mat as any).emissive = new THREE.Color(0x38bdf8);
        (mat as any).emissiveIntensity = 0.25;
      }

      p.mesh.material = mat;

      // Visibility based on ViewMode
      if (!p.visible) {
        p.mesh.visible = false;
        p.wireMesh.visible = false;
      } else {
        p.mesh.visible = viewMode !== 'wire';
        p.wireMesh.visible = viewMode === 'wire' || viewMode === 'both';
      }
    });
  }, [parts, viewMode, materialPreset, clipAxis, selectedPartId]);

  // -------------------------------------------------------------
  // SECTION CLIPPING
  // -------------------------------------------------------------
  useEffect(() => {
    if (clipAxis === 'off') {
      parts.forEach((p) => {
        if (p.mesh.material) (p.mesh.material as any).clippingPlanes = [];
      });
      return;
    }

    const sz = boundsSizeRef.current;
    const inv = clipInverted ? -1 : 1;

    let normal = new THREE.Vector3(-1, 0, 0);
    let span = sz.x;
    if (clipAxis === 'y') {
      normal = new THREE.Vector3(0, -1, 0);
      span = sz.y;
    } else if (clipAxis === 'z') {
      normal = new THREE.Vector3(0, 0, -1);
      span = sz.z;
    }

    if (clipInverted) normal.negate();

    // Constant offset along normal
    const constant = clipPosition * (span / 2) * inv;
    clipPlaneRef.current.normal.copy(normal);
    clipPlaneRef.current.constant = constant;

    // Apply to materials
    parts.forEach((p) => {
      if (p.mesh.material) {
        (p.mesh.material as any).clippingPlanes = [clipPlaneRef.current];
      }
    });
  }, [clipAxis, clipPosition, clipInverted, parts]);

  // -------------------------------------------------------------
  // EXPLODE VIEW
  // -------------------------------------------------------------
  useEffect(() => {
    parts.forEach((p) => {
      const orig = p.originalPosition;
      // Normal vector from center
      let dir = orig.clone().normalize();
      if (dir.length() < 0.001) dir.set(0, 1, 0);

      const offsetDist = explodeFactor * (boundsSizeRef.current.length() * 0.4);
      const newPos = orig.clone().addScaledVector(dir, offsetDist);

      p.mesh.position.copy(newPos);
      p.wireMesh.position.copy(newPos);
    });
  }, [explodeFactor, parts]);

  // -------------------------------------------------------------
  // CAMERA VIEW & CENTERING METHODS
  // -------------------------------------------------------------
  /**
   * Calculates the exact geometric distance required to fit the model
   * perfectly in the viewport based on camera FOV and aspect ratio.
   */
  const calculateFitDistance = useCallback((): number => {
    if (!cameraRef.current) return 100;
    const camera = cameraRef.current;
    const size = boundsSizeRef.current;

    // Bounding sphere radius of the model (half diagonal)
    const radius = Math.max(size.length() / 2, 0.0001);

    // Half FOVs in radians
    const vFov = (camera.fov * Math.PI) / 360;
    const hFov = Math.atan(Math.tan(vFov) * camera.aspect);

    // Precise distances to fit vertically and horizontally
    const distV = radius / Math.sin(vFov);
    const distH = radius / Math.sin(hFov);

    // 1.2x breathing room so it occupies ~80% of screen height/width
    const optimalDist = Math.max(distV, distH) * 1.2;

    // Calibrate camera near/far and controls zoom limits to model scale
    camera.near = Math.max(radius / 1000, 0.0001);
    camera.far = Math.max(radius * 100, 2000);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.minDistance = Math.max(radius / 200, 0.0001);
      controlsRef.current.maxDistance = Math.max(radius * 30, 1000);
    }

    return optimalDist;
  }, []);

  const fitCamera = useCallback(
    (animate = true) => {
      if (!cameraRef.current || !controlsRef.current) return;
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      const optimalDist = calculateFitDistance();

      // Standard isometric orientation vector
      const dir = new THREE.Vector3(1, 0.8, 1).normalize();
      const targetPos = dir.multiplyScalar(optimalDist);
      const targetLookAt = new THREE.Vector3(0, 0, 0);

      if (animate) {
        cameraAnimRef.current = {
          active: true,
          startPos: camera.position.clone(),
          endPos: targetPos,
          startTarget: controls.target.clone(),
          endTarget: targetLookAt,
          progress: 0,
          duration: 20, // 20 frames (~330ms)
        };
      } else {
        controls.target.copy(targetLookAt);
        camera.position.copy(targetPos);
        camera.lookAt(targetLookAt);
        controls.update();
      }

      setHasCustomPivot(false);
      if (onCustomPivotChanged) onCustomPivotChanged(false);
      if (pivotMarkerRef.current) pivotMarkerRef.current.visible = false;
    },
    [calculateFitDistance, onCustomPivotChanged]
  );

  const setCameraView = useCallback(
    (view: CameraView) => {
      if (!cameraRef.current || !controlsRef.current) return;
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      const optimalDist = calculateFitDistance();
      const targetCenter = controls.target.clone();

      let targetPos = new THREE.Vector3();
      if (view === 'front') {
        targetPos.set(targetCenter.x, targetCenter.y, targetCenter.z + optimalDist);
      } else if (view === 'back') {
        targetPos.set(targetCenter.x, targetCenter.y, targetCenter.z - optimalDist);
      } else if (view === 'top') {
        targetPos.set(targetCenter.x, targetCenter.y + optimalDist, targetCenter.z + 0.0001);
      } else if (view === 'bottom') {
        targetPos.set(targetCenter.x, targetCenter.y - optimalDist, targetCenter.z + 0.0001);
      } else if (view === 'right') {
        targetPos.set(targetCenter.x + optimalDist, targetCenter.y, targetCenter.z);
      } else if (view === 'left') {
        targetPos.set(targetCenter.x - optimalDist, targetCenter.y, targetCenter.z);
      } else if (view === 'iso') {
        const dir = new THREE.Vector3(1, 0.8, 1).normalize();
        targetPos.copy(targetCenter).add(dir.multiplyScalar(optimalDist));
      }

      cameraAnimRef.current = {
        active: true,
        startPos: camera.position.clone(),
        endPos: targetPos,
        startTarget: targetCenter.clone(),
        endTarget: targetCenter,
        progress: 0,
        duration: 20,
      };
    },
    [calculateFitDistance]
  );

  const resetPivot = useCallback(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    setHasCustomPivot(false);
    if (onCustomPivotChanged) onCustomPivotChanged(false);
    if (pivotMarkerRef.current) pivotMarkerRef.current.visible = false;
  }, [onCustomPivotChanged]);

  const captureScreenshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `cad_model_${Date.now()}.png`;
    a.href = dataUrl;
    a.click();
  }, []);

  // Expose callbacks to parent
  useEffect(() => {
    if (onSetCameraViewRef) onSetCameraViewRef(setCameraView);
    if (onResetCameraRef) onResetCameraRef(fitCamera);
    if (onResetPivotRef) onResetPivotRef(resetPivot);
    if (onScreenshotRef) onScreenshotRef(captureScreenshot);
  }, [onSetCameraViewRef, onResetCameraRef, onResetPivotRef, onScreenshotRef, setCameraView, fitCamera, resetPivot, captureScreenshot]);

  // -------------------------------------------------------------
  // INTERACTIVE CLICKS: DOUBLE-CLICK TO SET PIVOT & MEASUREMENT
  // -------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // record down pos
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const mouseDownPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Double click: Set rotation pivot to the exact point on the surface!
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !cameraRef.current || !sceneRef.current || !controlsRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const visibleMeshes = parts.filter((p) => p.visible).map((p) => p.mesh);
    const hits = raycasterRef.current.intersectObjects(visibleMeshes, true);

    if (hits.length > 0) {
      const hitPoint = hits[0].point;

      // Update controls target to hit point
      controlsRef.current.target.copy(hitPoint);
      controlsRef.current.update();

      // Show pivot visual marker at clicked point scaled proportionally
      if (pivotMarkerRef.current) {
        const modelSpan = Math.max(boundsSizeRef.current.length(), 0.01);
        const markerScale = Math.max(modelSpan * 0.015, 0.0002);
        pivotMarkerRef.current.position.copy(hitPoint);
        pivotMarkerRef.current.quaternion.copy(cameraRef.current.quaternion);
        pivotMarkerRef.current.scale.setScalar(markerScale);
        pivotMarkerRef.current.visible = true;
      }

      setHasCustomPivot(true);
      if (onCustomPivotChanged) onCustomPivotChanged(true);
    }
  };

  // Single click: Measure or part selection
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    if (Math.hypot(dx, dy) > 5) return; // Dragged, ignore

    const container = containerRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const visibleMeshes = parts.filter((p) => p.visible).map((p) => p.mesh);
    const hits = raycasterRef.current.intersectObjects(visibleMeshes, true);

    if (isMeasuring && hits.length > 0) {
      const pt = hits[0].point.clone();
      const points = measurePointsRef.current;

      // If already has 2 points, start fresh measurement on next click
      if (points.length >= 2) {
        clearMeasure();
      }

      points.push(pt);
      setMeasureStep(points.length);

      // Scale pin proportionally to model dimensions (0.75% of model diagonal)
      const modelSpan = Math.max(boundsSizeRef.current.length(), 0.01);
      const pinRadius = Math.max(modelSpan * 0.0075, 0.0001);

      // Create pin dot
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(pinRadius, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false })
      );
      pin.position.copy(pt);
      pin.renderOrder = 1000;
      sceneRef.current.add(pin);
      measureObjectsRef.current.push(pin);

      // Create subtle halo ring for point 1
      if (points.length === 1) {
        const haloGeo = new THREE.RingGeometry(pinRadius * 1.6, pinRadius * 2.4, 32);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          side: THREE.DoubleSide,
          depthTest: false,
          transparent: true,
          opacity: 0.7,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.copy(pt);
        if (cameraRef.current) halo.quaternion.copy(cameraRef.current.quaternion);
        halo.renderOrder = 1000;
        sceneRef.current.add(halo);
        measureObjectsRef.current.push(halo);
      }

      if (points.length === 2) {
        // Draw measurement line
        const p1 = points[0];
        const p2 = points[1];
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(
          lineGeo,
          new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2, depthTest: false })
        );
        line.renderOrder = 1000;
        sceneRef.current.add(line);
        measureObjectsRef.current.push(line);

        const distance = p1.distanceTo(p2);
        const res: MeasureResult = {
          p1,
          p2,
          distance,
          dx: Math.abs(p1.x - p2.x),
          dy: Math.abs(p1.y - p2.y),
          dz: Math.abs(p1.z - p2.z),
        };
        setActiveMeasure(res);
        onMeasureComplete(res);
      }
    } else if (!isMeasuring && hits.length > 0) {
      // Find which part was clicked
      const clickedMesh = hits[0].object as THREE.Mesh;
      const clickedPart = parts.find((p) => p.mesh === clickedMesh);
      if (clickedPart) {
        onSelectPart(clickedPart.id);
      }
    } else if (hits.length === 0) {
      onSelectPart(null);
    }
  };

  const clearMeasure = useCallback(() => {
    measurePointsRef.current = [];
    if (sceneRef.current) {
      measureObjectsRef.current.forEach((obj) => {
        sceneRef.current?.remove(obj);
        if ((obj as any).geometry) (obj as any).geometry.dispose();
      });
    }
    measureObjectsRef.current = [];
    setActiveMeasure(null);
    setMeasureScreenPos(null);
    setMeasureStep(0);
  }, []);

  useEffect(() => {
    if (onClearMeasureRef) onClearMeasureRef(clearMeasure);
  }, [onClearMeasureRef, clearMeasure]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
    >
      {/* Floating XYZ Model Dimensions HUD (Top-Left) */}
      {boundsSizeRef.current && parts.length > 0 && boundsSizeRef.current.length() > 0 && (
        <div className="absolute top-16 left-4 z-20 pointer-events-auto flex items-center gap-2 select-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Box className="w-3.5 h-3.5 text-sky-400" />
              <span>外形サイズ</span>
            </div>
            <div className="h-3.5 w-px bg-slate-700/80" />
            <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
              <span className="text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span className="text-rose-400 font-bold">X:</span> {formatMm(boundsSizeRef.current.x)} mm
              </span>
              <span className="text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-emerald-400 font-bold">Y:</span> {formatMm(boundsSizeRef.current.y)} mm
              </span>
              <span className="text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                <span className="text-sky-400 font-bold">Z:</span> {formatMm(boundsSizeRef.current.z)} mm
              </span>
            </div>
            {onToggleDimensionsBox && (
              <>
                <div className="h-3.5 w-px bg-slate-700/80" />
                <button
                  onClick={onToggleDimensionsBox}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                    showDimensionsBox
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="3D空間上に直方体寸法フレームを表示/非表示"
                >
                  3D枠 {showDimensionsBox ? 'ON' : 'OFF'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Measurement Guidance Banner (Top-Center) */}
      {isMeasuring && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-rose-500/60 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-3 text-xs text-slate-200">
            <Ruler className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex items-center gap-2">
              {measureStep === 0 && (
                <span>
                  モデル表面の<strong className="text-rose-400 font-bold underline decoration-rose-400 underline-offset-2">【1点目】</strong>をクリックしてください
                </span>
              )}
              {measureStep === 1 && (
                <span className="text-amber-300 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  1点目選択中 — 距離を測る<strong className="text-white font-bold underline underline-offset-2">【2点目】</strong>をクリック
                </span>
              )}
              {measureStep === 2 && activeMeasure && (
                <span className="text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  計測完了: <strong className="font-mono text-white text-sm">{activeMeasure.distance.toFixed(2)} mm</strong>
                </span>
              )}
            </div>
            {measureStep > 0 && (
              <button
                onClick={clearMeasure}
                className="px-2 py-0.5 text-[10px] bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded border border-rose-800 transition-colors cursor-pointer"
              >
                やり直す
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3D Measurement Tooltip Overlay */}
      {activeMeasure && measureScreenPos && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full mb-3 pointer-events-none z-20 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: measureScreenPos.x, top: measureScreenPos.y }}
        >
          <div className="bg-slate-900/90 backdrop-blur-md border border-red-500/70 text-slate-100 px-3 py-1.5 rounded-xl shadow-2xl text-xs font-mono">
            <div className="text-sm font-bold text-red-400">
              {activeMeasure.distance.toFixed(2)} mm
            </div>
            <div className="text-[10px] text-slate-400 flex gap-2 mt-0.5">
              <span>dX: {activeMeasure.dx.toFixed(1)}</span>
              <span>dY: {activeMeasure.dy.toFixed(1)}</span>
              <span>dZ: {activeMeasure.dz.toFixed(1)}</span>
            </div>
          </div>
          <div className="w-2 h-2 bg-red-500 rotate-45 mx-auto -mt-1 shadow-sm" />
        </div>
      )}

      {/* Viewport Interaction Hint */}
      <div className="absolute bottom-2 left-4 text-[11px] text-slate-500/80 font-mono pointer-events-none select-none drop-shadow">
        ドラッグ: 回転 · ホイール: ズーム · 右ドラッグ: パン · ダブルクリック: 回転中心設定
      </div>
    </div>
  );
};
