import React, { useState } from 'react';
import {
  Eye,
  Scissors,
  Ruler,
  RotateCw,
  Sparkles,
  Compass,
  Spline,
  FlipHorizontal,
  Target,
  Video,
  Play,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ViewMode, MaterialPreset, ClipAxis, CameraView, PivotMode } from '../types/cad';

interface FloatingToolbarProps {
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  materialPreset: MaterialPreset;
  onSetMaterialPreset: (preset: MaterialPreset) => void;
  clipAxis: ClipAxis;
  clipPosition: number;
  clipInverted: boolean;
  onSetClipAxis: (axis: ClipAxis) => void;
  onSetClipPosition: (pos: number) => void;
  onToggleClipInverted: () => void;
  explodeFactor: number;
  onSetExplodeFactor: (factor: number) => void;
  isMeasuring: boolean;
  onToggleMeasuring: () => void;
  onClearMeasure: () => void;
  hasMeasurePoints: boolean;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  rotationSpeed: number;
  onSetRotationSpeed: (speed: number) => void;
  onOpenVideoExport: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSetCameraView: (view: CameraView) => void;
  pivotMode: PivotMode;
  onResetPivot: () => void;
  hasCustomPivot: boolean;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  viewMode,
  onSetViewMode,
  materialPreset,
  onSetMaterialPreset,
  clipAxis,
  clipPosition,
  clipInverted,
  onSetClipAxis,
  onSetClipPosition,
  onToggleClipInverted,
  explodeFactor,
  onSetExplodeFactor,
  isMeasuring,
  onToggleMeasuring,
  onClearMeasure,
  hasMeasurePoints,
  autoRotate,
  onToggleAutoRotate,
  rotationSpeed,
  onSetRotationSpeed,
  onOpenVideoExport,
  isFullscreen = false,
  onToggleFullscreen,
  onSetCameraView,
  pivotMode,
  onResetPivot,
  hasCustomPivot,
}) => {
  const [activeMenu, setActiveMenu] = useState<'view' | 'mode' | 'material' | 'clip' | 'explode' | 'rotate' | null>(null);

  const toggleMenu = (menu: 'view' | 'mode' | 'material' | 'clip' | 'explode' | 'rotate') => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 select-none pointer-events-auto">
      {/* Popover Flyout Menu */}
      {activeMenu && (
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 mb-1 min-w-[240px]">
          {/* View Menu */}
          {activeMenu === 'view' && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>視点プリセット</span>
                <span className="text-[10px] text-slate-500">Camera Preset</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'iso' as CameraView, label: '等角 (ISO)' },
                  { id: 'front' as CameraView, label: '正面 (Front)' },
                  { id: 'back' as CameraView, label: '背面 (Back)' },
                  { id: 'top' as CameraView, label: '上面 (Top)' },
                  { id: 'bottom' as CameraView, label: '底面 (Bottom)' },
                  { id: 'right' as CameraView, label: '右面 (Right)' },
                  { id: 'left' as CameraView, label: '左面 (Left)' },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      onSetCameraView(v.id);
                      setActiveMenu(null);
                    }}
                    className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-sky-500/20 hover:text-sky-300 hover:border-sky-500/40 border border-slate-700/60 transition-colors text-center font-medium cursor-pointer"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode Menu */}
          {activeMenu === 'mode' && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                表示スタイル (Render Mode)
              </div>
              <div className="flex flex-col gap-1">
                {[
                  { id: 'solid' as ViewMode, label: 'ソリッド (Solid)', desc: '標準的な陰影付けポリゴン' },
                  { id: 'wire' as ViewMode, label: 'ワイヤーフレーム (Wireframe)', desc: 'ポリゴンエッジのみを表示' },
                  { id: 'both' as ViewMode, label: 'ソリッド + ワイヤー (Both)', desc: 'メッシュ構造と面を両方表示' },
                  { id: 'ghost' as ViewMode, label: 'ゴースト X線 (Ghost)', desc: '内部構造が見通せる半透明表示' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSetViewMode(m.id);
                      setActiveMenu(null);
                    }}
                    className={`flex flex-col text-left px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                      viewMode === m.id
                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="font-semibold text-xs">{m.label}</span>
                    <span className="text-[10px] text-slate-400">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Material Menu */}
          {activeMenu === 'material' && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                質感プリセット (Shading)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'normal' as MaterialPreset, label: '標準 CAD PBR' },
                  { id: 'clay' as MaterialPreset, label: 'マット・クレイ' },
                  { id: 'metal' as MaterialPreset, label: '金属 (メタリック)' },
                  { id: 'glass' as MaterialPreset, label: 'ガラス (半透明)' },
                  { id: 'normalColors' as MaterialPreset, label: '法線マップ (Normal)' },
                ].map((mat) => (
                  <button
                    key={mat.id}
                    onClick={() => {
                      onSetMaterialPreset(mat.id);
                      setActiveMenu(null);
                    }}
                    className={`px-3 py-2 rounded-xl border transition-colors text-center font-medium cursor-pointer ${
                      materialPreset === mat.id
                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {mat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clip / Section Menu */}
          {activeMenu === 'clip' && (
            <div className="w-[280px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>断面クリッピング</span>
                <button
                  onClick={onToggleClipInverted}
                  className={`p-1 rounded-md text-[10px] flex items-center gap-1 border transition-colors ${
                    clipInverted
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="切断方向を反転"
                >
                  <FlipHorizontal className="w-3 h-3" />
                  <span>反転</span>
                </button>
              </div>

              {/* Axis Selector */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                {[
                  { id: 'off' as ClipAxis, label: 'OFF' },
                  { id: 'x' as ClipAxis, label: 'X軸' },
                  { id: 'y' as ClipAxis, label: 'Y軸' },
                  { id: 'z' as ClipAxis, label: 'Z軸' },
                ].map((ax) => (
                  <button
                    key={ax.id}
                    onClick={() => onSetClipAxis(ax.id)}
                    className={`py-1.5 rounded-lg font-bold text-center text-xs border transition-colors cursor-pointer ${
                      clipAxis === ax.id
                        ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {ax.label}
                  </button>
                ))}
              </div>

              {/* Slider */}
              {clipAxis !== 'off' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>切断位置</span>
                    <span className="font-mono text-sky-400 font-bold">
                      {Math.round(clipPosition * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={clipPosition}
                    onChange={(e) => onSetClipPosition(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* Explode Menu */}
          {activeMenu === 'explode' && (
            <div className="w-[260px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>分解ビュー (Explode)</span>
                <span className="font-mono text-sky-400 font-bold">
                  {Math.round(explodeFactor * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={explodeFactor}
                onChange={(e) => onSetExplodeFactor(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>通常 (0%)</span>
                <span>最大展開 (200%)</span>
              </div>
            </div>
          )}

          {/* Rotate & Video Menu */}
          {activeMenu === 'rotate' && (
            <div className="w-[260px] space-y-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>自動回転・動画収録</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${autoRotate ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500'}`}>
                  {autoRotate ? '回転中' : '停止中'}
                </span>
              </div>

              {/* Toggle switch */}
              <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-300">中心軸自動回転</span>
                <button
                  onClick={onToggleAutoRotate}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    autoRotate ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {autoRotate ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Speed selector */}
              <div>
                <span className="text-[10px] text-slate-400 block mb-1.5 font-medium">回転速度</span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { val: 0.5, label: '0.5x 低速' },
                    { val: 1.0, label: '1.0x 標準' },
                    { val: 2.0, label: '2.0x 高速' },
                  ].map((s) => (
                    <button
                      key={s.val}
                      onClick={() => onSetRotationSpeed(s.val)}
                      className={`py-1 px-1.5 rounded-lg text-[11px] border text-center transition-colors cursor-pointer ${
                        rotationSpeed === s.val
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 font-bold'
                          : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Record CTA */}
              <button
                onClick={() => {
                  setActiveMenu(null);
                  onOpenVideoExport();
                }}
                className="w-full py-2 px-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>360° 動画を保存 (MP4)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Dock */}
      <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1 text-slate-200">
        {/* View button */}
        <button
          onClick={() => toggleMenu('view')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            activeMenu === 'view' ? 'bg-sky-500 text-white' : 'hover:bg-slate-800 text-slate-300'
          }`}
          title="カメラ視点の切り替え"
        >
          <Compass className="w-4 h-4" />
          <span className="hidden md:inline">視点</span>
        </button>

        {/* Render mode button */}
        <button
          onClick={() => toggleMenu('mode')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            activeMenu === 'mode' ? 'bg-sky-500 text-white' : 'hover:bg-slate-800 text-slate-300'
          }`}
          title="ワイヤーフレーム・ソリッド表示の切り替え"
        >
          <Eye className="w-4 h-4" />
          <span className="hidden md:inline">表示</span>
        </button>

        {/* Shading/Material button */}
        <button
          onClick={() => toggleMenu('material')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            activeMenu === 'material' ? 'bg-sky-500 text-white' : 'hover:bg-slate-800 text-slate-300'
          }`}
          title="マテリアル質感プリセット"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden md:inline">質感</span>
        </button>

        {/* Section / Clip button */}
        <button
          onClick={() => toggleMenu('clip')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            clipAxis !== 'off'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : activeMenu === 'clip'
              ? 'bg-sky-500 text-white'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          title="モデルの断面を切断表示"
        >
          <Scissors className="w-4 h-4" />
          <span className="hidden md:inline">断面</span>
        </button>

        {/* Explode button */}
        <button
          onClick={() => toggleMenu('explode')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            explodeFactor > 0
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : activeMenu === 'explode'
              ? 'bg-sky-500 text-white'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          title="アセンブリパーツの分解表示"
        >
          <Spline className="w-4 h-4" />
          <span className="hidden md:inline">分解</span>
        </button>

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        {/* Measure button */}
        <button
          onClick={onToggleMeasuring}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            isMeasuring
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          title="2点間の距離を計測（モデル上の2点をクリック）"
        >
          <Ruler className="w-4 h-4" />
          <span className="hidden sm:inline">計測</span>
        </button>

        {hasMeasurePoints && (
          <button
            onClick={onClearMeasure}
            className="px-2 py-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
            title="計測線をクリア"
          >
            クリア
          </button>
        )}

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        {/* Auto rotate button with settings flyout */}
        <div className="flex items-center">
          <button
            onClick={onToggleAutoRotate}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-l-xl text-xs font-medium transition-colors cursor-pointer ${
              autoRotate
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="中心軸でのターンテーブル自動回転 ON/OFF"
          >
            <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">回転</span>
          </button>
          <button
            onClick={() => toggleMenu('rotate')}
            className={`px-1.5 py-1.5 rounded-r-xl border-l border-slate-700/60 text-xs transition-colors cursor-pointer ${
              activeMenu === 'rotate'
                ? 'bg-sky-600 text-white'
                : autoRotate
                ? 'bg-sky-500 text-white hover:bg-sky-600'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="回転速度設定 & 録画オプション"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 360 Video Export Button */}
        <button
          onClick={onOpenVideoExport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 hover:border-rose-500/60 transition-all cursor-pointer shadow-sm"
          title="360° 自動回転動画を録画・保存 (MP4)"
        >
          <Video className="w-4 h-4 text-rose-400" />
          <span className="hidden sm:inline">動画(MP4)</span>
        </button>

        {/* Pivot reset button */}
        <button
          onClick={onResetPivot}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
            hasCustomPivot
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title={
            hasCustomPivot
              ? 'ダブルクリックした位置を中心に回転中（クリックでモデル中心に戻す）'
              : '現在: モデル幾何中心を中心に回転中'
          }
        >
          <Target className={`w-4 h-4 ${hasCustomPivot ? 'text-emerald-400 animate-pulse' : ''}`} />
          <span className="hidden lg:inline">
            {hasCustomPivot ? '中心へ復帰' : '中心軸'}
          </span>
        </button>

        {onToggleFullscreen && (
          <>
            <div className="h-4 w-px bg-slate-800 mx-0.5" />
            <button
              onClick={onToggleFullscreen}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isFullscreen
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={isFullscreen ? '全画面表示を終了 (Esc / F)' : 'モデルを全画面表示 (F)'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-sky-400" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
              <span className="hidden xl:inline">
                {isFullscreen ? '全画面終了' : '全画面'}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
