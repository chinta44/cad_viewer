import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface OrientationGizmoProps {
  camera: THREE.Camera | null;
  onSetView: (axis: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') => void;
  isFullscreen?: boolean;
}

export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
  camera,
  onSetView,
  isFullscreen = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, 90, 90);
      const cx = 45;
      const cy = 45;
      const radius = 28;

      if (camera) {
        const q = camera.quaternion.clone().invert();

        const axes = [
          { dir: new THREE.Vector3(1, 0, 0), label: 'X', color: '#ef4444', view: 'right' as const },
          { dir: new THREE.Vector3(-1, 0, 0), label: '-X', color: '#7f1d1d', view: 'left' as const },
          { dir: new THREE.Vector3(0, 1, 0), label: 'Y', color: '#10b981', view: 'top' as const },
          { dir: new THREE.Vector3(0, -1, 0), label: '-Y', color: '#064e3b', view: 'bottom' as const },
          { dir: new THREE.Vector3(0, 0, 1), label: 'Z', color: '#3b82f6', view: 'front' as const },
          { dir: new THREE.Vector3(0, 0, -1), label: '-Z', color: '#1e3a8a', view: 'back' as const },
        ];

        const projected = axes
          .map((a) => {
            const v = a.dir.clone().applyQuaternion(q);
            return {
              ...a,
              px: cx + v.x * radius,
              py: cy - v.y * radius,
              pz: v.z,
            };
          })
          .sort((a, b) => a.pz - b.pz);

        // Center circle
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();

        // Lines and bubbles
        projected.forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(p.px, p.py);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.pz > 0 ? 2 : 1;
          ctx.globalAlpha = p.pz > 0 ? 0.9 : 0.3;
          ctx.stroke();

          const bubbleRadius = p.pz > 0 ? 7 : 5;
          ctx.beginPath();
          ctx.arc(p.px, p.py, bubbleRadius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();

          if (p.pz > 0 && !p.label.startsWith('-')) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.label, p.px, p.py);
          }
        });
        ctx.globalAlpha = 1.0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [camera]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 45;
    const y = e.clientY - rect.top - 45;

    if (Math.abs(x) > Math.abs(y)) {
      if (x > 15) onSetView('right');
      else if (x < -15) onSetView('left');
    } else {
      if (y < -15) onSetView('top');
      else if (y > 15) onSetView('bottom');
      else onSetView('front');
    }
  };

  return (
    <div
      className={`absolute z-20 flex flex-col items-center select-none pointer-events-auto transition-all duration-200 ${
        isFullscreen ? 'top-14 right-4' : 'top-16 right-4'
      }`}
    >
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-1 shadow-2xl hover:border-sky-500/50 transition-colors">
        <canvas
          ref={canvasRef}
          width={90}
          height={90}
          onClick={handleClick}
          title="クリックで視点を切り替え"
          className="cursor-pointer"
        />
      </div>
      <span className="text-[10px] text-slate-400 font-mono mt-1 drop-shadow">3D ギズモ</span>
    </div>
  );
};
