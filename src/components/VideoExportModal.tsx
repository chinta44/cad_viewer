import React, { useState } from 'react';
import {
  Video,
  X,
  Play,
  RotateCw,
  Download,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
  Info
} from 'lucide-react';

interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRecording: boolean;
  recordingProgress: number; // 0 to 100
  onStartRecording: (durationSec: number) => void;
  onStopRecording: () => void;
  recordedVideoUrl: string | null;
  recordedFileSize: number | null; // in bytes
  recordedFileName: string;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  onClose,
  isRecording,
  recordingProgress,
  onStartRecording,
  onStopRecording,
  recordedVideoUrl,
  recordedFileSize,
  recordedFileName,
}) => {
  const [duration, setDuration] = useState<number>(8); // 8 seconds per 360-turn

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                360° 自動回転動画の作成・保存
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono border border-rose-500/30">
                  MP4
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                モデルを正確に360度自動回転させ、軽量な高画質動画を出力します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRecording}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* State 1: Recording in progress */}
          {isRecording ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* SVG Progress Circle */}
                <svg className="w-24 h-24 -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#1e293b"
                    strokeWidth="6"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#f43f5e"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - recordingProgress / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-100"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <RotateCw className="w-6 h-6 text-rose-400 animate-spin" />
                  <span className="text-xs font-mono font-bold text-white mt-1">
                    {Math.round(recordingProgress)}%
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                  360° ターンテーブル動画を収録中...
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  1回転（360度）完了すると自動で高画質MP4に変換されます
                </p>
              </div>

              <button
                onClick={onStopRecording}
                className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 rounded-xl transition-colors cursor-pointer"
              >
                途中で録画を終了して保存
              </button>
            </div>
          ) : recordedVideoUrl ? (
            /* State 2: Finished Recording, Preview & Download */
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video flex items-center justify-center shadow-inner">
                <video
                  src={recordedVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Stats & info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>360°回転動画の生成が完了しました</span>
                </div>
                {recordedFileSize && (
                  <div className="font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                    {formatFileSize(recordedFileSize)}
                  </div>
                )}
              </div>

              {/* Download actions */}
              <div className="flex gap-2.5 pt-1">
                <a
                  href={recordedVideoUrl}
                  download={recordedFileName}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>動画を保存 (MP4)</span>
                </a>
                <button
                  onClick={() => onStartRecording(duration)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>再撮影</span>
                </button>
              </div>
            </div>
          ) : (
            /* State 3: Setup before recording */
            <div className="space-y-4">
              {/* Format Comparison banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-950/40 to-blue-950/30 border border-sky-800/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                  <Zap className="w-4 h-4 text-sky-400" />
                  <span>軽量＆高画質フォーマット (MP4)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  同じ360度動画をGIFで出力すると<strong className="text-rose-300">30MB〜50MB</strong>と巨大になりますが、
                  本アプリの最新MP4動画コーデック（H.264）なら<strong className="text-emerald-300 font-bold">約1〜2MB（約90%軽量）</strong>の極小容量で、スマートフォンやSNS・スライド資料へも手軽に添付・再生できます。
                </p>
              </div>

              {/* Rotation Duration selector */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>1回転 (360°) の回転時間</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { sec: 5, label: '5秒 (高速)', desc: 'SNSやプレビュー用' },
                    { sec: 8, label: '8秒 (標準)', desc: 'バランスの良い見やすさ' },
                    { sec: 12, label: '12秒 (じっくり)', desc: '細部まで確認できる' },
                  ].map((item) => (
                    <button
                      key={item.sec}
                      onClick={() => setDuration(item.sec)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        duration === item.sec
                          ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow-md shadow-sky-500/10'
                          : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start recording button */}
              <button
                onClick={() => onStartRecording(duration)}
                className="w-full py-3 px-4 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>360° 回転動画の収録を開始 ({duration}秒)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
