/* 依赖由 index.html 先行引入的 lib/three.min.js（UMD 全局 THREE）提供 */

/* ============================ 工具 ============================ */
const $ = (sel) => document.querySelector(sel);
const deg2rad = (d) => THREE.MathUtils.degToRad(d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ============================ 调色板 ============================ */
const PALETTE = [
  '#4f8cff', '#ff6b6b', '#34c38f', '#f5b942',
  '#9b6bff', '#ff8fb1', '#42d4f4', '#ffd166',
  '#7bed9f', '#ff7a45',
].map((c) => new THREE.Color(c));

/* ============================ 预设定义 ============================ */
// sideToRadius: 正多边形底面边长 -> 外接圆半径
const sideToRadius = (s, n) => s / (2 * Math.sin(Math.PI / n));

const PRESETS = [
  { id: 'cube', name: '正方体', type: 'cube', metrics: 'cube',
    params: [{ key: 'a', label: '棱长', min: 0.5, max: 5, step: 0.1, v: 2 }] },
  { id: 'cuboid', name: '长方体', type: 'cuboid', metrics: 'cuboid',
    params: [
      { key: 'a', label: '长(X)', min: 0.5, max: 6, step: 0.1, v: 3 },
      { key: 'b', label: '宽(Z)', min: 0.5, max: 6, step: 0.1, v: 2 },
      { key: 'c', label: '高(Y)', min: 0.5, max: 6, step: 0.1, v: 1.6 },
    ] },
  { id: 'prism3', name: '三棱柱', type: 'prism', metrics: 'prism',
    params: [
      { key: 'n', hidden: true, v: 3 },
      { key: 's', label: '底边长', min: 0.5, max: 5, step: 0.1, v: 2 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2 },
    ] },
  { id: 'prism4', name: '四棱柱', type: 'prism', metrics: 'prism',
    params: [
      { key: 'n', hidden: true, v: 4 },
      { key: 's', label: '底边长', min: 0.5, max: 5, step: 0.1, v: 2 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2 },
    ] },
  { id: 'prism6', name: '六棱柱', type: 'prism', metrics: 'prism',
    params: [
      { key: 'n', hidden: true, v: 6 },
      { key: 's', label: '底边长', min: 0.5, max: 5, step: 0.1, v: 1.6 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2.4 },
    ] },
  { id: 'pyramid3', name: '三棱锥', type: 'pyramid', metrics: 'pyramid',
    params: [
      { key: 'n', hidden: true, v: 3 },
      { key: 's', label: '底边长', min: 0.5, max: 5, step: 0.1, v: 2.2 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2.2 },
    ] },
  { id: 'pyramid4', name: '四棱锥', type: 'pyramid', metrics: 'pyramid',
    params: [
      { key: 'n', hidden: true, v: 4 },
      { key: 's', label: '底边长', min: 0.5, max: 5, step: 0.1, v: 2 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2.4 },
    ] },
  { id: 'pyramid6', name: '六棱锥', type: 'pyramid', metrics: 'pyramid',
    params: [
      { key: 'n', hidden: true, v: 6 },
      { key: 's', label: '底边长', min: 0.5, max: 5, step: 0.1, v: 1.6 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2.4 },
    ] },
  { id: 'cylinder', name: '圆柱', type: 'cylinder', metrics: 'cylinder',
    params: [
      { key: 'r', label: '半径', min: 0.3, max: 3, step: 0.1, v: 1.4 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2.6 },
    ] },
  { id: 'cone', name: '圆锥', type: 'cone', metrics: 'cone',
    params: [
      { key: 'r', label: '半径', min: 0.3, max: 3, step: 0.1, v: 1.6 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2.8 },
    ] },
  { id: 'frustum', name: '圆台', type: 'frustum', metrics: 'frustum',
    params: [
      { key: 'R', label: '下底半径', min: 0.3, max: 3, step: 0.1, v: 1.6 },
      { key: 'r', label: '上底半径', min: 0.2, max: 3, step: 0.1, v: 0.8 },
      { key: 'h', label: '高', min: 0.5, max: 5, step: 0.1, v: 2 },
    ] },
  { id: 'sphere', name: '球', type: 'sphere', metrics: 'sphere',
    params: [{ key: 'r', label: '半径', min: 0.5, max: 3, step: 0.1, v: 1.8 }] },
  { id: 'tetrahedron', name: '正四面体', type: 'tetrahedron', metrics: 'tetrahedron',
    params: [{ key: 'a', label: '棱长', min: 1, max: 5, step: 0.1, v: 2.4 }] },
  { id: 'octahedron', name: '正八面体', type: 'octahedron', metrics: 'octahedron',
    params: [{ key: 'a', label: '棱长', min: 1, max: 5, step: 0.1, v: 2.2 }] },
  { id: 'dodecahedron', name: '正十二面体', type: 'dodecahedron', metrics: 'dodecahedron',
    params: [{ key: 'a', label: '棱长', min: 0.5, max: 3, step: 0.1, v: 1.6 }] },
  { id: 'icosahedron', name: '正二十面体', type: 'icosahedron', metrics: 'icosahedron',
    params: [{ key: 'a', label: '棱长', min: 0.5, max: 4, step: 0.1, v: 2.2 }] },
];

const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]));

// 组合体可用的基本体
const PART_TYPES = {
  box:    { name: '长方体',  params: [{ key: 'a', label: '长X', step: 0.1, v: 1.4 }, { key: 'b', label: '宽Z', step: 0.1, v: 1.4 }, { key: 'c', label: '高Y', step: 0.1, v: 1.4 }] },
  sphere: { name: '球',      params: [{ key: 'r', label: '半径', step: 0.1, v: 1 }] },
  cylinder: { name: '圆柱', params: [{ key: 'r', label: '半径', step: 0.1, v: 0.8 }, { key: 'h', label: '高', step: 0.1, v: 1.6 }] },
  cone:   { name: '圆锥',    params: [{ key: 'r', label: '半径', step: 0.1, v: 0.8 }, { key: 'h', label: '高', step: 0.1, v: 1.6 }] },
  frustum: { name: '圆台',   params: [{ key: 'R', label: '下半径', step: 0.1, v: 1 }, { key: 'r', label: '上半径', step: 0.1, v: 0.5 }, { key: 'h', label: '高', step: 0.1, v: 1 }] },
  prism:  { name: '正棱柱',  params: [{ key: 'n', label: '边数', step: 1, v: 6, min: 3 }, { key: 's', label: '底边长', step: 0.1, v: 1 }, { key: 'h', label: '高', step: 0.1, v: 1.4 }] },
  pyramid: { name: '正棱锥', params: [{ key: 'n', label: '边数', step: 1, v: 4, min: 3 }, { key: 's', label: '底边长', step: 0.1, v: 1.4 }, { key: 'h', label: '高', step: 0.1, v: 1.6 }] },
};

/* ============================ 全局状态 ============================ */
const state = {
  mode: 'preset',            // preset | custom | compound
  presetId: 'cube',
  params: {},
  customPoints: [],          // 屏幕坐标 [[x,y], ...]
  polyMode: 'prism',
  polyHeight: 2,
  compoundParts: [],
  explode: 0,                // 0..1
  autoRotate: false,
  showWireframe: true,
  showEdges: true,
};

let sceneRadius = 3;
// 按需渲染：只有视角或几何体变化时才重绘，空闲时不再占用 GPU
let needsRender = true;

/* ============================ 场景与渲染器 ============================ */
const mainScene = new THREE.Scene();
mainScene.background = new THREE.Color(0x10151d);
const orthoScene = new THREE.Scene();
orthoScene.background = new THREE.Color(0xf4f6fb);

const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 1.0);
mainScene.add(hemi);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.7);
dirLight.position.set(5, 8, 6);
mainScene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight2.position.set(-5, -3, -4);
mainScene.add(dirLight2);

const gridHelper = new THREE.GridHelper(20, 20, 0x38485c, 0x202b3a);
const axesHelper = new THREE.AxesHelper(4);
mainScene.add(gridHelper, axesHelper);

const mainGroup = new THREE.Group();
const orthoGroup = new THREE.Group();
mainScene.add(mainGroup);
orthoScene.add(orthoGroup);

function makeRenderer(canvas, clearColor) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setClearColor(clearColor, 1);
  if ('outputEncoding' in r && THREE.sRGBEncoding !== undefined) {
    r.outputEncoding = THREE.sRGBEncoding;
  }
  return r;
}
const mainRenderer = makeRenderer($('#mainCanvas'), 0x10151d);
const frontRenderer = makeRenderer($('#frontCanvas'), 0xf4f6fb);
const topRenderer = makeRenderer($('#topCanvas'), 0xf4f6fb);
const sideRenderer = makeRenderer($('#sideCanvas'), 0xf4f6fb);

/* ============================ 相机 ============================ */
const mainCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
const frontCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
const topCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
const sideCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);

function setOrthoFrustum(cam, half, aspect) {
  const w = half * aspect;
  cam.left = -w; cam.right = w;
  cam.top = half; cam.bottom = -half;
  cam.updateProjectionMatrix();
}

function updateCameras() {
  const r = Math.max(sceneRadius, 1);
  const dist = r * 6;

  frontCamera.position.set(0, 0, dist);
  frontCamera.up.set(0, 1, 0);
  frontCamera.lookAt(0, 0, 0);

  topCamera.position.set(0, dist, 0);
  topCamera.up.set(0, 0, -1);
  topCamera.lookAt(0, 0, 0);

  sideCamera.position.set(-dist, 0, 0);
  sideCamera.up.set(0, 1, 0);
  sideCamera.lookAt(0, 0, 0);
}

/* ============================ 自绘轨道控制器 ============================ */
class OrbitControls {
  constructor(element, camera) {
    this.element = element;
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.scale = 1;
    this.minDistance = 2;
    this.maxDistance = 80;
    this.rotateSpeed = 1.0;
    this._pointers = new Map();
    this._prevPinch = 0;
    this._default = { radius: 14, theta: 0, phi: 0 };
    this.reset();
    this._bind();
  }

  reset() {
    // 默认朝向 (7,6,9) 的方向
    const v = new THREE.Vector3(7, 6, 9);
    this.spherical.copy(new THREE.Spherical().setFromVector3(v));
    this._default.radius = this.spherical.radius;
    this._default.theta = this.spherical.theta;
    this._default.phi = this.spherical.phi;
    this.target.set(0, 0, 0);
    this.update();
  }

  _bind() {
    const el = this.element;
    el.addEventListener('pointerdown', (e) => this._onDown(e));
    el.addEventListener('pointermove', (e) => this._onMove(e));
    el.addEventListener('pointerup', (e) => this._onUp(e));
    el.addEventListener('pointercancel', (e) => this._onUp(e));
    el.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onDown(e) {
    this.element.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    if (this._pointers.size === 1) {
      this.state = (e.button === 0) ? 'ROTATE' : 'PAN';
    } else if (this._pointers.size === 2) {
      this.state = 'PINCH';
      this._prevPinch = this._pinchDist();
    }
  }

  _onMove(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.state === 'ROTATE') {
      const h = this.element.clientHeight || 1;
      this.sphericalDelta.theta -= 2 * Math.PI * dx / h * this.rotateSpeed;
      this.sphericalDelta.phi -= 2 * Math.PI * dy / h * this.rotateSpeed;
    } else if (this.state === 'PAN') {
      this._pan(dx, dy);
    } else if (this.state === 'PINCH') {
      const d = this._pinchDist();
      if (this._prevPinch > 0) {
        this.scale *= this._prevPinch / d;
      }
      this._prevPinch = d;
    }
    this.update();
  }

  _onUp(e) {
    if (this._pointers.has(e.pointerId)) {
      this._pointers.delete(e.pointerId);
    }
    if (this._pointers.size < 2) this._prevPinch = 0;
    if (this._pointers.size === 0) this.state = 'NONE';
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    this.spherical.radius = clamp(this.spherical.radius * factor, this.minDistance, this.maxDistance);
    this.update();
  }

  _pinchDist() {
    const arr = [...this._pointers.values()];
    if (arr.length < 2) return 0;
    return Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
  }

  _pan(dx, dy) {
    const el = this.element;
    const camera = this.camera;
    const dist = this.spherical.radius;
    const fov = camera.fov * Math.PI / 180;
    const worldH = 2 * Math.tan(fov / 2) * dist;
    const worldW = worldH * (el.clientWidth / Math.max(el.clientHeight, 1));
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const px = -dx * worldW / Math.max(el.clientWidth, 1);
    const py = dy * worldH / Math.max(el.clientHeight, 1);
    this.target.addScaledVector(right, px);
    this.target.addScaledVector(up, py);
  }

  update() {
    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi = clamp(this.spherical.phi + this.sphericalDelta.phi, 0.0001, Math.PI - 0.0001);
    this.spherical.radius = clamp(this.spherical.radius * this.scale, this.minDistance, this.maxDistance);
    this.spherical.makeSafe();

    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);

    this.sphericalDelta.set(0, 0, 0);
    this.scale = 1;
    needsRender = true;
  }
}

const controls = new OrbitControls($('#mainViewport'), mainCamera);

/* ============================ 几何体构建 ============================ */
function buildPrimitive(type, p) {
  switch (type) {
    case 'cube': return new THREE.BoxGeometry(p.a, p.a, p.a);
    case 'cuboid': return new THREE.BoxGeometry(p.a, p.c, p.b);
    case 'prism': { const R = sideToRadius(p.s, p.n); return new THREE.CylinderGeometry(R, R, p.h, p.n); }
    case 'pyramid': { const R = sideToRadius(p.s, p.n); return new THREE.ConeGeometry(R, p.h, p.n); }
    case 'cylinder': return new THREE.CylinderGeometry(p.r, p.r, p.h, 64);
    case 'cone': return new THREE.ConeGeometry(p.r, p.h, 64);
    case 'frustum': return new THREE.CylinderGeometry(p.r, p.R, p.h, 64);
    case 'sphere': return new THREE.SphereGeometry(p.r, 48, 32);
    case 'tetrahedron': return new THREE.TetrahedronGeometry(p.a * Math.sqrt(6) / 4);
    case 'octahedron': return new THREE.OctahedronGeometry(p.a * Math.sqrt(2) / 2);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(p.a * Math.sqrt(3) * (1 + Math.sqrt(5)) / 4);
    case 'icosahedron': return new THREE.IcosahedronGeometry(p.a * Math.sqrt(10 + 2 * Math.sqrt(5)) / 4);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

function defaultParamsForType(type) {
  const d = {};
  for (const f of PART_TYPES[type].params) d[f.key] = f.v;
  return d;
}

function newPart() {
  return {
    type: 'box',
    params: defaultParamsForType('box'),
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

function buildCompoundPartGeo(part) {
  const geo = buildPrimitive(part.type, part.params);
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(deg2rad(part.rot.x), deg2rad(part.rot.y), deg2rad(part.rot.z))
  );
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(part.pos.x, part.pos.y, part.pos.z),
    q,
    new THREE.Vector3(part.scale.x, part.scale.y, part.scale.z)
  );
  geo.applyMatrix4(m);
  return geo;
}

/* -- 自定义多边形：把屏幕点映射到 XZ 平面 -- */
const POLY_CX = 130, POLY_CY = 115, POLY_SCALE = 42;

function screenToWorld(pts) {
  return pts.map(([sx, sy]) => [(sx - POLY_CX) / POLY_SCALE, (sy - POLY_CY) / POLY_SCALE]);
}

function buildPolyPrism(worldPts, h) {
  const shape = new THREE.Shape(worldPts.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

function buildPolyPyramid(worldPts, h) {
  const n = worldPts.length;
  const geo = new THREE.BufferGeometry();
  if (n < 3) return geo;
  const baseY = -h / 2, apexY = h / 2;
  const cx = worldPts.reduce((s, p) => s + p[0], 0) / n;
  const cz = worldPts.reduce((s, p) => s + p[1], 0) / n;

  const positions = [];
  positions.push(cx, apexY, cz);            // 顶点 0
  for (const [x, z] of worldPts) positions.push(x, baseY, z);

  const triIndices = THREE.ShapeUtils.triangulateShape(
    worldPts.map(([x, z]) => new THREE.Vector2(x, z)), []
  );

  const index = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    index.push(0, 1 + i, 1 + j);            // 侧面
  }
  for (const t of triIndices) {
    index.push(1 + t[0], 1 + t[2], 1 + t[1]); // 底面（反向）
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  orientOutward(geo, new THREE.Vector3(cx, 0, cz));
  geo.computeVertexNormals();
  return geo;
}

// 使所有面法线指向形体外部（相对给定中心）
function orientOutward(geo, center) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  if (!idx) return;
  const triCount = idx.count / 3;
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), normal = new THREE.Vector3();
  const fc = new THREE.Vector3(), toC = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const a = idx.getX(t * 3), b = idx.getX(t * 3 + 1), c = idx.getX(t * 3 + 2);
    va.fromBufferAttribute(pos, a); vb.fromBufferAttribute(pos, b); vc.fromBufferAttribute(pos, c);
    e1.subVectors(vb, va); e2.subVectors(vc, va);
    normal.crossVectors(e1, e2);
    fc.copy(va).add(vb).add(vc).divideScalar(3);
    toC.subVectors(center, fc);
    if (normal.dot(toC) > 0) {
      idx.setX(t * 3 + 1, c);
      idx.setX(t * 3 + 2, b);
    }
  }
}

/* ============================ 形状分派 ============================ */
function buildShape() {
  if (state.mode === 'preset') {
    const preset = PRESET_MAP.get(state.presetId);
    return [{ geo: buildPrimitive(preset.type, state.params) }];
  }
  if (state.mode === 'custom') {
    const pts = screenToWorld(state.customPoints);
    if (pts.length < 3) return [];
    const h = Math.max(0.01, parseFloat(state.polyHeight) || 2);
    const geo = state.polyMode === 'prism' ? buildPolyPrism(pts, h) : buildPolyPyramid(pts, h);
    return [{ geo }];
  }
  if (state.mode === 'compound') {
    return state.compoundParts.map((part) => ({ geo: buildCompoundPartGeo(part) }));
  }
  return [];
}

/* ============================ 爆炸图（按面拆解） ============================ */
function explodeGeometry(geom, amount) {
  if (amount <= 0) return geom;
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  const pos = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.subVectors(b, a); ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    if (n.lengthSq() < 1e-12) continue;
    n.normalize().multiplyScalar(amount);
    a.add(n); b.add(n); c.add(n);
    pos.setXYZ(i, a.x, a.y, a.z);
    pos.setXYZ(i + 1, b.x, b.y, b.z);
    pos.setXYZ(i + 2, c.x, c.y, c.z);
  }
  return g;
}

/* ============================ 资源管理与重建 ============================ */
const resources = { geos: new Set(), mats: new Set() };
const trackGeo = (g) => { resources.geos.add(g); return g; };
const trackMat = (m) => { resources.mats.add(m); return m; };

function geoRadius(geo) {
  const pos = geo.attributes.position;
  if (!pos) return 1;
  const v = new THREE.Vector3();
  let max2 = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.lengthSq() > max2) max2 = v.lengthSq();
  }
  return Math.sqrt(max2);
}

function addPartToScene(geo, colorIndex) {
  const color = PALETTE[colorIndex % PALETTE.length];
  const explodeAmount = state.explode * sceneRadius * 0.7;

  // 主视口（带阴影）
  const mainGeo = state.explode > 0 ? trackGeo(explodeGeometry(geo, explodeAmount)) : geo;
  const mainMat = trackMat(new THREE.MeshStandardMaterial({
    color, metalness: 0.15, roughness: 0.55, wireframe: state.showWireframe, side: THREE.DoubleSide,
  }));
  mainGroup.add(new THREE.Mesh(mainGeo, mainMat));

  // 三视口（平面着色，始终显示未拆解形态）
  const orthoMat = trackMat(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  orthoGroup.add(new THREE.Mesh(geo, orthoMat));

  // 棱边：主视口与三视图共用同一份几何数据，避免重复计算
  const edgesGeo = trackGeo(new THREE.EdgesGeometry(geo, 25));
  if (state.showEdges && state.explode === 0) {
    const lm = trackMat(new THREE.LineBasicMaterial({ color: 0x10151d }));
    mainGroup.add(new THREE.LineSegments(edgesGeo, lm));
  }
  const lm2 = trackMat(new THREE.LineBasicMaterial({ color: 0x223049 }));
  orthoGroup.add(new THREE.LineSegments(edgesGeo, lm2));
}

function rebuild() {
  resources.geos.forEach((g) => g.dispose());
  resources.mats.forEach((m) => m.dispose());
  resources.geos.clear();
  resources.mats.clear();
  mainGroup.clear();
  orthoGroup.clear();

  const parts = buildShape();
  if (parts.length) {
    sceneRadius = Math.max(1, ...parts.map((p) => geoRadius(p.geo)));
    parts.forEach((p, i) => {
      trackGeo(p.geo);
      addPartToScene(p.geo, i);
    });
  } else {
    sceneRadius = 3;
  }

  updateCameras();
  refreshProjections();
  updateInfoPanel(parts);
  needsRender = true;
}

// 合并同一帧内的多次重建请求，避免拖动滑块时重复构建几何体
let rebuildQueued = false;
function scheduleRebuild() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => {
    rebuildQueued = false;
    rebuild();
  });
}

/* ============================ 信息面板 ============================ */
function presetMetrics(type, p) {
  switch (type) {
    case 'cube': return { S: 6 * p.a * p.a, V: p.a ** 3 };
    case 'cuboid': return { S: 2 * (p.a * p.b + p.a * p.c + p.b * p.c), V: p.a * p.b * p.c };
    case 'prism': {
      const n = p.n, B = (n / 4) * p.s * p.s / Math.tan(Math.PI / n);
      return { S: 2 * B + n * p.s * p.h, V: B * p.h };
    }
    case 'pyramid': {
      const n = p.n, B = (n / 4) * p.s * p.s / Math.tan(Math.PI / n);
      const apo = p.s / (2 * Math.tan(Math.PI / n));
      const l = Math.sqrt(p.h * p.h + apo * apo);
      return { S: B + n * p.s * l / 2, V: B * p.h / 3 };
    }
    case 'cylinder': return { S: 2 * Math.PI * p.r * p.r + 2 * Math.PI * p.r * p.h, V: Math.PI * p.r * p.r * p.h };
    case 'cone': { const l = Math.sqrt(p.r * p.r + p.h * p.h); return { S: Math.PI * p.r * p.r + Math.PI * p.r * l, V: Math.PI * p.r * p.r * p.h / 3 }; }
    case 'frustum': { const l = Math.sqrt((p.R - p.r) ** 2 + p.h * p.h); return { S: Math.PI * (p.R * p.R + p.r * p.r) + Math.PI * (p.R + p.r) * l, V: Math.PI * p.h * (p.R * p.R + p.R * p.r + p.r * p.r) / 3 }; }
    case 'sphere': return { S: 4 * Math.PI * p.r * p.r, V: 4 * Math.PI * p.r ** 3 / 3 };
    case 'tetrahedron': return { S: Math.sqrt(3) * p.a * p.a, V: p.a ** 3 / (6 * Math.sqrt(2)) };
    case 'octahedron': return { S: 2 * Math.sqrt(3) * p.a * p.a, V: Math.sqrt(2) * p.a ** 3 / 3 };
    case 'dodecahedron': return { S: 3 * Math.sqrt(25 + 10 * Math.sqrt(5)) * p.a * p.a, V: (15 + 7 * Math.sqrt(5)) * p.a ** 3 / 4 };
    case 'icosahedron': return { S: 5 * Math.sqrt(3) * p.a * p.a, V: (5 * (3 + Math.sqrt(5)) * p.a ** 3) / 12 };
    default: return null;
  }
}

function updateInfoPanel(parts) {
  const el = $('#infoPanel');
  const tri = parts.reduce((s, p) => s + (p.geo.index ? p.geo.index.count / 3 : p.geo.attributes.position.count / 3), 0);

  let name = '';
  let mtr = null;
  if (state.mode === 'preset') {
    const preset = PRESET_MAP.get(state.presetId);
    name = preset.name;
    mtr = presetMetrics(preset.type, state.params);
  } else if (state.mode === 'custom') {
    name = state.polyMode === 'prism' ? '自定义棱柱' : '自定义棱锥';
  } else {
    name = '组合体';
  }

  let html = `<div class="info-title">${name}</div>`;
  html += `<div class="info-row">部件数：${parts.length}</div>`;
  html += `<div class="info-row">三角面：${Math.round(tri)}</div>`;
  if (mtr) {
    html += `<div class="info-row">表面积 S ≈ ${mtr.S.toFixed(2)}</div>`;
    html += `<div class="info-row">体积 V ≈ ${mtr.V.toFixed(2)}</div>`;
  }
  el.innerHTML = html;
}

/* ============================ 渲染循环 ============================ */
function renderAll() {
  mainRenderer.render(mainScene, mainCamera);
  frontRenderer.render(orthoScene, frontCamera);
  topRenderer.render(orthoScene, topCamera);
  sideRenderer.render(orthoScene, sideCamera);
}

function animate() {
  requestAnimationFrame(animate);
  if (state.autoRotate) {
    controls.sphericalDelta.theta -= 0.003;
    controls.update();
  }
  if (needsRender) {
    needsRender = false;
    renderAll();
  }
}

/* ============================ 自适应尺寸 ============================ */
const views = [
  { canvas: $('#mainCanvas'), renderer: mainRenderer, camera: mainCamera, ortho: false },
  { canvas: $('#frontCanvas'), renderer: frontRenderer, camera: frontCamera, ortho: true },
  { canvas: $('#topCanvas'), renderer: topRenderer, camera: topCamera, ortho: true },
  { canvas: $('#sideCanvas'), renderer: sideRenderer, camera: sideCamera, ortho: true },
];

function applyViewProjection(v, w, h) {
  if (v.ortho) {
    setOrthoFrustum(v.camera, sceneRadius * 1.4, w / h);
  } else if (v.camera.aspect !== w / h) {
    v.camera.aspect = w / h;
    v.camera.updateProjectionMatrix();
  }
}

function resizeView(v) {
  const parent = v.canvas.parentElement;
  const w = Math.max(1, Math.floor(parent.clientWidth));
  const h = Math.max(1, Math.floor(parent.clientHeight));
  // 尺寸未变化时不重复设置 canvas.width，避免清空绘图缓冲
  if (v.canvas.width !== w * v.renderer.getPixelRatio() ||
      v.canvas.height !== h * v.renderer.getPixelRatio()) {
    v.renderer.setSize(w, h, false);
  }
  applyViewProjection(v, w, h);
  needsRender = true;
}

// 几何体尺寸变化时只需更新投影，无需重建绘图缓冲
function refreshProjections() {
  views.forEach((v) => {
    const parent = v.canvas.parentElement;
    applyViewProjection(v, Math.max(1, parent.clientWidth), Math.max(1, parent.clientHeight));
  });
}

function setupResize() {
  views.forEach((v) => {
    const ro = new ResizeObserver(() => resizeView(v));
    ro.observe(v.canvas.parentElement);
  });
}

/* ============================ UI 渲染 ============================ */
function renderShapeGrid() {
  const grid = $('#shapeGrid');
  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.className = 'shape-btn';
    btn.dataset.id = preset.id;
    btn.textContent = preset.name;
    btn.addEventListener('click', () => selectPreset(preset.id));
    grid.appendChild(btn);
  }
  updateShapeGridActive();
}

function updateShapeGridActive() {
  document.querySelectorAll('#shapeGrid .shape-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.id === state.presetId);
  });
}

function renderPresetParams() {
  const preset = PRESET_MAP.get(state.presetId);
  const container = $('#presetParams');
  container.innerHTML = '';
  for (const f of preset.params) {
    if (f.hidden) continue;
    const row = document.createElement('div');
    row.className = 'param-row';
    const lab = document.createElement('label');
    lab.textContent = f.label;
    const range = document.createElement('input');
    range.type = 'range'; range.min = f.min; range.max = f.max; range.step = f.step;
    range.value = state.params[f.key];
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = state.params[f.key];
    range.addEventListener('input', () => {
      state.params[f.key] = parseFloat(range.value);
      val.textContent = state.params[f.key];
      scheduleRebuild();
    });
    row.append(lab, range, val);
    container.appendChild(row);
  }
}

function selectPreset(id) {
  state.mode = 'preset';
  state.presetId = id;
  state.params = {};
  const preset = PRESET_MAP.get(id);
  for (const f of preset.params) state.params[f.key] = f.v;
  updateShapeGridActive();
  renderPresetParams();
  scheduleRebuild();
}

/* -- 自定义多边形 -- */
function drawPolygon() {
  const svg = $('#polyCanvas');
  const pts = state.customPoints;
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';

  const mk = (tag) => document.createElementNS(NS, tag);

  if (pts.length >= 3) {
    const poly = mk('polygon');
    poly.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
    poly.setAttribute('fill', 'rgba(79,140,255,0.16)');
    poly.setAttribute('stroke', 'none');
    svg.appendChild(poly);
  }
  if (pts.length >= 2) {
    const line = mk('polyline');
    line.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#4f8cff');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);
  }
  pts.forEach((p, i) => {
    const c = mk('circle');
    c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', '4');
    c.setAttribute('fill', i === 0 ? '#34c38f' : '#ff6b6b');
    svg.appendChild(c);
    const t = mk('text');
    t.setAttribute('x', p[0] + 7); t.setAttribute('y', p[1] - 7);
    t.setAttribute('fill', '#cfe0f4'); t.setAttribute('font-size', '11');
    t.textContent = String(i + 1);
    svg.appendChild(t);
  });
  $('#polyHintCount').textContent = pts.length ? `${pts.length} 个顶点` : '尚未添加顶点';
}

function bindCustom() {
  const svg = $('#polyCanvas');
  svg.addEventListener('click', (e) => {
    if (e.detail > 1) return;
    const rect = svg.getBoundingClientRect();
    state.customPoints.push([e.clientX - rect.left, e.clientY - rect.top]);
    drawPolygon();
  });
  svg.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.customPoints.length) state.customPoints.pop();
    drawPolygon();
  });
  svg.addEventListener('dblclick', (e) => {
    e.preventDefault();
    buildCustom();
  });
  $('#polyMode').addEventListener('change', (e) => {
    state.polyMode = e.target.value;
    if (state.mode === 'custom' && state.customPoints.length >= 3) scheduleRebuild();
  });
  $('#polyHeight').addEventListener('input', (e) => {
    state.polyHeight = parseFloat(e.target.value) || 2;
    if (state.mode === 'custom' && state.customPoints.length >= 3) scheduleRebuild();
  });
  $('#polyBuild').addEventListener('click', buildCustom);
  $('#polyClear').addEventListener('click', () => {
    state.customPoints = [];
    drawPolygon();
    if (state.mode === 'custom') scheduleRebuild();
  });
}

function buildCustom() {
  if (state.customPoints.length < 3) {
    $('#polyHintCount').textContent = '至少需要 3 个顶点';
    return;
  }
  state.mode = 'custom';
  scheduleRebuild();
}

/* -- 组合体 -- */
function makeNumberInputs(part, fields, groupKey, groupLabel) {
  const wrap = document.createElement('div');
  wrap.className = 'transform-row';
  if (groupLabel) {
    const t = document.createElement('span');
    t.className = 'group-label';
    t.textContent = groupLabel;
    wrap.appendChild(t);
  }
  for (const f of fields) {
    const lbl = document.createElement('span');
    lbl.className = 'inline-label';
    lbl.textContent = f.label;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = String(f.step || 0.1);
    if (f.min !== undefined) inp.min = f.min;
    inp.value = part[groupKey][f.key];
    inp.addEventListener('input', () => {
      part[groupKey][f.key] = parseFloat(inp.value);
      if (Number.isNaN(part[groupKey][f.key])) part[groupKey][f.key] = 0;
      scheduleRebuild();
    });
    wrap.append(lbl, inp);
  }
  return wrap;
}

function renderCompoundList() {
  const list = $('#compoundList');
  list.innerHTML = '';
  state.compoundParts.forEach((part, i) => {
    const card = document.createElement('div');
    card.className = 'part-card';

    const head = document.createElement('div');
    head.className = 'part-head';
    const label = document.createElement('span');
    label.textContent = '部件 ' + (i + 1);
    const tsel = document.createElement('select');
    for (const [tKey, tDef] of Object.entries(PART_TYPES)) {
      const opt = document.createElement('option');
      opt.value = tKey; opt.textContent = tDef.name;
      if (tKey === part.type) opt.selected = true;
      tsel.appendChild(opt);
    }
    tsel.addEventListener('change', () => {
      part.type = tsel.value;
      part.params = defaultParamsForType(part.type);
      renderCompoundList();
      scheduleRebuild();
    });
    const del = document.createElement('button');
    del.className = 'btn mini';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      state.compoundParts.splice(i, 1);
      renderCompoundList();
      scheduleRebuild();
    });
    head.append(label, tsel, del);
    card.appendChild(head);

    card.appendChild(makeNumberInputs(part, PART_TYPES[part.type].params.map((f) => ({ key: f.key, label: f.label, step: f.step, min: f.min })), 'params', '尺寸'));
    card.appendChild(makeNumberInputs(part, [{ key: 'x', label: 'X' }, { key: 'y', label: 'Y' }, { key: 'z', label: 'Z' }], 'pos', '位置'));
    card.appendChild(makeNumberInputs(part, [{ key: 'x', label: 'X' }, { key: 'y', label: 'Y' }, { key: 'z', label: 'Z' }], 'rot', '旋转'));
    card.appendChild(makeNumberInputs(part, [{ key: 'x', label: 'X' }, { key: 'y', label: 'Y' }, { key: 'z', label: 'Z' }], 'scale', '缩放'));

    list.appendChild(card);
  });
}

function bindCompound() {
  $('#addPart').addEventListener('click', () => {
    state.compoundParts.push(newPart());
    state.mode = 'compound';
    renderCompoundList();
    scheduleRebuild();
  });
  $('#compoundBuild').addEventListener('click', () => {
    state.mode = 'compound';
    scheduleRebuild();
  });
}

/* -- 顶栏 -- */
function bindTopbar() {
  $('#explodeRange').addEventListener('input', (e) => {
    state.explode = parseFloat(e.target.value) / 100;
    $('#explodeVal').textContent = String(Math.round(state.explode * 100));
    scheduleRebuild();
  });
  $('#autoRotate').addEventListener('change', (e) => { state.autoRotate = e.target.checked; });
  $('#wireframeChk').addEventListener('change', (e) => { state.showWireframe = e.target.checked; scheduleRebuild(); });
  $('#edgesChk').addEventListener('change', (e) => { state.showEdges = e.target.checked; scheduleRebuild(); });
  $('#axesChk').addEventListener('change', (e) => { axesHelper.visible = e.target.checked; needsRender = true; });
  $('#gridChk').addEventListener('change', (e) => { gridHelper.visible = e.target.checked; needsRender = true; });
  $('#resetView').addEventListener('click', () => controls.reset());
}

/* -- 标签页 -- */
function bindTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ============================ 初始化 ============================ */
function init() {
  bindTabs();
  bindTopbar();
  bindCustom();
  bindCompound();
  setupResize();
  renderShapeGrid();
  selectPreset('cube');
  drawPolygon();
  animate();
}

init();