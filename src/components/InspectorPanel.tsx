import React, { useState } from 'react';
import {
  X,
  Layers,
  Calculator,
  Settings,
  Eye,
  EyeOff,
  Trash2,
  Undo2,
  Maximize2,
  Palette,
  Crosshair,
  Grid,
  Sun,
  ShieldAlert,
  GitCompare,
  RotateCcw
} from 'lucide-react';
import { CADPart, ModelMetadata, MATERIAL_DENSITIES, PivotMode } from '../types/cad';
import { formatMm, formatGrams } from '../utils/cadMath';

interface InspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: ModelMetadata | null;
  parts: CADPart[];
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
  onTogglePartVisibility: (id: string) => void;
  onSetAllVisibility: (visible: boolean) => void;
  onDeletePart: (id: string) => void;
  onUndoDelete: () => void;
  canUndo: boolean;
  onChangePartColor: (id: string, hexColor: string) => void;
  selectedDensityId: string;
  onSelectDensityId: (id: string) => void;
  customDensity: number;
  onSetCustomDensity: (d: number) => void;
  pricePerKg: number;
  onSetPricePerKg: (p: number) => void;
  pivotMode: PivotMode;
  onSetPivotMode: (mode: PivotMode) => void;
  onResetPivot: () => void;
  hasCustomPivot: boolean;
  backgroundColor: string;
  onSetBackgroundColor: (color: string) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  hasCompareParts: boolean;
  onClearCompare: () => void;
  onAlignCompare: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  isOpen,
  onClose,
  metadata,
  parts,
  selectedPartId,
  onSelectPart,
  onTogglePartVisibility,
  onSetAllVisibility,
  onDeletePart,
  onUndoDelete,
  canUndo,
  onChangePartColor,
  selectedDensityId,
  onSelectDensityId,
  customDensity,
  onSetCustomDensity,
  pricePerKg,
  onSetPricePerKg,
  pivotMode,
  onSetPivotMode,
  onResetPivot,
  hasCustomPivot,
  backgroundColor,
  onSetBackgroundColor,
  showGrid,
  onToggleGrid,
  hasCompareParts,
  onClearCompare,
  onAlignCompare,
}) => {
  const [activeTab, setActiveTab] = useState<'parts' | 'props' | 'settings'>('parts');

  if (!isOpen) return null;

  // Active density
  const currentDensity =
    selectedDensityId === 'custom'
      ? customDensity
      : MATERIAL_DENSITIES.find((m) => m.id === selectedDensityId)?.density || 1.24;

  const totalVolumeCm3 = parts
    .filter((p) => !p.isCompare && p.visible)
    .reduce((sum, p) => sum + p.volumeMm3 / 1000, 0);

  const estimatedGrams = totalVolumeCm3 * currentDensity;
  const estimatedCost = (estimatedGrams / 1000) * pricePerKg;

  return (
    <aside className="fixed top-16 right-4 bottom-6 w-80 md:w-88 bg-slate-950/90 backdrop-blur-2xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col z-20 text-slate-100 overflow-hidden select-none animate-in slide-in-from-right-4 duration-200">
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('parts')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'parts'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>パーツ ({parts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('props')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'props'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>物性・原価</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>設定</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Tab 1: Parts List */}
        {activeTab === 'parts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                アセンブリ構成パーツ
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSetAllVisibility(true)}
                  className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="すべてのパーツを表示"
                >
                  全表示
                </button>
                <button
                  onClick={() => onSetAllVisibility(false)}
                  className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="すべてのパーツを非表示"
                >
                  全非表示
                </button>
                {canUndo && (
                  <button
                    onClick={onUndoDelete}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
                    title="直前の削除を元に戻す"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Undo</span>
                  </button>
                )}
              </div>
            </div>

            {parts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                読み込まれたパーツはありません
              </div>
            ) : (
              <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {parts.map((p) => {
                  const isSelected = selectedPartId === p.id;
                  const hex = '#' + p.color.getHexString();

                  return (
                    <div
                      key={p.id}
                      onClick={() => onSelectPart(isSelected ? null : p.id)}
                      className={`group flex items-center gap-2 p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500/60 text-sky-100'
                          : p.isCompare
                          ? 'bg-blue-950/30 border-blue-800/40 text-blue-200'
                          : 'bg-slate-900/60 border-slate-800/70 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      {/* Color picker circle */}
                      <label
                        className="relative w-4 h-4 rounded-full shrink-0 cursor-pointer border border-white/20 shadow-sm"
                        style={{ backgroundColor: hex }}
                        onClick={(e) => e.stopPropagation()}
                        title="パーツの色を変更"
                      >
                        <input
                          type="color"
                          value={hex}
                          onChange={(e) => onChangePartColor(p.id, e.target.value)}
                          className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                        />
                      </label>

                      {/* Part name */}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-slate-200" title={p.name}>
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                          {p.triangleCount.toLocaleString()} △
                        </div>
                      </div>

                      {/* Visibility toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePartVisibility(p.id);
                        }}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          p.visible
                            ? 'text-slate-400 hover:text-white'
                            : 'text-rose-400 hover:text-rose-300 bg-rose-950/40'
                        }`}
                        title={p.visible ? 'パーツを非表示' : 'パーツを表示'}
                      >
                        {p.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePart(p.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="パーツを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Properties & Estimation */}
        {activeTab === 'props' && (
          <div className="space-y-4">
            {/* Dimensions */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                外形寸法 (Bounding Box)
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-red-400 font-bold block">X 幅</span>
                  <span className="font-mono text-sm font-semibold text-slate-100">
                    {metadata ? formatMm(metadata.dimensions.x) : '—'}
                  </span>
                  <span className="text-[9px] text-slate-500 block">mm</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-emerald-400 font-bold block">Y 幅</span>
                  <span className="font-mono text-sm font-semibold text-slate-100">
                    {metadata ? formatMm(metadata.dimensions.y) : '—'}
                  </span>
                  <span className="text-[9px] text-slate-500 block">mm</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-blue-400 font-bold block">Z 高さ</span>
                  <span className="font-mono text-sm font-semibold text-slate-100">
                    {metadata ? formatMm(metadata.dimensions.z) : '—'}
                  </span>
                  <span className="text-[9px] text-slate-500 block">mm</span>
                </div>
              </div>
            </div>

            {/* Mass Properties */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                材料密度 & 重量試算
              </div>

              {/* Material Selector */}
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">材料プリセット</label>
                <select
                  value={selectedDensityId}
                  onChange={(e) => onSelectDensityId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                >
                  <optgroup label="樹脂・プラスチック (3Dプリント)">
                    {MATERIAL_DENSITIES.filter((m) => m.category === 'plastic').map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.density} g/cm³)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="金属・機械材料">
                    {MATERIAL_DENSITIES.filter((m) => m.category === 'metal').map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.density} g/cm³)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="複合材料">
                    {MATERIAL_DENSITIES.filter((m) => m.category === 'composite').map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.density} g/cm³)
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">カスタム密度...</option>
                </select>
              </div>

              {selectedDensityId === 'custom' && (
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">カスタム密度 (g/cm³)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={customDensity}
                    onChange={(e) => onSetCustomDensity(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {/* Price per Kg */}
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">材料単価 (円 / kg)</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={pricePerKg}
                  onChange={(e) => onSetPricePerKg(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-sky-500"
                />
              </div>

              {/* Calculated Results */}
              <div className="border-t border-slate-800 pt-2 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">実体積 (Volume):</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {totalVolumeCm3.toFixed(2)} cm³
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">推定重量 (Weight):</span>
                  <span className="font-mono font-bold text-sky-400">
                    {formatGrams(estimatedGrams)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">推定材料費 (Cost):</span>
                  <span className="font-mono font-bold text-emerald-400">
                    ¥{Math.round(estimatedCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Settings & Pivot */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* Rotation Pivot Control */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>回転軸 (Rotation Pivot)</span>
                {hasCustomPivot && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    任意点固定中
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSetPivotMode('center')}
                  className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                    pivotMode === 'center'
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                      : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                    <span>幾何中心</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    モデル中心でブレずに回転 (推奨)
                  </div>
                </button>

                <button
                  onClick={() => onSetPivotMode('origin')}
                  className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                    pivotMode === 'origin'
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                      : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>CAD原点</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    CAD座標系 (0,0,0) を中心に回転
                  </div>
                </button>
              </div>

              <div className="p-2 bg-slate-950/80 rounded-lg text-[11px] text-slate-400 border border-slate-800">
                <span className="text-sky-300 font-semibold">💡 ヒント:</span>{' '}
                モデル表面を<span className="text-white font-medium">ダブルクリック</span>すると、クリックした位置が新しい回転ピボットになります！
              </div>

              {hasCustomPivot && (
                <button
                  onClick={onResetPivot}
                  className="w-full py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition-colors cursor-pointer"
                >
                  モデル中心にピボットを戻す
                </button>
              )}
            </div>

            {/* Background Color */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                ビューポート背景色
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: '深宇宙', color: '#090d16' },
                  { label: 'ダーク', color: '#111827' },
                  { label: 'スレート', color: '#1e293b' },
                  { label: 'ライト', color: '#f1f5f9' },
                  { label: 'ホワイト', color: '#ffffff' },
                ].map((b) => (
                  <button
                    key={b.color}
                    onClick={() => onSetBackgroundColor(b.color)}
                    className={`h-8 rounded-lg border flex items-center justify-center transition-transform hover:scale-105 cursor-pointer ${
                      backgroundColor === b.color ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: b.color }}
                    title={b.label}
                  />
                ))}
              </div>
            </div>

            {/* Grid & Environment */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                表示アシスト
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">地面グリッド (CAD Grid)</span>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={onToggleGrid}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500 cursor-pointer w-4 h-4"
                />
              </div>
            </div>

            {/* Compare Tools */}
            {hasCompareParts && (
              <div className="bg-blue-950/40 p-3 rounded-xl border border-blue-800/60 space-y-2">
                <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GitCompare className="w-3.5 h-3.5 text-blue-400" />
                  <span>2ファイル比較中</span>
                </div>
                <div className="text-[11px] text-blue-200/80 leading-relaxed">
                  追加された比較用モデルが半透明ブルーで表示されています。
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={onAlignCompare}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    中心を一致させる
                  </button>
                  <button
                    onClick={onClearCompare}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    消去
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel Footer: Version info */}
      <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
        <span>CADStudio 3D Viewer</span>
        <span className="text-sky-400 font-semibold bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
          v2.1.0
        </span>
      </div>
    </aside>
  );
};
