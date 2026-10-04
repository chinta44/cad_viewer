import React from 'react';
import {
  FolderOpen,
  Camera,
  Maximize2,
  Minimize2,
  Box,
  Layers,
  Sparkles,
  GitCompare,
  RotateCcw,
  Video
} from 'lucide-react';
import { ModelMetadata } from '../types/cad';
import { formatMm } from '../utils/cadMath';

interface TopBarProps {
  metadata: ModelMetadata | null;
  onOpenFile: () => void;
  onOpenCompare: () => void;
  onOpenSample: () => void;
  onScreenshot: () => void;
  onOpenVideoExport?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen: () => void;
  onResetView: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  metadata,
  onOpenFile,
  onOpenCompare,
  onOpenSample,
  onScreenshot,
  onOpenVideoExport,
  isFullscreen = false,
  onToggleFullscreen,
  onResetView,
  inspectorOpen,
  onToggleInspector,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 z-30 px-4 flex items-center justify-between gap-4 text-slate-100 select-none">
      {/* Zone 1: Brand & Version */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Box className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white flex items-baseline gap-1.5">
            CADStudio 3D
            <span className="text-[11px] font-mono font-medium text-sky-400/90 tracking-normal">
              v2.1.0
            </span>
          </span>
        </div>
      </div>

      {/* Zone 2: Active Model Info */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
        {metadata ? (
          <>
            <span className="font-semibold text-slate-200 truncate max-w-[200px]" title={metadata.fileName}>
              {metadata.fileName}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-sky-400 font-medium font-mono">{metadata.format}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono tabular-nums">
              {formatMm(metadata.dimensions.x)} × {formatMm(metadata.dimensions.y)} × {formatMm(metadata.dimensions.z)} mm
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono tabular-nums">
              {metadata.totalTriangles.toLocaleString()} ポリゴン
            </span>
          </>
        ) : (
          <span className="text-slate-500">
            GLB / STEP / STL / 3MF / OBJ / ZIP をドロップまたは開いてください
          </span>
        )}
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenFile}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 active:bg-sky-600 rounded-lg shadow-sm shadow-sky-500/30 transition-colors whitespace-nowrap cursor-pointer"
          title="CADファイルを開く (.glb, .step, .stl, .3mf, .obj, .zip)"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>開く</span>
        </button>

        <button
          onClick={onOpenSample}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700/60 transition-colors whitespace-nowrap cursor-pointer"
          title="テスト用のCADサンプルモデルを読み込む"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>サンプル</span>
        </button>

        <button
          onClick={onOpenCompare}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700/60 transition-colors whitespace-nowrap cursor-pointer"
          title="2つ目のファイルを半透明で重ねて比較表示"
        >
          <GitCompare className="w-3.5 h-3.5 text-sky-400" />
          <span>重ねて比較</span>
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

        <button
          onClick={onResetView}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="カメラ視点を中心にリセット"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onScreenshot}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="高解像度スクリーンショットを撮影"
        >
          <Camera className="w-4 h-4" />
        </button>

        {onOpenVideoExport && (
          <button
            onClick={onOpenVideoExport}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
            title="360° 自動回転動画を録画・保存 (MP4)"
          >
            <Video className="w-4 h-4 text-rose-400" />
            <span className="hidden md:inline font-semibold">360°動画</span>
          </button>
        )}

        <button
          onClick={onToggleFullscreen}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isFullscreen
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title={isFullscreen ? '全画面表示を終了 (Esc / F)' : 'モデルを全画面表示 (F)'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onToggleInspector}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ml-1 ${
            inspectorOpen
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
              : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="パーツ階層ツリー & 物性計算パネルの表示切替"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">インスペクター</span>
        </button>
      </div>
    </header>
  );
};
