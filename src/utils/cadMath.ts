import * as THREE from 'three';

export function computeGeometryVolume(geometry: THREE.BufferGeometry): number {
  const positionAttr = geometry.getAttribute('position');
  if (!positionAttr) return 0;

  const index = geometry.getIndex();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  let volume = 0;

  if (index) {
    const count = index.count;
    for (let i = 0; i < count; i += 3) {
      const iA = index.getX(i);
      const iB = index.getX(i + 1);
      const iC = index.getX(i + 2);

      vA.fromBufferAttribute(positionAttr, iA);
      vB.fromBufferAttribute(positionAttr, iB);
      vC.fromBufferAttribute(positionAttr, iC);

      volume += vA.dot(vB.clone().cross(vC)) / 6.0;
    }
  } else {
    const count = positionAttr.count;
    for (let i = 0; i < count; i += 3) {
      vA.fromBufferAttribute(positionAttr, i);
      vB.fromBufferAttribute(positionAttr, i + 1);
      vC.fromBufferAttribute(positionAttr, i + 2);

      volume += vA.dot(vB.clone().cross(vC)) / 6.0;
    }
  }

  return Math.abs(volume);
}

export function formatMm(val: number): string {
  if (isNaN(val)) return '0.00';
  if (Math.abs(val) > 0 && Math.abs(val) < 0.05) {
    return val.toFixed(4);
  }
  if (Math.abs(val) > 0 && Math.abs(val) < 1.0) {
    return val.toFixed(3);
  }
  return val.toFixed(2);
}

export function formatGrams(grams: number): string {
  if (grams >= 1000) {
    return (grams / 1000).toFixed(2) + ' kg';
  }
  return grams.toFixed(1) + ' g';
}
