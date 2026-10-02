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

  // The hierarchy:
  // scene -> pivotGroup (always at target or 0,0,0) -> modelRoot (offset by -center in center mode)
  const pivotGroupRef = useRef<THREE.Group>(new THREE.Group());
  const modelRootRef = useRef<THREE.Group>(new THREE.Group());

  // Measurement state
  const measurePointsRef = useRef<THREE.Vector3[]>([]);
  const measureObjectsRef = useRef<THREE.Object3D[]>([]);
  const [activeMeasure, setActiveMeasure] = useState<MeasureResult | null>(null);
  const [measureScreenPos, setMeasureScreenPos] = useState<{ x: number; y: number } | null>(null);

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

    // Assembly hierarchy: scene -> pivotGroup -> modelRoot
    scene.add(pivotGroupRef.current);
    pivotGroupRef.current.add(modelRootRef.current);

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

    const box = new THREE.Box3();
    parts.forEach((p) => {
      if (p.visible) {
        box.expandByObject(p.mesh);
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

    // Adjust grid to be just below the bottom of the model
    if (gridHelperRef.current) {
      const bottomY = pivotMode === 'center' ? -size.y / 2 : box.min.y;
      gridHelperRef.current.position.y = bottomY - 0.5;
    }
  }, [parts, pivotMode]);

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
    fitCamera();
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
  const fitCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const size = boundsSizeRef.current;
    const maxDim = Math.max(size.x, size.y, size.z, 20);
    const dist = maxDim * 1.8;

    // Since pivotGroup is centered, target is (0, 0, 0)
    controlsRef.current.target.set(0, 0, 0);
    cameraRef.current.position.set(dist, dist * 0.7, dist);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.update();

    setHasCustomPivot(false);
    if (onCustomPivotChanged) onCustomPivotChanged(false);
    if (pivotMarkerRef.current) pivotMarkerRef.current.visible = false;
  }, [onCustomPivotChanged]);

  const setCameraView = useCallback(
    (view: CameraView) => {
      if (!cameraRef.current || !controlsRef.current) return;
      const size = boundsSizeRef.current;
      const maxDim = Math.max(size.x, size.y, size.z, 20);
      const dist = maxDim * 2.2;
      const t = controlsRef.current.target.clone();

      if (view === 'front') cameraRef.current.position.set(t.x, t.y, t.z + dist);
      else if (view === 'back') cameraRef.current.position.set(t.x, t.y, t.z - dist);
      else if (view === 'top') cameraRef.current.position.set(t.x, t.y + dist, t.z + 0.001);
      else if (view === 'bottom') cameraRef.current.position.set(t.x, t.y - dist, t.z + 0.001);
      else if (view === 'right') cameraRef.current.position.set(t.x + dist, t.y, t.z);
      else if (view === 'left') cameraRef.current.position.set(t.x - dist, t.y, t.z);
      else if (view === 'iso') cameraRef.current.position.set(t.x + dist * 0.7, t.y + dist * 0.7, t.z + dist * 0.7);

      cameraRef.current.lookAt(t);
      controlsRef.current.update();
    },
    []
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

      // Show pivot visual marker at clicked point
      if (pivotMarkerRef.current) {
        pivotMarkerRef.current.position.copy(hitPoint);
        pivotMarkerRef.current.quaternion.copy(cameraRef.current.quaternion);
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
      points.push(pt);

      // Create pin dot
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false })
      );
      pin.position.copy(pt);
      pin.renderOrder = 1000;
      sceneRef.current.add(pin);
      measureObjectsRef.current.push(pin);

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
      } else if (points.length > 2) {
        clearMeasure();
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
      measureObjectsRef.current.forEach((obj) => sceneRef.current?.remove(obj));
    }
    measureObjectsRef.current = [];
    setActiveMeasure(null);
    setMeasureScreenPos(null);
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
