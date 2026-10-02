import React from 'react';
import { X, Cog, Disc, Layers } from 'lucide-react';

interface SampleModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (type: 'gear' | 'bearing' | 'bracket') => void;
}

export const SampleModelModal: React.FC<SampleModelModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
}) => {
  if (!isOpen) return null;

  const samples = [
    {
      id: 'gear' as const,
      title: 'インダストリアル平歯車 (Spur Gear & Shaft)',
      format: 'CAD Parametric Solid',
      parts: '2パーツ (歯車 + 駆動軸)',
      desc: 'インボリュート歯形とキー溝を持つ本格的な機械要素モデル。回転軸や寸法検査のテストに最適です。',
      icon: Cog,
      accent: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    },
    {
      id: 'bearing' as const,
      title: 'ボールベアリング機構 (Ball Bearing Assembly)',
      format: 'Assembly (10 Parts)',
      parts: '10パーツ (外輪 + 内輪 + 8玉)',
      desc: '内輪・外輪および8個の鋼球からなるアセンブリ。分解ビュー(Explode)やパーツツリー操作の確認に最適です。',
      icon: Disc,
      accent: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    },
    {
      id: 'bracket' as const,
      title: 'L字マウントブラケット (Machined L-Bracket)',
      format: 'Structural CAD Solid',
      parts: '2パーツ (ブラケット + 補強ピン)',
      desc: 'ボルト穴とリブ補強を持つ機械ブラケット構造体。断面カット(Section)や肉厚計測のテストに最適です。',
      icon: Layers,
      accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">サンプルCADモデルの読み込み</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              手元にCADファイルがない場合でも、ワンクリックですぐにビューアーの機能を体験できます
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {samples.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSample(s.id);
                  onClose();
                }}
                className="group flex items-start gap-3 p-3.5 rounded-xl border border-slate-800 hover:border-sky-500/60 bg-slate-950/60 hover:bg-slate-800/50 transition-all cursor-pointer"
              >
                <div className={`p-2.5 rounded-xl border shrink-0 ${s.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition-colors">
                      {s.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                      {s.parts}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
