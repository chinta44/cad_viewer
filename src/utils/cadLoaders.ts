import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as fflate from 'fflate';
import { computeGeometryVolume } from './cadMath';

// Setup DRACO Loader
let dracoLoaderInstance: DRACOLoader | null = null;
export function getDracoLoader(): DRACOLoader {
  if (!dracoLoaderInstance) {
    dracoLoaderInstance = new DRACOLoader();
    dracoLoaderInstance.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoaderInstance.setDecoderConfig({ type: 'js' });
  }
  return dracoLoaderInstance;
}

export function createConfiguredGLTFLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());
  
  const w = window as unknown as { MeshoptDecoder?: unknown };
  if (w.MeshoptDecoder) {
    loader.setMeshoptDecoder(w.MeshoptDecoder as any);
  }
  
  return loader;
}

export interface RawPartData {
  name: string;
  geometry: THREE.BufferGeometry;
  color?: THREE.Color;
  material?: THREE.Material;
}

let occtInstance: any = null;
async function getOcct(): Promise<any> {
  if (occtInstance) return occtInstance;
  const w = window as any;
  if (typeof w.occtimportjs === 'function') {
    occtInstance = await w.occtimportjs();
    return occtInstance;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/occt-import-js.min.js';
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
  if (typeof w.occtimportjs === 'function') {
    occtInstance = await w.occtimportjs();
    return occtInstance;
  }
  throw new Error('OpenCASCADE STEP parser could not be initialized.');
}

export async function loadGLBFile(file: File): Promise<RawPartData[]> {
  const loader = createConfiguredGLTFLoader();
  const url = URL.createObjectURL(file);

  try {
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(
        url,
        (data) => resolve(data),
        undefined,
        (err) => reject(err)
      );
    });

    return extractPartsFromGLTF(gltf, file.name);
  } catch (err: any) {
    console.warn('GLTFLoader URL load failed, falling back to ArrayBuffer parse:', err);
    try {
      const buffer = await file.arrayBuffer();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.parse(
          buffer,
          '',
          (data) => resolve(data),
          (parseErr) => reject(parseErr)
        );
      });
      return extractPartsFromGLTF(gltf, file.name);
    } catch (fallbackErr: any) {
      const msg = fallbackErr?.message || err?.message || 'GLBファイルの読み込みに失敗しました';
      throw new Error(`GLBパースエラー: ${msg}`);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function extractPartsFromGLTF(gltf: any, sourceName: string): RawPartData[] {
  const parts: RawPartData[] = [];
  const scene = gltf.scene || gltf.scenes?.[0];
  if (!scene) throw new Error('GLBファイル内に有効なシーングラフが見つかりませんでした');

  scene.updateMatrixWorld(true);

  let meshIndex = 0;
  scene.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      if (!mesh.geometry) return;

      mesh.updateWorldMatrix(true, false);
      const clonedGeo = mesh.geometry.clone();
      clonedGeo.applyMatrix4(mesh.matrixWorld);

      if (!clonedGeo.attributes.normal) {
        clonedGeo.computeVertexNormals();
      }

      let partColor: THREE.Color | undefined;
      const mat = mesh.material;
      if (mat) {
        if (Array.isArray(mat)) {
          const firstMat = mat[0] as any;
          if (firstMat?.color) partColor = firstMat.color.clone();
        } else {
          const singleMat = mat as any;
          if (singleMat?.color) partColor = singleMat.color.clone();
        }
      }

      const partName = mesh.name || node.name || `Mesh_${meshIndex + 1}`;
      parts.push({
        name: `${sourceName} - ${partName}`,
        geometry: clonedGeo,
        color: partColor,
        material: Array.isArray(mat) ? mat[0]?.clone() : mat?.clone(),
      });
      meshIndex++;
    }
  });

  if (parts.length === 0) {
    throw new Error('GLBファイル内にメッシュジオメトリが見つかりませんでした');
  }

  return parts;
}

export async function loadSTEPFile(file: File): Promise<RawPartData[]> {
  const occt = await getOcct();
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const result = occt.ReadStepFile(uint8, null);

  if (!result || !result.meshes || result.meshes.length === 0) {
    throw new Error('STEPファイルからメッシュを抽出できませんでした');
  }

  const parts: RawPartData[] = [];
  result.meshes.forEach((md: any, i: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(md.attributes.position.array, 3));
    if (md.attributes.normal) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(md.attributes.normal.array, 3));
    }
    if (md.index) {
      geo.setIndex(new THREE.Uint32BufferAttribute(md.index.array, 1));
    }
    geo.computeVertexNormals();

    const hue = (i * 137.5) % 360;
    const col = new THREE.Color().setHSL(hue / 360, 0.65, 0.55);
    const label = result.meshes.length > 1 ? `${file.name} - Part_${i + 1}` : file.name;

    parts.push({
      name: label,
      geometry: geo,
      color: col,
    });
  });

  return parts;
}

export async function loadSTLFile(file: File): Promise<RawPartData[]> {
  const buffer = await file.arrayBuffer();
  const loader = new STLLoader();
  const geo = loader.parse(buffer);
  geo.computeVertexNormals();

  return [
    {
      name: file.name,
      geometry: geo,
      color: new THREE.Color('#38bdf8'),
    },
  ];
}

export async function loadOBJFile(file: File): Promise<RawPartData[]> {
  const text = await file.text();
  const lines = text.split(/\r\n|\r|\n/);
  const positions: number[] = [];
  const partsList: { name: string | null; verts: number[] }[] = [];
  let curName: string | null = null;
  let curFaces: number[] = [];

  function flushPart() {
    if (curFaces.length) {
      partsList.push({ name: curName, verts: curFaces });
    }
    curFaces = [];
  }

  function getVertex(idxStr: string): number {
    let idx = parseInt(idxStr, 10);
    if (idx < 0) idx = positions.length / 3 + idx + 1;
    return idx - 1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line[0] === '#') continue;

    if (line.startsWith('v ')) {
      const p = line.slice(2).trim().split(/\s+/).map(parseFloat);
      positions.push(p[0], p[1], p[2]);
    } else if (line.startsWith('o ') || line.startsWith('g ')) {
      flushPart();
      curName = line.slice(2).trim() || null;
    } else if (line.startsWith('f ')) {
      const toks = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((t) => t.split('/')[0])
        .map(getVertex);
      for (let j = 1; j < toks.length - 1; j++) {
        curFaces.push(toks[0], toks[j], toks[j + 1]);
      }
    }
  }
  flushPart();

  if (!partsList.length) {
    throw new Error('OBJファイルに有効な面（f）データが見つかりませんでした');
  }

  const results: RawPartData[] = [];
  partsList.forEach((part, i) => {
    const arr = new Float32Array(part.verts.length * 3);
    part.verts.forEach((vIdx, j) => {
      arr[j * 3] = positions[vIdx * 3];
      arr[j * 3 + 1] = positions[vIdx * 3 + 1];
      arr[j * 3 + 2] = positions[vIdx * 3 + 2];
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals();

    const hue = (i * 137.5) % 360;
    const col = new THREE.Color().setHSL(hue / 360, 0.65, 0.55);
    const label = partsList.length > 1 ? `${file.name} - ${part.name || `Part_${i + 1}`}` : file.name;

    results.push({
      name: label,
      geometry: geo,
      color: col,
    });
  });

  return results;
}

export async function load3MFFile(file: File): Promise<RawPartData[]> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const zipFiles = fflate.unzipSync(uint8);

  const fileMap = new Map<string, Uint8Array>();
  Object.keys(zipFiles).forEach((k) => {
    const key = k.replace(/^\//, '');
    fileMap.set(key, zipFiles[k]);
    fileMap.set(key.toLowerCase(), zipFiles[k]);
  });

  function getFile(path: string): Uint8Array | null {
    const key = path.replace(/^\//, '');
    return fileMap.get(key) || fileMap.get(key.toLowerCase()) || null;
  }
  function getText(path: string): string | null {
    const bytes = getFile(path);
    return bytes ? new TextDecoder().decode(bytes) : null;
  }

  const mainXml = getText('3D/3dmodel.model');
  if (!mainXml) throw new Error('3MFアーカイブ内に 3D/3dmodel.model が見つかりません');

  let filamentColors: string[] = [];
  try {
    const projJson = getText('Metadata/project_settings.config');
    if (projJson) {
      const proj = JSON.parse(projJson);
      if (Array.isArray(proj.filament_colour)) filamentColors = proj.filament_colour;
    }
  } catch {
    // ignore
  }

  const objExtruder = new Map<string, number>();
  const partExtruder = new Map<string, number>();
  try {
    const msXml = getText('Metadata/model_settings.config');
    if (msXml) {
      const objBlocks = [...msXml.matchAll(/<object\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/object>/gi)];
      for (const [, oid, content] of objBlocks) {
        const topPart = content.split(/<part\b/)[0];
        const topEx = topPart.match(/key="extruder"\s+value="(\d+)"/);
        if (topEx) objExtruder.set(oid, parseInt(topEx[1], 10));
        const partBlocks = [...content.matchAll(/<part\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/part>/gi)];
        for (const [, pid, pcontent] of partBlocks) {
          const pEx = pcontent.match(/key="extruder"\s+value="(\d+)"/);
          if (pEx) partExtruder.set(pid, parseInt(pEx[1], 10));
        }
      }
    }
  } catch {
    // ignore
  }

  function hexToColor(hex?: string | null): THREE.Color | null {
    if (!hex) return null;
    const clean = hex.slice(0, 7);
    try {
      return new THREE.Color(clean);
    } catch {
      return null;
    }
  }

  function colorFromExtruder(n?: number): THREE.Color | null {
    if (!n || !filamentColors[n - 1]) return null;
    return hexToColor(filamentColors[n - 1]);
  }

  const materialGroups = new Map<string, (THREE.Color | null)[]>();
  const rawBaseMatBlocks = [...mainXml.matchAll(/<basematerials\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/basematerials>/gi)];
  for (const [, pid, content] of rawBaseMatBlocks) {
    const bases = [...content.matchAll(/<base\s([^>]*)\/>/gi)].map((m) => getAttr(m[1], 'displaycolor'));
    materialGroups.set(pid, bases.map(hexToColor));
  }

  function colorFromMaterial(pid?: string | null, pindex?: string | null): THREE.Color | null {
    if (!pid || !pindex) return null;
    const group = materialGroups.get(pid);
    if (!group) return null;
    return group[parseInt(pindex, 10)] || null;
  }

  function getAttr(tag: string, name: string): string | null {
    const re = new RegExp(`(?:^|\\s)(?:[\\w]+:)?${name}="([^"]*)"`, 'i');
    const m = tag.match(re);
    return m ? m[1] : null;
  }
  function findTags(xml: string, tagName: string): string[] {
    const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'gi');
    return [...xml.matchAll(re)].map((m) => m[0]);
  }
  function getInner(xml: string, tagName: string): string {
    const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const m = xml.match(re);
    return m ? m[1] : '';
  }

  const buildSection = getInner(mainXml, 'build');
  const itemTags = findTags(buildSection, 'item');
  const resourcesSection = getInner(mainXml, 'resources');
  const objectBlocks = [...resourcesSection.matchAll(/<object\s([^>]*)>([\s\S]*?)<\/object>/gi)];

  const mainObjMap = new Map<string, { attrs: string; content: string }>();
  objectBlocks.forEach((m) => {
    const id = getAttr(m[1], 'id');
    if (id) mainObjMap.set(id, { attrs: m[1], content: m[2] });
  });

  const extCache = new Map<string, string | null>();
  function getExtXml(path: string): string | null {
    const key = path.replace(/^\//, '');
    if (extCache.has(key)) return extCache.get(key) || null;
    const xml = getText(key);
    extCache.set(key, xml);
    return xml;
  }

  function parseTf(str?: string | null): THREE.Matrix4 | null {
    if (!str) return null;
    const m = str
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat)
      .filter((n) => !isNaN(n));
    if (m.length < 12) return null;
    const mat = new THREE.Matrix4();
    mat.set(m[0], m[3], m[6], m[9], m[1], m[4], m[7], m[10], m[2], m[5], m[8], m[11], 0, 0, 0, 1);
    return mat;
  }
  function composeTf(parentStr?: string | null, childStr?: string | null): THREE.Matrix4 | null {
    const mp = parseTf(parentStr);
    const mc = parseTf(childStr);
    if (mp && mc) return mp.multiply(mc);
    return mp || mc || null;
  }

  const rawParts: RawPartData[] = [];

  function buildMesh(xml: string, tfMat: THREE.Matrix4 | null, color: THREE.Color, name: string) {
    const vertSection = getInner(xml, 'vertices');
    const vertTags = [...vertSection.matchAll(/<vertex\s([^>]*)\/>/gi)];
    if (!vertTags.length) return;

    const triSection = getInner(xml, 'triangles');
    const triTags = [...triSection.matchAll(/<triangle\s([^>]*)\/>/gi)];
    if (!triTags.length) return;

    const positions = new Float32Array(vertTags.length * 3);
    vertTags.forEach((m, i) => {
      positions[i * 3] = parseFloat(getAttr(m[1], 'x') || '0');
      positions[i * 3 + 1] = parseFloat(getAttr(m[1], 'y') || '0');
      positions[i * 3 + 2] = parseFloat(getAttr(m[1], 'z') || '0');
    });
    const indices = new Uint32Array(triTags.length * 3);
    triTags.forEach((m, i) => {
      indices[i * 3] = parseInt(getAttr(m[1], 'v1') || '0', 10);
      indices[i * 3 + 1] = parseInt(getAttr(m[1], 'v2') || '0', 10);
      indices[i * 3 + 2] = parseInt(getAttr(m[1], 'v3') || '0', 10);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(new THREE.Uint32BufferAttribute(indices, 1));
    if (tfMat) geo.applyMatrix4(tfMat);
    geo.computeVertexNormals();

    rawParts.push({
      name,
      geometry: geo,
      color,
    });
  }

  let partIndex = 0;
  for (const itemTag of itemTags) {
    const oid = getAttr(itemTag, 'objectid');
    if (!oid) continue;
    const buildTfStr = getAttr(itemTag, 'transform');
    const obj = mainObjMap.get(oid);
    if (!obj) continue;

    const name = `${file.name} - ${getAttr(obj.attrs, 'name') || `Part_${partIndex + 1}`}`;
    const rainbowColor = new THREE.Color().setHSL(((partIndex * 137.5) % 360) / 360, 0.65, 0.55);
    const objMatColor = colorFromMaterial(getAttr(obj.attrs, 'pid'), getAttr(obj.attrs, 'pindex'));

    const compMatches = [...obj.content.matchAll(/<component\s([^>]*)\/>/gi)];
    if (compMatches.length > 0) {
      for (const cm of compMatches) {
        const extPath = getAttr(cm[1], 'path');
        const refId = getAttr(cm[1], 'objectid');
        if (!refId) continue;
        const compTfStr = getAttr(cm[1], 'transform');
        const combinedTf = composeTf(buildTfStr, compTfStr);

        const color =
          objMatColor ||
          colorFromExtruder(partExtruder.get(refId)) ||
          colorFromExtruder(objExtruder.get(oid)) ||
          rainbowColor;

        if (extPath) {
          const extXml = getExtXml(extPath);
          if (!extXml) continue;
          const extObjMatch = extXml.match(new RegExp(`<object[^>]*\\bid="${refId}"[^>]*>([\\s\\S]*?)</object>`, 'i'));
          if (extObjMatch) buildMesh(extObjMatch[1], combinedTf, color, name);
        } else {
          const refObj = mainObjMap.get(refId);
          if (refObj) buildMesh(refObj.content, combinedTf, color, name);
        }
      }
    } else {
      const color = objMatColor || colorFromExtruder(objExtruder.get(oid)) || rainbowColor;
      buildMesh(obj.content, parseTf(buildTfStr), color, name);
    }
    partIndex++;
  }

  if (partIndex === 0) {
    mainObjMap.forEach((obj, oid) => {
      if (/type="support"/i.test(obj.attrs)) return;
      const rainbowColor = new THREE.Color().setHSL(((partIndex * 137.5) % 360) / 360, 0.65, 0.55);
      const objMatColor = colorFromMaterial(getAttr(obj.attrs, 'pid'), getAttr(obj.attrs, 'pindex'));
      const color = objMatColor || colorFromExtruder(objExtruder.get(oid)) || rainbowColor;
      buildMesh(obj.content, null, color, `${file.name} - Part_${partIndex + 1}`);
      partIndex++;
    });
  }

  if (rawParts.length === 0) throw new Error('3MFからジオメトリを生成できませんでした');
  return rawParts;
}

export async function loadZIPFile(file: File): Promise<RawPartData[]> {
  const buffer = await file.arrayBuffer();
  const zipFiles = fflate.unzipSync(new Uint8Array(buffer));
  const entries = Object.keys(zipFiles)
    .filter((name) => {
      if (name.endsWith('/')) return false;
      const n = name.toLowerCase();
      return (
        n.endsWith('.glb') ||
        n.endsWith('.gltf') ||
        n.endsWith('.step') ||
        n.endsWith('.stp') ||
        n.endsWith('.stl') ||
        n.endsWith('.3mf') ||
        n.endsWith('.obj')
      );
    })
    .sort();

  if (entries.length === 0) {
    throw new Error('ZIP内にサポートされているCADファイル（GLB, STEP, STL, 3MF, OBJ）が見つかりません');
  }

  const allParts: RawPartData[] = [];
  for (const entryName of entries) {
    const rawBytes = zipFiles[entryName];
    const subFile = new File([rawBytes], entryName.split('/').pop() || entryName);
    const subExt = subFile.name.toLowerCase();

    try {
      if (subExt.endsWith('.glb') || subExt.endsWith('.gltf')) {
        const parts = await loadGLBFile(subFile);
        allParts.push(...parts);
      } else if (subExt.endsWith('.step') || subExt.endsWith('.stp')) {
        const parts = await loadSTEPFile(subFile);
        allParts.push(...parts);
      } else if (subExt.endsWith('.stl')) {
        const parts = await loadSTLFile(subFile);
        allParts.push(...parts);
      } else if (subExt.endsWith('.3mf')) {
        const parts = await load3MFFile(subFile);
        allParts.push(...parts);
      } else if (subExt.endsWith('.obj')) {
        const parts = await loadOBJFile(subFile);
        allParts.push(...parts);
      }
    } catch (e) {
      console.warn(`Failed to parse file inside ZIP: ${entryName}`, e);
    }
  }

  if (allParts.length === 0) {
    throw new Error('ZIP内の全ファイルの読み込みに失敗しました');
  }

  return allParts;
}

export async function parseCADFile(file: File): Promise<{ parts: RawPartData[]; format: string }> {
  const ext = file.name.toLowerCase();

  if (ext.endsWith('.glb') || ext.endsWith('.gltf')) {
    return { parts: await loadGLBFile(file), format: 'GLB / glTF' };
  }
  if (ext.endsWith('.step') || ext.endsWith('.stp')) {
    return { parts: await loadSTEPFile(file), format: 'STEP (ISO 10303)' };
  }
  if (ext.endsWith('.stl')) {
    return { parts: await loadSTLFile(file), format: 'STL Mesh' };
  }
  if (ext.endsWith('.3mf')) {
    return { parts: await load3MFFile(file), format: '3MF 3D Manufacturing' };
  }
  if (ext.endsWith('.obj')) {
    return { parts: await loadOBJFile(file), format: 'Wavefront OBJ' };
  }
  if (ext.endsWith('.zip')) {
    return { parts: await loadZIPFile(file), format: 'ZIP CAD Archive' };
  }

  throw new Error('対応していないファイル形式です (.glb, .step, .stp, .stl, .3mf, .obj, .zip)');
}

export function generateSampleModel(type: 'gear' | 'bearing' | 'bracket'): RawPartData[] {
  if (type === 'gear') {
    const outerRadius = 40;
    const innerRadius = 32;
    const hubRadius = 14;
    const teeth = 18;
    const depth = 15;

    const shape = new THREE.Shape();
    const totalSteps = teeth * 4;
    for (let i = 0; i <= totalSteps; i++) {
      const angle = (i / totalSteps) * Math.PI * 2;
      const stepInTooth = i % 4;
      let r = innerRadius;
      if (stepInTooth === 1 || stepInTooth === 2) {
        r = outerRadius;
      }
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }

    const holePath = new THREE.Path();
    holePath.absarc(0, 0, hubRadius, 0, Math.PI * 2, true);
    shape.holes.push(holePath);

    const gearGeo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 1.2,
      bevelThickness: 1.2,
    });
    gearGeo.center();
    gearGeo.computeVertexNormals();

    const shaftGeo = new THREE.CylinderGeometry(hubRadius - 0.5, hubRadius - 0.5, depth * 2.5, 32);
    shaftGeo.rotateX(Math.PI / 2);
    shaftGeo.computeVertexNormals();

    return [
      {
        name: '平歯車 (Spur Gear)',
        geometry: gearGeo,
        color: new THREE.Color('#38bdf8'),
      },
      {
        name: '駆動シャフト (Drive Shaft)',
        geometry: shaftGeo,
        color: new THREE.Color('#f59e0b'),
      },
    ];
  }

  if (type === 'bearing') {
    const parts: RawPartData[] = [];

    const outerRingShape = new THREE.Shape();
    outerRingShape.absarc(0, 0, 45, 0, Math.PI * 2, false);
    const outerHole = new THREE.Path();
    outerHole.absarc(0, 0, 36, 0, Math.PI * 2, true);
    outerRingShape.holes.push(outerHole);
    const outerRingGeo = new THREE.ExtrudeGeometry(outerRingShape, { depth: 16, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8 });
    outerRingGeo.center();
    outerRingGeo.computeVertexNormals();
    parts.push({
      name: 'アウターレース (Outer Race)',
      geometry: outerRingGeo,
      color: new THREE.Color('#94a3b8'),
    });

    const innerRingShape = new THREE.Shape();
    innerRingShape.absarc(0, 0, 24, 0, Math.PI * 2, false);
    const innerHole = new THREE.Path();
    innerHole.absarc(0, 0, 15, 0, Math.PI * 2, true);
    innerRingShape.holes.push(innerHole);
    const innerRingGeo = new THREE.ExtrudeGeometry(innerRingShape, { depth: 16, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8 });
    innerRingGeo.center();
    innerRingGeo.computeVertexNormals();
    parts.push({
      name: 'インナーレース (Inner Race)',
      geometry: innerRingGeo,
      color: new THREE.Color('#cbd5e1'),
    });

    const ballRadius = 5.5;
    const orbitRadius = 30;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const ballGeo = new THREE.SphereGeometry(ballRadius, 24, 24);
      ballGeo.translate(Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius, 0);
      ballGeo.computeVertexNormals();
      parts.push({
        name: `ボールベアリング #${i + 1}`,
        geometry: ballGeo,
        color: new THREE.Color('#f43f5e'),
      });
    }

    return parts;
  }

  const bracketShape = new THREE.Shape();
  bracketShape.moveTo(-30, -30);
  bracketShape.lineTo(30, -30);
  bracketShape.lineTo(30, -15);
  bracketShape.lineTo(-15, -15);
  bracketShape.lineTo(-15, 30);
  bracketShape.lineTo(-30, 30);
  bracketShape.closePath();

  const h1 = new THREE.Path();
  h1.absarc(15, -22.5, 4.5, 0, Math.PI * 2, true);
  bracketShape.holes.push(h1);
  const h2 = new THREE.Path();
  h2.absarc(-22.5, 15, 4.5, 0, Math.PI * 2, true);
  bracketShape.holes.push(h2);

  const bracketGeo = new THREE.ExtrudeGeometry(bracketShape, { depth: 40, bevelEnabled: true, bevelSize: 1, bevelThickness: 1 });
  bracketGeo.center();
  bracketGeo.computeVertexNormals();

  const ribGeo = new THREE.CylinderGeometry(3, 3, 50, 16);
  ribGeo.rotateZ(Math.PI / 4);
  ribGeo.computeVertexNormals();

  return [
    {
      name: 'L字マウントブラケット (L-Bracket)',
      geometry: bracketGeo,
      color: new THREE.Color('#10b981'),
    },
    {
      name: '補強ステー (Brace Pin)',
      geometry: ribGeo,
      color: new THREE.Color('#6366f1'),
    },
  ];
}
