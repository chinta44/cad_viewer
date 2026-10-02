import * as THREE from 'three';

export type ViewMode = 'solid' | 'wire' | 'both' | 'ghost';
export type MaterialPreset = 'normal' | 'metal' | 'glass' | 'clay' | 'normalColors';
export type ClipAxis = 'off' | 'x' | 'y' | 'z';
export type CameraView = 'iso' | 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';
export type PivotMode = 'center' | 'origin' | 'custom';

export interface CADPart {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  wireMesh: THREE.LineSegments | THREE.Mesh;
  originalPosition: THREE.Vector3;
  color: THREE.Color;
  visible: boolean;
  triangleCount: number;
  vertexCount: number;
  volumeMm3: number;
  boundingBox: THREE.Box3;
  isCompare?: boolean;
}

export interface ModelMetadata {
  fileName: string;
  format: string;
  fileSize: number;
  partCount: number;
  totalTriangles: number;
  totalVertices: number;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  cadOriginOffset: {
    x: number;
    y: number;
    z: number;
  };
  totalVolumeCm3: number;
}

export interface MaterialDensity {
  id: string;
  name: string;
  density: number; // g/cm³
  category: 'plastic' | 'metal' | 'composite';
}

export const MATERIAL_DENSITIES: MaterialDensity[] = [
  { id: 'pla', name: 'PLA 樹脂', density: 1.24, category: 'plastic' },
  { id: 'petg', name: 'PETG 樹脂', density: 1.27, category: 'plastic' },
  { id: 'abs', name: 'ABS 樹脂', density: 1.04, category: 'plastic' },
  { id: 'nylon', name: 'ナイロン (PA)', density: 1.14, category: 'plastic' },
  { id: 'resin', name: 'UV硬化レジン', density: 1.15, category: 'plastic' },
  { id: 'aluminum', name: 'アルミニウム (6061)', density: 2.70, category: 'metal' },
  { id: 'steel', name: '炭素鋼 / SUS304', density: 7.93, category: 'metal' },
  { id: 'titanium', name: 'チタン合金 (Ti-6Al-4V)', density: 4.43, category: 'metal' },
  { id: 'brass', name: '真鍮 (C3604)', density: 8.50, category: 'metal' },
  { id: 'carbon', name: 'CFRP 炭素繊維', density: 1.55, category: 'composite' },
];

export interface MeasurePoint {
  worldPosition: THREE.Vector3;
  screenPosition: { x: number; y: number };
}

export interface MeasureResult {
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  distance: number;
  dx: number;
  dy: number;
  dz: number;
}
