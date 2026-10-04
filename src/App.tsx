import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  CADPart,
  ViewMode,
  MaterialPreset,
  ClipAxis,
  CameraView,
  PivotMode,
  ModelMetadata,
  MeasureResult
} from './types/cad';
import { computeGeometryVolume, formatMm } from './utils/cadMath';
import { parseCADFile, generateSampleModel, RawPartData } from './utils/cadLoaders';
import { CADViewer } from './components/CADViewer';
import { TopBar } from './components/TopBar';
import { FloatingToolbar } from './components/FloatingToolbar';
import { InspectorPanel } from './components/InspectorPanel';
import { OrientationGizmo } from './components/OrientationGizmo';
import { SampleModelModal } from './components/SampleModelModal';
import { VideoExportModal } from './components/VideoExportModal';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  // Model state
  const [parts, setParts] = useState<CADPart[]>([]);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  // Undo stack
  const [lastDeletedPart, setLastDeletedPart] = useState<CADPart | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('solid');
  const [materialPreset, setMaterialPreset] = useState<MaterialPreset>('normal');
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState<number>(1.0);
  const [pivotMode, setPivotMode] = useState<PivotMode>('center');
  const [hasCustomPivot, setHasCustomPivot] = useState(false);

  // 360 Video Export state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedFileSize, setRecordedFileSize] = useState<number | null>(null);
  const [recordedFileName, setRecordedFileName] = useState<string>('cad_model_360.mp4');

  // Section clipping
  const [clipAxis, setClipAxis] = useState<ClipAxis>('off');
  const [clipPosition, setClipPosition] = useState<number>(0);
  const [clipInverted, setClipInverted] = useState<boolean>(false);

  // Explode view
  const [explodeFactor, setExplodeFactor] = useState<number>(0);

  // Measurement
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [hasMeasurePoints, setHasMeasurePoints] = useState<boolean>(false);

  // Environment & Settings
  const [backgroundColor, setBackgroundColor] = useState<string>('#090d16');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showDimensionsBox, setShowDimensionsBox] = useState<boolean>(true);
  const [selectedDensityId, setSelectedDensityId] = useState<string>('pla');
  const [customDensity, setCustomDensity] = useState<number>(1.24);
  const [pricePerKg, setPricePerKg] = useState<number>(3000);

  // UI state
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [sampleModalOpen, setSampleModalOpen] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // File Inputs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const compareInputRef = useRef<HTMLInputElement | null>(null);

  // Camera & Viewer Refs
  const cameraRef = useRef<THREE.Camera | null>(null);
  const setCameraViewRef = useRef<((view: CameraView) => void) | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const resetPivotRef = useRef<(() => void) | null>(null);
  const screenshotRef = useRef<(() => void) | null>(null);
  const clearMeasureRef = useRef<(() => void) | null>(null);
  const recordTurntableRef = useRef<
    | ((
        durationSec: number,
        onProgress: (pct: number) => void
      ) => Promise<{ blob: Blob; url: string; mimeType: string; isMp4: boolean }>)
    | null
  >(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);

  // Notification helper
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // 360 Turntable Recording Trigger
  const handleStartRecording = useCallback(
    async (durationSec: number) => {
      if (!recordTurntableRef.current) return;
      setIsRecording(true);
      setRecordingProgress(0);
      try {
        const res = await recordTurntableRef.current(durationSec, (pct) => {
          setRecordingProgress(pct);
        });
        setRecordedVideoUrl(res.url);
        setRecordedFileSize(res.blob.size);
        const ext = res.isMp4 ? 'mp4' : 'webm';
        const safeName = (metadata?.fileName || 'cad_model')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_\-\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '_');
        const filename = `${safeName}_360_${Date.now()}.${ext}`;
        setRecordedFileName(filename);
        showToast(
          `360°回転動画の生成が完了しました！ [${(res.blob.size / 1024 / 1024).toFixed(2)} MB]`
        );
      } catch (err: any) {
        console.error(err);
        showToast(err.message || '録画中にエラーが発生しました', 'error');
      } finally {
        setIsRecording(false);
      }
    },
    [metadata, showToast]
  );

  const handleStopRecording = useCallback(() => {
    if (stopRecordingRef.current) {
      stopRecordingRef.current();
    }
  }, []);

  // -------------------------------------------------------------
  // BUILD CAD PARTS FROM RAW DATA
  // -------------------------------------------------------------
  const buildPartsFromRaw = useCallback(
    (rawList: RawPartData[], isCompare = false) => {
      return rawList.map((raw, index) => {
        const id = isCompare ? `compare_${index}_${Date.now()}` : `part_${index}_${Date.now()}`;
        const color = raw.color || new THREE.Color().setHSL(((index * 137.5) % 360) / 360, 0.65, 0.55);

        // Make wireframe
        const wireGeo = new THREE.WireframeGeometry(raw.geometry);
        const wireMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.15,
        });
        const wireMesh = new THREE.LineSegments(wireGeo, wireMat);

        // Solid Mesh
        const mesh = new THREE.Mesh(
          raw.geometry,
          new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        raw.geometry.computeBoundingBox();
        const bbox = raw.geometry.boundingBox || new THREE.Box3();
        const triCount = raw.geometry.index
          ? raw.geometry.index.count / 3
          : (raw.geometry.getAttribute('position')?.count || 0) / 3;
        const vertCount = raw.geometry.getAttribute('position')?.count || 0;
        const vol = computeGeometryVolume(raw.geometry);

        return {
          id,
          name: isCompare ? `[比較] ${raw.name}` : raw.name,
          mesh,
          wireMesh,
          originalPosition: mesh.position.clone(),
          color,
          visible: true,
          triangleCount: Math.round(triCount),
          vertexCount: vertCount,
          volumeMm3: vol,
          boundingBox: bbox,
          isCompare,
        };
      });
    },
    []
  );

  // -------------------------------------------------------------
  // UPDATE METADATA RE-CALCULATION
  // -------------------------------------------------------------
  const updateMetadataFromParts = useCallback(
    (partList: CADPart[], fileName: string, format: string, fileSize = 0) => {
      const nonCompare = partList.filter((p) => !p.isCompare);
      if (nonCompare.length === 0) {
        setMetadata(null);
        return;
      }

      const overallBox = new THREE.Box3();
      nonCompare.forEach((p) => overallBox.union(p.boundingBox));

      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      overallBox.getSize(size);
      overallBox.getCenter(center);

      const totalTriangles = nonCompare.reduce((sum, p) => sum + p.triangleCount, 0);
      const totalVertices = nonCompare.reduce((sum, p) => sum + p.vertexCount, 0);
      const totalVolumeCm3 = nonCompare.reduce((sum, p) => sum + p.volumeMm3 / 1000, 0);

      setMetadata({
        fileName,
        format,
        fileSize,
        partCount: nonCompare.length,
        totalTriangles,
        totalVertices,
        dimensions: {
          x: size.x,
          y: size.y,
          z: size.z,
        },
        cadOriginOffset: {
          x: center.x,
          y: center.y,
          z: center.z,
        },
        totalVolumeCm3,
      });
    },
    []
  );

  // -------------------------------------------------------------
  // LOAD FILE HANDLERS
  // -------------------------------------------------------------
  const handleLoadFile = useCallback(
    async (file: File, isCompare = false) => {
      setLoadingText(`${isCompare ? '比較用' : ''}ファイルを解析中: ${file.name}...`);
      try {
        const { parts: rawParts, format } = await parseCADFile(file);
        const built = buildPartsFromRaw(rawParts, isCompare);

        if (isCompare) {
          setParts((prev) => [...prev, ...built]);
          showToast(`比較用モデル "${file.name}" を追加しました`);
        } else {
          setParts(built);
          updateMetadataFromParts(built, file.name, format, file.size);
          setLastDeletedPart(null);

          // Calculate dimensions for toast
          const overallBox = new THREE.Box3();
          built.forEach((p) => overallBox.union(p.boundingBox));
          const sz = new THREE.Vector3();
          overallBox.getSize(sz);

          showToast(
            `"${file.name}" (${built.length}パーツ) 読み込み完了 [寸法: X ${formatMm(sz.x)} × Y ${formatMm(sz.y)} × Z ${formatMm(sz.z)} mm]`
          );
          setTimeout(() => {
            resetCameraRef.current?.();
          }, 60);
        }

        // Reset tools
        setExplodeFactor(0);
        setClipAxis('off');
        if (clearMeasureRef.current) clearMeasureRef.current();
        setHasMeasurePoints(false);
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'ファイルの読み込みに失敗しました', 'error');
      } finally {
        setLoadingText(null);
      }
    },
    [buildPartsFromRaw, updateMetadataFromParts, showToast]
  );

  // Initial demo model on mount
  useEffect(() => {
    const raw = generateSampleModel('gear');
    const built = buildPartsFromRaw(raw, false);
    setParts(built);
    updateMetadataFromParts(built, '平歯車 & 駆動シャフト (サンプル)', 'CAD Solid Mesh', 245000);
  }, [buildPartsFromRaw, updateMetadataFromParts]);

  // Load sample model from modal
  const handleSelectSample = (type: 'gear' | 'bearing' | 'bracket') => {
    const names = {
      gear: '平歯車 & 駆動シャフト',
      bearing: 'ボールベアリング機構',
      bracket: 'L字マウントブラケット',
    };
    const raw = generateSampleModel(type);
    const built = buildPartsFromRaw(raw, false);
    setParts(built);
    updateMetadataFromParts(built, names[type], 'CAD Parametric', 180000);
    showToast(`サンプルモデル "${names[type]}" を読み込みました`);
    setExplodeFactor(0);
    setClipAxis('off');
    if (clearMeasureRef.current) clearMeasureRef.current();
    setTimeout(() => {
      resetCameraRef.current?.();
    }, 60);
  };

  // -------------------------------------------------------------
  // DRAG & DROP
  // -------------------------------------------------------------
  const dragCounter = useRef(0);
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleLoadFile(e.dataTransfer.files[0], false);
    }
  };

  // -------------------------------------------------------------
  // PART MANAGEMENT (VISIBILITY, COLOR, DELETE, UNDO)
  // -------------------------------------------------------------
  const handleTogglePartVisibility = (id: string) => {
    setParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p))
    );
  };

  const handleSetAllVisibility = (visible: boolean) => {
    setParts((prev) => prev.map((p) => ({ ...p, visible })));
  };

  const handleChangePartColor = (id: string, hexColor: string) => {
    const col = new THREE.Color(hexColor);
    setParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color: col } : p))
    );
  };

  const handleDeletePart = (id: string) => {
    const target = parts.find((p) => p.id === id);
    if (!target) return;
    setLastDeletedPart(target);
    const nextParts = parts.filter((p) => p.id !== id);
    setParts(nextParts);
    if (metadata) {
      updateMetadataFromParts(nextParts, metadata.fileName, metadata.format, metadata.fileSize);
    }
    showToast(`パーツ「${target.name}」を削除しました (Undo可能)`);
  };

  const handleUndoDelete = () => {
    if (!lastDeletedPart) return;
    const nextParts = [...parts, lastDeletedPart];
    setParts(nextParts);
    if (metadata) {
      updateMetadataFromParts(nextParts, metadata.fileName, metadata.format, metadata.fileSize);
    }
    setLastDeletedPart(null);
    showToast(`削除を取り消しました`);
  };

  // Compare mode helpers
  const hasCompareParts = parts.some((p) => p.isCompare);
  const handleClearCompare = () => {
    setParts((prev) => prev.filter((p) => !p.isCompare));
    showToast('比較用モデルを消去しました');
  };

  const handleAlignCompare = () => {
    const origParts = parts.filter((p) => !p.isCompare);
    const compParts = parts.filter((p) => p.isCompare);
    if (!origParts.length || !compParts.length) return;

    const boxA = new THREE.Box3();
    origParts.forEach((p) => boxA.union(p.boundingBox));
    const boxB = new THREE.Box3();
    compParts.forEach((p) => boxB.union(p.boundingBox));

    const centerA = new THREE.Vector3();
    const centerB = new THREE.Vector3();
    boxA.getCenter(centerA);
    boxB.getCenter(centerB);

    const delta = centerA.clone().sub(centerB);
    compParts.forEach((p) => {
      p.mesh.position.add(delta);
      p.wireMesh.position.add(delta);
      p.originalPosition.add(delta);
      p.boundingBox.translate(delta);
    });

    setParts([...parts]);
    showToast('比較モデルの中心を一致させました');
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans"
    >
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.step,.stp,.stl,.3mf,.obj,.zip"
        onChange={(e) => {
          if (e.target.files?.[0]) handleLoadFile(e.target.files[0], false);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={compareInputRef}
        type="file"
        accept=".glb,.gltf,.step,.stp,.stl,.3mf,.obj,.zip"
        onChange={(e) => {
          if (e.target.files?.[0]) handleLoadFile(e.target.files[0], true);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Top Bar */}
      <TopBar
        metadata={metadata}
        onOpenFile={() => fileInputRef.current?.click()}
        onOpenCompare={() => compareInputRef.current?.click()}
        onOpenSample={() => setSampleModalOpen(true)}
        onScreenshot={() => screenshotRef.current?.()}
        onOpenVideoExport={() => setVideoModalOpen(true)}
        onToggleFullscreen={handleToggleFullscreen}
        onResetView={() => resetCameraRef.current?.()}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((prev) => !prev)}
      />

      {/* Main 3D Canvas */}
      <CADViewer
        parts={parts}
        viewMode={viewMode}
        materialPreset={materialPreset}
        clipAxis={clipAxis}
        clipPosition={clipPosition}
        clipInverted={clipInverted}
        explodeFactor={explodeFactor}
        isMeasuring={isMeasuring}
        onMeasureComplete={(res) => {
          setHasMeasurePoints(true);
          showToast(`計測距離: ${res.distance.toFixed(2)} mm`);
        }}
        onClearMeasureRef={(fn) => {
          clearMeasureRef.current = fn;
        }}
        autoRotate={autoRotate}
        rotationSpeed={rotationSpeed}
        pivotMode={pivotMode}
        backgroundColor={backgroundColor}
        showGrid={showGrid}
        showDimensionsBox={showDimensionsBox}
        onToggleDimensionsBox={() => setShowDimensionsBox((prev) => !prev)}
        onCameraUpdate={(cam) => {
          cameraRef.current = cam;
        }}
        onSetCameraViewRef={(fn) => {
          setCameraViewRef.current = fn;
        }}
        onResetCameraRef={(fn) => {
          resetCameraRef.current = fn;
        }}
        onResetPivotRef={(fn) => {
          resetPivotRef.current = fn;
        }}
        onScreenshotRef={(fn) => {
          screenshotRef.current = fn;
        }}
        onRecordTurntableRef={(fn) => {
          recordTurntableRef.current = fn;
        }}
        onStopRecordingRef={(fn) => {
          stopRecordingRef.current = fn;
        }}
        selectedPartId={selectedPartId}
        onSelectPart={setSelectedPartId}
        onCustomPivotChanged={setHasCustomPivot}
      />

      {/* 3D Orientation Gizmo */}
      <OrientationGizmo
        camera={cameraRef.current}
        onSetView={(view) => setCameraViewRef.current?.(view)}
      />

      {/* Floating Bottom Toolbar */}
      <FloatingToolbar
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        materialPreset={materialPreset}
        onSetMaterialPreset={setMaterialPreset}
        clipAxis={clipAxis}
        clipPosition={clipPosition}
        clipInverted={clipInverted}
        onSetClipAxis={setClipAxis}
        onSetClipPosition={setClipPosition}
        onToggleClipInverted={() => setClipInverted((prev) => !prev)}
        explodeFactor={explodeFactor}
        onSetExplodeFactor={setExplodeFactor}
        isMeasuring={isMeasuring}
        onToggleMeasuring={() => {
          setIsMeasuring((prev) => !prev);
          if (!isMeasuring) {
            showToast('モデル上の2点をクリックして距離を計測');
          }
        }}
        onClearMeasure={() => {
          if (clearMeasureRef.current) clearMeasureRef.current();
          setHasMeasurePoints(false);
        }}
        hasMeasurePoints={hasMeasurePoints}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
        rotationSpeed={rotationSpeed}
        onSetRotationSpeed={setRotationSpeed}
        onOpenVideoExport={() => setVideoModalOpen(true)}
        onSetCameraView={(view) => setCameraViewRef.current?.(view)}
        pivotMode={pivotMode}
        onResetPivot={() => {
          resetPivotRef.current?.();
          showToast('回転ピボットをモデル中心に戻しました');
        }}
        hasCustomPivot={hasCustomPivot}
      />

      {/* Right Inspector Panel */}
      <InspectorPanel
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        metadata={metadata}
        parts={parts}
        selectedPartId={selectedPartId}
        onSelectPart={setSelectedPartId}
        onTogglePartVisibility={handleTogglePartVisibility}
        onSetAllVisibility={handleSetAllVisibility}
        onDeletePart={handleDeletePart}
        onUndoDelete={handleUndoDelete}
        canUndo={lastDeletedPart !== null}
        onChangePartColor={handleChangePartColor}
        selectedDensityId={selectedDensityId}
        onSelectDensityId={setSelectedDensityId}
        customDensity={customDensity}
        onSetCustomDensity={setCustomDensity}
        pricePerKg={pricePerKg}
        onSetPricePerKg={setPricePerKg}
        pivotMode={pivotMode}
        onSetPivotMode={setPivotMode}
        onResetPivot={() => {
          resetPivotRef.current?.();
          showToast('回転ピボットをモデル中心に戻しました');
        }}
        hasCustomPivot={hasCustomPivot}
        backgroundColor={backgroundColor}
        onSetBackgroundColor={setBackgroundColor}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((prev) => !prev)}
        hasCompareParts={hasCompareParts}
        onClearCompare={handleClearCompare}
        onAlignCompare={handleAlignCompare}
      />

      {/* Sample Model Modal */}
      <SampleModelModal
        isOpen={sampleModalOpen}
        onClose={() => setSampleModalOpen(false)}
        onSelectSample={handleSelectSample}
      />

      {/* 360 Turntable Video Export Modal */}
      <VideoExportModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        isRecording={isRecording}
        recordingProgress={recordingProgress}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        recordedVideoUrl={recordedVideoUrl}
        recordedFileSize={recordedFileSize}
        recordedFileName={recordedFileName}
      />

      {/* Loading Overlay */}
      {loadingText && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md text-white animate-in fade-in duration-150">
          <div className="bg-slate-900/90 border border-slate-700/80 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <div className="text-sm font-semibold text-slate-100">{loadingText}</div>
            <div className="text-xs text-slate-400">Dracoメッシュ展開 & ジオメトリ最適化中...</div>
          </div>
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-4 z-50 border-2 border-dashed border-sky-400 rounded-3xl bg-sky-950/40 backdrop-blur-md flex flex-col items-center justify-center gap-3 text-sky-300 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <UploadCloud className="w-14 h-14 text-sky-400 animate-bounce" />
          <div className="text-lg font-bold text-white">CADファイルをここにドロップ</div>
          <div className="text-xs text-sky-300/80">.glb · .step · .stp · .stl · .3mf · .obj · .zip</div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-slate-900/95 border border-slate-700/80 text-white shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-150">
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}
