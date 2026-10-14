import React from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  Share2,
  ExternalLink,
  X,
  FileCheck,
  FolderOpen,
  ArrowRight
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      // Installed
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 font-sans">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Android端末でのファイル関連付け</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                GLB / STL 対応
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              タップして直接起動するための設定手順ガイド
            </p>
          </div>
        </div>

        {/* Status Banner */}
        <div className="mb-5 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isInstalled ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Download className="w-5 h-5 text-sky-400 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold text-slate-200">
                {isInstalled
                  ? 'アプリ（PWA）は端末にインストール済みです'
                  : 'アプリを端末にインストールするとファイル関連付けが有効になります'}
              </div>
              <div className="text-[11px] text-slate-400">
                {isInstalled
                  ? 'Androidのファイル管理アプリから直接このアプリを開けます'
                  : 'Chrome経由で端末のネイティブアプリ（WebAPK）として登録されます'}
              </div>
            </div>
          </div>

          {!isInstalled && isInstallable && (
            <button
              onClick={handleInstallClick}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-xl shadow-lg shadow-sky-500/25 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>今すぐインストール</span>
            </button>
          )}
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3.5 mb-5 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex gap-3">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              1
            </div>
            <div>
              <div className="font-semibold text-white mb-0.5">
                アプリを端末にインストール（ホーム画面に追加）
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Chromeブラウザの右上メニュー（︙）をタップし、<strong>「アプリをインストール」</strong>または<strong>「ホーム画面に追加」</strong>を選択します。
                これによりAndroidシステムにファイル受信用のWebAPKパッケージが自動生成されます。
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex gap-3">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              2
            </div>
            <div>
              <div className="font-semibold text-white mb-0.5">
                「ファイル」アプリで .glb や .stl をタップ
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                端末の「ファイル」アプリ（Google Files、マイファイル等）や「ダウンロード」一覧で、開きたい <strong>.glb</strong> や <strong>.stl</strong> ファイルをタップします。
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              3
            </div>
            <div>
              <div className="font-semibold text-emerald-300 mb-0.5 flex items-center gap-1.5">
                <span>「常にこのアプリで開く」に設定</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-normal">重要</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                「アプリで開く」ポップアップ一覧に <strong>[CADStudio 3D]</strong> が表示されます。
                選択して<strong>「常に開く（常時）」</strong>をタップすると、次回以降はタップするだけで自動的に本アプリが起動し、3Dモデルがそのまま表示されます！
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex gap-3">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              4
            </div>
            <div>
              <div className="font-semibold text-purple-300 mb-0.5">
                「共有（Share）」メニューからも直接転送可能
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                メールやLINE、Google Driveなどのアプリでファイルを長押しし、<strong>「共有」→「CADStudio 3D」</strong>を選択することでも、直接モデルを即座に読み込めます。
              </p>
            </div>
          </div>
        </div>

        {/* Supported Formats */}
        <div className="mb-5 pt-3 border-t border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 mb-2">
            関連付け対応フォーマット一覧:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { ext: '.glb', label: 'GLTFバイナリ' },
              { ext: '.stl', label: 'STLメッシュ' },
              { ext: '.step', label: 'STEP CAD' },
              { ext: '.stp', label: 'STP CAD' },
              { ext: '.3mf', label: '3MF 3D印刷' },
              { ext: '.obj', label: 'Wavefront OBJ' },
              { ext: '.gltf', label: 'GLTF JSON' },
              { ext: '.zip', label: 'ZIPアーカイブ' },
            ].map((f) => (
              <span
                key={f.ext}
                className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-300 flex items-center gap-1"
              >
                <span className="text-sky-400 font-bold">{f.ext}</span>
                <span className="text-[10px] text-slate-500 font-sans">{f.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
