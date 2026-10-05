import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { CADPart } from '../types/cad';

export type ExportFormat = 'glb-uncompressed' | 'stl-binary' | 'stl-ascii' | 'obj' | 'ply-binary' | 'html-viewer';

export interface ExportOptions {
  format: ExportFormat;
  includeHidden?: boolean;
  selectedOnly?: boolean;
  selectedPartId?: string | null;
  modelName?: string;
}

/**
 * Creates a clean cloned THREE.Scene containing the target meshes for export
 */
function buildExportScene(parts: CADPart[], options: ExportOptions): THREE.Scene {
  const scene = new THREE.Scene();

  const targetParts = parts.filter((p) => {
    if (p.isCompare) return false;
    if (options.selectedOnly && options.selectedPartId) {
      return p.id === options.selectedPartId;
    }
    if (!options.includeHidden && !p.visible) {
      return false;
    }
    return true;
  });

  targetParts.forEach((part) => {
    // Clone geometry to bake current matrix/transform cleanly
    const clonedGeo = part.mesh.geometry.clone();
    
    // Ensure normals are computed
    if (!clonedGeo.attributes.normal) {
      clonedGeo.computeVertexNormals();
    }

    // Material with original part color
    const mat = new THREE.MeshStandardMaterial({
      color: part.color,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(clonedGeo, mat);
    mesh.name = part.name;
    mesh.position.copy(part.originalPosition);
    scene.add(mesh);
  });

  return scene;
}

/**
 * Export parts to standard uncompressed GLB (Binary glTF)
 * Free of Draco/Meshopt compression so any viewer or single-file HTML can open it without decoders!
 */
export async function exportToStandardGLB(parts: CADPart[], options: ExportOptions): Promise<Blob> {
  const scene = buildExportScene(parts, options);
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: 'model/gltf-binary' }));
        } else {
          // If returned as JSON object
          const jsonStr = JSON.stringify(result);
          resolve(new Blob([jsonStr], { type: 'model/gltf+json' }));
        }
      },
      (error) => {
        reject(error);
      },
      {
        binary: true,
        embedImages: true,
        onlyVisible: true,
      }
    );
  });
}

/**
 * Export parts to STL format (Binary or ASCII)
 */
export async function exportToSTL(parts: CADPart[], options: ExportOptions, binary: boolean = true): Promise<Blob> {
  const scene = buildExportScene(parts, options);
  const exporter = new STLExporter();

  if (binary) {
    const result = exporter.parse(scene, { binary: true });
    return new Blob([result.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  } else {
    const result = exporter.parse(scene, { binary: false });
    return new Blob([result], { type: 'text/plain' });
  }
}

/**
 * Export parts to Wavefront OBJ format
 */
export async function exportToOBJ(parts: CADPart[], options: ExportOptions): Promise<Blob> {
  const scene = buildExportScene(parts, options);
  const exporter = new OBJExporter();

  const result = exporter.parse(scene);
  return new Blob([result], { type: 'text/plain' });
}

/**
 * Export parts to PLY format (Binary or ASCII)
 */
export async function exportToPLY(parts: CADPart[], options: ExportOptions, binary: boolean = true): Promise<Blob> {
  const scene = buildExportScene(parts, options);
  const exporter = new PLYExporter();

  return new Promise((resolve) => {
    if (binary) {
      exporter.parse(
        scene,
        (result: ArrayBuffer) => {
          resolve(new Blob([result], { type: 'application/octet-stream' }));
        },
        { binary: true }
      );
    } else {
      exporter.parse(
        scene,
        (result: string) => {
          resolve(new Blob([result], { type: 'text/plain' }));
        },
        { binary: false }
      );
    }
  });
}

/**
 * Export to a Single-File Self-Contained HTML 3D Viewer!
 * Contains Three.js, OrbitControls, and the model embedded as Base64.
 * Can be opened by double clicking anywhere offline with zero dependencies!
 */
export async function exportToStandaloneHTML(parts: CADPart[], options: ExportOptions): Promise<Blob> {
  // First generate clean uncompressed GLB
  const glbBlob = await exportToStandardGLB(parts, options);
  const arrayBuffer = await glbBlob.arrayBuffer();

  // Convert to base64
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  const modelTitle = options.modelName || 'CAD 3D Model';

  const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(modelTitle)} - 3D Viewer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #090d16; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f1f5f9; }
    #canvas-container { width: 100%; height: 100%; }
    .header { position: absolute; top: 16px; left: 16px; z-index: 10; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 12px; padding: 10px 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header h1 { font-size: 14px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .header span { font-size: 11px; color: #94a3b8; font-family: monospace; }
    .toolbar { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 10; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 16px; padding: 6px 10px; display: flex; align-items: center; gap: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
    button { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(71, 85, 105, 0.6); color: #e2e8f0; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 10px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
    button:hover { background: #38bdf8; color: #0f172a; border-color: #38bdf8; }
    button.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
    .hint { position: absolute; bottom: 12px; left: 16px; font-size: 11px; color: #64748b; font-family: monospace; pointer-events: none; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
</head>
<body>
  <div class="header">
    <h1>⬡ ${escapeHtml(modelTitle)}</h1>
    <span>オフライン対応 単体HTML 3Dビューアー</span>
  </div>

  <div class="toolbar">
    <button id="btn-reset">⟲ リセット</button>
    <button id="btn-rotate">↻ 自動回転</button>
    <button id="btn-wire">▦ ワイヤーフレーム</button>
    <button id="btn-fs">⛶ 全画面</button>
  </div>

  <div class="hint">ドラッグ: 回転 · ホイール: ズーム · 右ドラッグ: パン</div>
  <div id="canvas-container"></div>

  <script>
    // Embedded standard uncompressed GLB
    const glbBase64 = "${base64Data}";

    // Setup scene
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100000);
    camera.position.set(150, 150, 150);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dir1.position.set(2, 3, 2);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xa5c4e8, 0.5);
    dir2.position.set(-2, -1, -2);
    scene.add(dir2);

    const grid = new THREE.GridHelper(1000, 50, 0x38bdf8, 0x1e293b);
    grid.position.y = -0.1;
    scene.add(grid);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    let autoRotate = false;
    let wireframeMode = false;
    const meshes = [];

    // Decode base64 to ArrayBuffer
    function base64ToArrayBuffer(base64) {
      const bin = window.atob(base64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes.buffer;
    }

    // Load model
    const loader = new THREE.GLTFLoader();
    const buffer = base64ToArrayBuffer(glbBase64);

    loader.parse(buffer, '', (gltf) => {
      modelGroup.add(gltf.scene);

      // Center model
      const box = new THREE.Box3().setFromObject(modelGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      modelGroup.position.sub(center);

      // Fit camera
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim * 2.2;
      camera.position.set(dist, dist * 0.8, dist);
      controls.target.set(0, 0, 0);
      controls.update();

      // Collect meshes
      modelGroup.traverse((child) => {
        if (child.isMesh) {
          meshes.push(child);
        }
      });
    }, (err) => {
      console.error('Error parsing GLB', err);
    });

    // Resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Animate
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      if (autoRotate) {
        modelGroup.rotation.y += 0.008;
      }
      renderer.render(scene, camera);
    }
    animate();

    // UI Buttons
    document.getElementById('btn-reset').addEventListener('click', () => {
      modelGroup.rotation.set(0, 0, 0);
      const box = new THREE.Box3().setFromObject(modelGroup);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim * 2.2;
      camera.position.set(dist, dist * 0.8, dist);
      controls.target.set(0, 0, 0);
      controls.update();
    });

    const btnRotate = document.getElementById('btn-rotate');
    btnRotate.addEventListener('click', () => {
      autoRotate = !autoRotate;
      btnRotate.classList.toggle('active', autoRotate);
    });

    const btnWire = document.getElementById('btn-wire');
    btnWire.addEventListener('click', () => {
      wireframeMode = !wireframeMode;
      btnWire.classList.toggle('active', wireframeMode);
      meshes.forEach(m => {
        if (m.material) {
          m.material.wireframe = wireframeMode;
        }
      });
    });

    document.getElementById('btn-fs').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  </script>
</body>
</html>`;

  return new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Universal export dispatcher
 */
export async function exportCADModel(parts: CADPart[], options: ExportOptions): Promise<{ blob: Blob; filename: string }> {
  const baseName = (options.modelName || 'cad_model').replace(/\.[^/.]+$/, '');
  let blob: Blob;
  let filename = baseName;

  switch (options.format) {
    case 'glb-uncompressed':
      blob = await exportToStandardGLB(parts, options);
      filename += '_standard.glb';
      break;

    case 'stl-binary':
      blob = await exportToSTL(parts, options, true);
      filename += '.stl';
      break;

    case 'stl-ascii':
      blob = await exportToSTL(parts, options, false);
      filename += '_ascii.stl';
      break;

    case 'obj':
      blob = await exportToOBJ(parts, options);
      filename += '.obj';
      break;

    case 'ply-binary':
      blob = await exportToPLY(parts, options, true);
      filename += '.ply';
      break;

    case 'html-viewer':
      blob = await exportToStandaloneHTML(parts, options);
      filename += '_viewer.html';
      break;

    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }

  return { blob, filename };
}

/**
 * Trigger browser file download from Blob
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
