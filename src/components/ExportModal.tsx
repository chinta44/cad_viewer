import React, { useState } from 'react';
import {
  X,
  Download,
  FileCode,
  Box,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Printer,
  Sparkles,
  Info
} from 'lucide-react';
import { CADPart, ModelMetadata } from '../types/cad';
import { ExportFormat, ExportOptions, exportCADModel, downloadBlob } from '../utils/cadExporters';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: CADPart[];
  metadata: ModelMetadata | null;
  selectedPartId: string | null;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

interface FormatInfo {
  id: ExportFormat;
  title: string;
  ext: string;
  badge: string;
  badgeColor: string;
  description: string;
  whyUse: string;
  colorSupport: string;
  precisionNote: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMATS: FormatInfo[] = [
  {
    id: 'glb-uncompressed',
    title: '非圧縮 標準 GLB (Binary glTF)',
    ext: '.glb',
    badge: 'おすすめ · 高互換',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Dracoなどの特殊デコーダーが一切不要な、標準バイナリglTF。',
    whyUse: 'HTML単体アプリやWebビューアー、Windows 3Dビューアー、Office、Blender等で確実にそのまま開けます。圧縮GLBが開けない時の変換に最適！',
    colorSupport: 'カラー・金属質感・パーツ階層を完全保持',
    precisionNote: '形状精度100%維持（寸法劣化なし）',
    icon: Box,
  },
  {
    id: 'html-viewer',
    title: '自己完結型 HTML 3Dビューアー',
    ext: '.html',
    badge: '配布・プレゼン用',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    description: '3Dモデルとビューアーエンジンが1枚のHTMLファイルに完全に内蔵。',
    whyUse: 'ダブルクリックするだけでブラウザで誰でもオフライン起動！相手にアプリやライブラリのインストールを求めずに3Dモデルを見せられます。',
    colorSupport: 'カラー・パーツ階層・ライティング完全内蔵',
    precisionNote: '形状精度100%維持（ビューアー機能付き）',
    icon: FileCode,
  },
  {
    id: 'stl-binary',
    title: 'STL 形式 (Binary)',
    ext: '.stl',
    badge: '3Dプリンター標準',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'スライサーソフト（Cura, Prusa, Bambu等）やCAMに直結する3Dプリント標準。',
    whyUse: '3D造形・CAM切削・各種CADソフト間のメッシュ受け渡しに最も広く使われます。',
    colorSupport: '単色（STL規格の仕様上カラー情報は含みません）',
    precisionNote: '形状精度100%維持（頂点座標はそのまま出力）',
    icon: Printer,
  },
  {
    id: 'obj',
    title: 'Wavefront OBJ',
    ext: '.obj',
    badge: 'CAD / CG 汎用',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: '歴史が最も長く、ほぼ全ての3D/CGソフトウェアで開ける普遍的な形式。',
    whyUse: '古いビューアーや他のCAD/3DCGツールへの確実なデータインポートに役立ちます。',
    colorSupport: 'メッシュ形状のみ（MTL非同梱時）',
    precisionNote: '形状精度100%維持',
    icon: FileText,
  },
  {
    id: 'ply-binary',
    title: 'PLY 形式 (Binary)',
    ext: '.ply',
    badge: '点群・解析用',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'Polygon File Format。3Dスキャナーや学術・工学解析で多用されます。',
    whyUse: 'メッシュや頂点データをシンプルかつ厳密に保存・交換したい場合に適しています。',
    colorSupport: '頂点カラー対応',
    precisionNote: '形状精度100%維持',
    icon: Layers,
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  parts,
  metadata,
  selectedPartId,
  onToast,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('glb-uncompressed');
  const [includeHidden, setIncludeHidden] = useState<boolean>(false);
  const [selectedOnly, setSelectedOnly] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const validParts = parts.filter((p) => !p.isCompare);
  const selectedPart = parts.find((p) => p.id === selectedPartId);
  const baseModelName = metadata?.fileName ? metadata.fileName.replace(/\.[^/.]+$/, '') : 'model';

  const handleExport = async () => {
    if (!validParts.length) {
      onToast('エクスポート可能なパーツがありません', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const options: ExportOptions = {
        format: selectedFormat,
        includeHidden,
        selectedOnly: selectedOnly && Boolean(selectedPartId),
        selectedPartId,
        modelName: baseModelName,
      };

      const { blob, filename } = await exportCADModel(validParts, options);
      downloadBlob(blob, filename);

      const formatLabel = FORMATS.find((f) => f.id === selectedFormat)?.title || selectedFormat;
      onToast(`${formatLabel} (${filename}) をダウンロードしました！`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Export error:', err);
      onToast(`エクスポートに失敗しました: ${err.message || '不明なエラー'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 rounded-xl border border-sky-500/30 text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                3Dデータ形式の変換・エクスポート
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  3D Converter
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                表示中のCADモデルを、高互換な非圧縮GLBやSTL、単体HTML等に変換して保存します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Helpful callout about Compressed GLB */}
          <div className="p-3.5 bg-sky-950/40 border border-sky-800/60 rounded-xl text-xs flex gap-3 text-sky-200">
            <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-semibold">圧縮GLBでお困りの方へ:</strong>
              <p className="mt-0.5 text-sky-300/90 leading-relaxed">
                自作のHTMLや簡易ビューアーで「圧縮GLB」が表示できない場合、
                <strong className="text-white">「非圧縮 標準 GLB」</strong>
                に変換すると、Draco等の特殊デコーダーを必要とせず、あらゆるブラウザ・HTML単体で確実に表示できるようになります！
              </p>
            </div>
          </div>

          {/* Format Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              変換先フォーマットを選択
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FORMATS.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = selectedFormat === fmt.id;
                return (
                  <div
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/80 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/40'
                        : 'bg-slate-850 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                          <span className="font-bold text-sm text-slate-100">{fmt.title}</span>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${fmt.badgeColor}`}>
                          {fmt.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug">{fmt.description}</p>
                      <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800 leading-relaxed">
                        <strong className="text-sky-300">用途: </strong>
                        {fmt.whyUse}
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="bg-slate-900/40 px-2 py-1 rounded border border-slate-800 text-slate-300">
                          <span className="text-slate-400 block text-[9px]">形状寸法精度</span>
                          <span className="text-emerald-400 font-medium">{fmt.precisionNote}</span>
                        </div>
                        <div className="bg-slate-900/40 px-2 py-1 rounded border border-slate-800 text-slate-300">
                          <span className="text-slate-400 block text-[9px]">色彩・質感</span>
                          <span className={fmt.id === 'stl-binary' ? 'text-amber-400 font-medium' : 'text-sky-300 font-medium'}>
                            {fmt.colorSupport}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                      <span>拡張子: <strong className="text-slate-200">{fmt.ext}</strong></span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-sky-400 font-semibold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 選択中
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Settings */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">出力オプション</span>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeHidden}
                  onChange={(e) => setIncludeHidden(e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                />
                <span>非表示設定のパーツも含める</span>
              </label>

              {selectedPart && (
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedOnly}
                    onChange={(e) => setSelectedOnly(e.target.checked)}
                    className="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span>
                    選択中パーツ（<strong className="text-sky-300">{selectedPart.name}</strong>）のみ出力
                  </span>
                </label>
              )}
            </div>

            <div className="text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 flex items-center justify-between font-mono">
              <span>対象パーツ数: <strong className="text-white">{selectedOnly && selectedPart ? 1 : validParts.length}</strong> パーツ</span>
              <span>推定出力ファイル名: <strong className="text-sky-300">{baseModelName}_{selectedFormat === 'glb-uncompressed' ? 'standard.glb' : selectedFormat === 'html-viewer' ? 'viewer.html' : selectedFormat.replace('-binary', '').replace('-ascii', '')}</strong></span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            キャンセル
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting || validParts.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>変換・エクスポート処理中...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>変換してダウンロード</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
