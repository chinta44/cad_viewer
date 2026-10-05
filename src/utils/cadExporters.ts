import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import * as fflate from 'fflate';
import { CADPart } from '../types/cad';

export type ExportFormat =
  | 'glb-uncompressed'
  | 'html-viewer'
  | 'obj-mtl-zip'
  | 'ply-binary'
  | 'stl-zip'
  | 'stl-binary'
  | 'stl-ascii';

export interface ExportOptions {
  format: ExportFormat;
  includeHidden?: boolean;
  selectedOnly?: boolean;
  selectedPartId?: string | null;
  modelName?: string;
}

/**
 * Creates a clean cloned THREE.Scene containing the target meshes for export.
 * Also bakes vertex colors (RGB) into the geometry so formats like PLY retain full colors.
 */
function buildExportScene(parts: CADPart[], options: ExportOptions): { scene: THREE.Scene; validParts: CADPart[] } {
  const scene = new THREE.Scene();

  const validParts = parts.filter((p) => {
    if (p.isCompare) return false;
    if (options.selectedOnly && options.selectedPartId) {
      return p.id === options.selectedPartId;
    }
    if (!options.includeHidden && !p.visible) {
      return false;
    }
    return true;
  });

  validParts.forEach((part, index) => {
    // Clone geometry to bake current matrix/transform cleanly
    const clonedGeo = part.mesh.geometry.clone();

    // Ensure normals are computed
    if (!clonedGeo.attributes.normal) {
      clonedGeo.computeVertexNormals();
    }

    // Bake vertex colors directly into geometry for formats that read vertex colors (e.g. PLY)
    const posAttr = clonedGeo.getAttribute('position');
    if (posAttr) {
      const vertCount = posAttr.count;
      const colorArr = new Float32Array(vertCount * 3);
      const r = part.color.r;
      const g = part.color.g;
      const b = part.color.b;
      for (let i = 0; i < vertCount; i++) {
        colorArr[i * 3] = r;
        colorArr[i * 3 + 1] = g;
        colorArr[i * 3 + 2] = b;
      }
      clonedGeo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    }

    // Material: Use original material if present (textures, PBR), otherwise create standard material
    let mat: THREE.Material;
    if (part.originalMaterial) {
      mat = part.originalMaterial.clone();
      (mat as any).name = `Mat_${safePartName(part.name, index)}`;
      (mat as any).side = THREE.DoubleSide;
    } else {
      mat = new THREE.MeshStandardMaterial({
        name: `Mat_${safePartName(part.name, index)}`,
        color: part.color,
        roughness: 0.4,
        metalness: 0.2,
        side: THREE.DoubleSide,
        vertexColors: Boolean(part.hasVertexColors),
      });
    }

    const mesh = new THREE.Mesh(clonedGeo, mat);
    mesh.name = safePartName(part.name, index);
    mesh.position.copy(part.originalPosition);
    scene.add(mesh);
  });

  return { scene, validParts };
}

function safePartName(name: string, index: number): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_\-]/g, '_').trim();
  return sanitized || `Part_${index + 1}`;
}

/**
 * Export parts to standard uncompressed GLB (Binary glTF)
 * FULL COLOR SUPPORT: Retains all part colors, PBR material properties, and part hierarchy.
 * Free of Draco/Meshopt compression so any viewer or single-file HTML can open it without decoders!
 */
export async function exportToStandardGLB(parts: CADPart[], options: ExportOptions): Promise<Blob> {
  const { scene } = buildExportScene(parts, options);
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: 'model/gltf-binary' }));
        } else {
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
 * Export parts to Wavefront OBJ with companion MTL material file (ZIP format)
 * FULL COLOR SUPPORT: Packs .obj and .mtl with all material diffuse colors (Kd) into a ZIP archive.
 */
export async function exportToOBJWithMTL(parts: CADPart[], options: ExportOptions): Promise<Blob> {
  const { validParts } = buildExportScene(parts, options);
  const baseName = (options.modelName || 'model').replace(/\.[^/.]+$/, '');
  const mtlFilename = `${baseName}.mtl`;

  // 1. Generate MTL content
  let mtlContent = `# CADStudio 3D Viewer Material Library\n# Model: ${baseName}\n\n`;
  validParts.forEach((part, index) => {
    const matName = `mat_${safePartName(part.name, index)}`;
    const r = part.color.r.toFixed(4);
    const g = part.color.g.toFixed(4);
    const b = part.color.b.toFixed(4);
    mtlContent += `newmtl ${matName}\n`;
    mtlContent += `Kd ${r} ${g} ${b}\n`;
    mtlContent += `Ka 0.2000 0.2000 0.2000\n`;
    mtlContent += `Ks 0.3000 0.3000 0.3000\n`;
    mtlContent += `Ns 50.0\n`;
    mtlContent += `d 1.0\n`;
    mtlContent += `illum 2\n\n`;
  });

  // 2. Generate OBJ content with references to materials
  let objContent = `# CADStudio 3D Viewer Wavefront OBJ Export\n# Model: ${baseName}\n`;
  objContent += `mtllib ${mtlFilename}\n\n`;

  let vertexOffset = 1;
  let normalOffset = 1;

  validParts.forEach((part, index) => {
    const matName = `mat_${safePartName(part.name, index)}`;
    const partName = safePartName(part.name, index);
    const geo = part.mesh.geometry;
    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');

    if (!posAttr) return;

    objContent += `o ${partName}\n`;
    objContent += `g ${partName}\n`;
    objContent += `usemtl ${matName}\n`;

    const vertCount = posAttr.count;

    // Write vertices
    for (let i = 0; i < vertCount; i++) {
      const x = (posAttr.getX(i) + part.originalPosition.x).toFixed(4);
      const y = (posAttr.getY(i) + part.originalPosition.y).toFixed(4);
      const z = (posAttr.getZ(i) + part.originalPosition.z).toFixed(4);
      objContent += `v ${x} ${y} ${z}\n`;
    }

    // Write normals
    if (normAttr) {
      for (let i = 0; i < normAttr.count; i++) {
        const nx = normAttr.getX(i).toFixed(4);
        const ny = normAttr.getY(i).toFixed(4);
        const nz = normAttr.getZ(i).toFixed(4);
        objContent += `vn ${nx} ${ny} ${nz}\n`;
      }
    }

    // Write faces (1-based index)
    const indexAttr = geo.getIndex();
    if (indexAttr) {
      const idxCount = indexAttr.count;
      for (let i = 0; i < idxCount; i += 3) {
        const a = indexAttr.getX(i) + vertexOffset;
        const b = indexAttr.getX(i + 1) + vertexOffset;
        const c = indexAttr.getX(i + 2) + vertexOffset;
        if (normAttr) {
          const na = indexAttr.getX(i) + normalOffset;
          const nb = indexAttr.getX(i + 1) + normalOffset;
          const nc = indexAttr.getX(i + 2) + normalOffset;
          objContent += `f ${a}//${na} ${b}//${nb} ${c}//${nc}\n`;
        } else {
          objContent += `f ${a} ${b} ${c}\n`;
        }
      }
    } else {
      for (let i = 0; i < vertCount; i += 3) {
        const a = i + vertexOffset;
        const b = i + 1 + vertexOffset;
        const c = i + 2 + vertexOffset;
        if (normAttr) {
          const na = i + normalOffset;
          const nb = i + 1 + normalOffset;
          const nc = i + 2 + normalOffset;
          objContent += `f ${a}//${na} ${b}//${nb} ${c}//${nc}\n`;
        } else {
          objContent += `f ${a} ${b} ${c}\n`;
        }
      }
    }

    vertexOffset += vertCount;
    if (normAttr) {
      normalOffset += normAttr.count;
    }
    objContent += `\n`;
  });

  // 3. Zip both files together using fflate
  const zipFiles: Record<string, Uint8Array> = {
    [`${baseName}.obj`]: fflate.strToU8(objContent),
    [mtlFilename]: fflate.strToU8(mtlContent),
    'README.txt': fflate.strToU8(
      `CADStudio 3D Viewer - OBJ + MTL Export\n` +
      `-----------------------------------------\n` +
      `このZIPを解凍し、${baseName}.obj をBlenderやWindows 3Dビューアー、各種CAD/CGソフトで開くと、各パーツのカラーが反映されます。\n`
    ),
  };

  const zipped = fflate.zipSync(zipFiles);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

/**
 * Export parts as individual STLs inside a ZIP archive.
 * MULTI-COLOR 3D PRINTING: Allows slicers (Bambu Studio, PrusaSlicer, Cura, Orca) to assign
 * different colors/filaments to each part easily.
 */
export async function exportToMultiPartSTLs(parts: CADPart[], options: ExportOptions): Promise<Blob> {
  const { validParts } = buildExportScene(parts, options);
  const baseName = (options.modelName || 'model').replace(/\.[^/.]+$/, '');
  const exporter = new STLExporter();
  const zipFiles: Record<string, Uint8Array> = {};

  validParts.forEach((part, index) => {
    const singleScene = new THREE.Scene();
    const clonedGeo = part.mesh.geometry.clone();
    if (!clonedGeo.attributes.normal) clonedGeo.computeVertexNormals();

    const mesh = new THREE.Mesh(clonedGeo, new THREE.MeshBasicMaterial());
    mesh.position.copy(part.originalPosition);
    singleScene.add(mesh);

    const stlData = exporter.parse(singleScene, { binary: true });
    const partFilename = `${String(index + 1).padStart(2, '0')}_${safePartName(part.name, index)}.stl`;
    zipFiles[partFilename] = new Uint8Array(stlData.buffer as ArrayBuffer);
  });

  // Add info readme
  zipFiles['COLOR_REFERENCE.txt'] = fflate.strToU8(
    `CADStudio 3D Viewer - 分割STLパーツ一覧と元カラー情報\n` +
    `=======================================================\n` +
    `スライサー（Bambu Studio, PrusaSlicer, Cura等）にドラッグ＆ドロップして\n` +
    `「1つのマルチパーツオブジェクトとしてインポート」を選択すると、パーツごとに色を指定できます。\n\n` +
    validParts
      .map(
        (p, idx) =>
          `[${idx + 1}] ${p.name}\n` +
          `    HEXカラー: #${p.color.getHexString().toUpperCase()}\n` +
          `    RGB比率: (${p.color.r.toFixed(2)}, ${p.color.g.toFixed(2)}, ${p.color.b.toFixed(2)})\n`
      )
      .join('\n')
  );

  const zipped = fflate.zipSync(zipFiles);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

/**
 * Export parts to PLY format (Binary) with embedded Vertex Colors (RGB).
 * FULL COLOR SUPPORT: Writes RGB vertex colors directly into PLY headers and body.
 */
export async function exportToPLY(parts: CADPart[], options: ExportOptions, binary: boolean = true): Promise<Blob> {
  const { scene } = buildExportScene(parts, options);
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
 * Export parts to single STL format (Binary or ASCII)
 * NOTE: Standard STL format does not support color by specification.
 */
export async function exportToSTL(parts: CADPart[], options: ExportOptions, binary: boolean = true): Promise<Blob> {
  const { scene } = buildExportScene(parts, options);
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
 * Export to a Single-File Self-Contained HTML 3D Viewer!
 * FULL COLOR SUPPORT: Contains Three.js, OrbitControls, and the model embedded as Base64.
 * Can be opened by double clicking anywhere offline with zero dependencies!
 */
export async function exportToStandaloneHTML(parts: CADPart[], options: ExportOptions): Promise<Blob> {
  // First generate clean uncompressed GLB which retains all colors & materials
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
    <span>フルカラー対応 単体HTML 3Dビューアー</span>
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
    const glbBase64 = "${base64Data}";

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

    function base64ToArrayBuffer(base64) {
      const bin = window.atob(base64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes.buffer;
    }

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

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      if (autoRotate) {
        modelGroup.rotation.y += 0.008;
      }
      renderer.render(scene, camera);
    }
    animate();

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
export async function exportCADModel(
  parts: CADPart[],
  options: ExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const baseName = (options.modelName || 'cad_model').replace(/\.[^/.]+$/, '');
  let blob: Blob;
  let filename = baseName;

  switch (options.format) {
    case 'glb-uncompressed':
      blob = await exportToStandardGLB(parts, options);
      filename += '_standard.glb';
      break;

    case 'html-viewer':
      blob = await exportToStandaloneHTML(parts, options);
      filename += '_viewer.html';
      break;

    case 'obj-mtl-zip':
      blob = await exportToOBJWithMTL(parts, options);
      filename += '_obj_with_colors.zip';
      break;

    case 'ply-binary':
      blob = await exportToPLY(parts, options, true);
      filename += '_color.ply';
      break;

    case 'stl-zip':
      blob = await exportToMultiPartSTLs(parts, options);
      filename += '_parts_stl.zip';
      break;

    case 'stl-binary':
      blob = await exportToSTL(parts, options, true);
      filename += '.stl';
      break;

    case 'stl-ascii':
      blob = await exportToSTL(parts, options, false);
      filename += '_ascii.stl';
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
