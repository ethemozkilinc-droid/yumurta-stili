// Mihrimah — Sinan's two mosques for Mihrimah Sultan (as the story is told): Üsküdar like a woman whose skirts sweep
// the ground, Edirnekapı on a high hill with a thin dome pierced by windows; on 21 March the sun sets behind Edirnekapı's
// single minaret while the moon rises behind Üsküdar. "Mihrimah" = sun and moon.
// Sets (far apart in x): STUDY (x≈0), PALACE (x≈1000), CITY (x≈2000), INTERIOR (x≈3000).
// Every cue is pinned to a word of voice/words.json (W('word', n) = start of the n-th match).
// Light, per set (the rule of the style: the light source is IN the picture, warm against cool, real cast shadows):
//   study     Sinan's desk lamp (warm, shadows on the wall) against the blue dusk through the window
//   palace    hanging lamps of the arcade (warm pools) against moonlight (cool, shadows)
//   city      the low red sun in the west (warm, long shadows) against a violet eastern sky with the moon
//   interior  daylight through hundreds of windows (beams) against the cool stone; the lamp ring
import * as THREE from 'three';
import { stoneTex, woodTex, carpetTex, domeTex, ciniTex, frizTex, painted, flat, rng } from '/engine/src/paint.js';
import { Toon, Arm3D, PLUM, flap, blinkAt } from '/engine/src/toon.js';
import { CamPath, smoother } from '/engine/src/camera.js';
import { Smoke, beam, glow } from '/engine/src/fx.js';
import { holedWall, vistaMat, nightCityTex } from '/engine/src/vista.js';
import { kandil, kandilParts, voussoirArch } from '/engine/src/props.js';

export const NAME = 'mihrimah';
export const FPS = 30;
export let DUR = 45;      // recomputed in setup() from the last word
export const CUES = [];

const S = smoother;
const ramp = (t, a, b) => S((t - a) / (b - a));
const lin = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const lerpN = (a, b, k) => a + (b - a) * k;
const V = (...a) => new THREE.Vector3(...a);
const HDR = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const RAW = hex => { const c = parseInt(hex.slice(1), 16); return new THREE.Vector3((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255); };   // display colour (no sRGB decode)
const DEG = Math.PI / 180;
const backOut = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const X = { study: 0, palace: 1000, city: 2000, inside: 3000 };
let C, W;
let cast = {}, sets = {}, smokes = {}, dyn = {};

function wordTimes(words) {
  const norm = s => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '');
  return (w, n = 1) => { let k = 0; for (const x of words) if (norm(x.word) === norm(w) && ++k === n) return x.start; throw new Error('word not found: ' + w); };
}
function shadows(g) {
  g.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (o.material.isMeshLambertMaterial) o.receiveShadow = true;
    if (/Box|Cylinder|Extrude|Lathe|Torus|Sphere|Cone/.test(o.geometry.type) && !o.userData.noShadow) o.castShadow = true;
  });
}
function keySpot(color, intensity, pos, target, angle, { size = 2048, near = 1, far = 60, penumbra = .35 } = {}) {
  const l = new THREE.SpotLight(color, intensity, 0, angle, penumbra, 0);
  l.position.set(...pos); l.target.position.set(...target); l.castShadow = true;
  l.shadow.mapSize.set(size, size); l.shadow.camera.near = near; l.shadow.camera.far = far; l.shadow.bias = -.0006; l.shadow.normalBias = .03; l.shadow.radius = 3;
  return l;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// a drawn card in the world (layer 1, no world ink): pops on with backOut
function card(scene, w, h, draw, pw = 512) {
  const t = canvasTex(pw, Math.round(pw * h / w), draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.layers.set(1); m.renderOrder = 20; m.visible = false; scene.add(m); return m;
}
function heart(c, x, y, r, fill = '#e8384a') {
  c.beginPath(); c.moveTo(x, y + r * .9); c.bezierCurveTo(x - r * 1.6, y - r * .2, x - r * .8, y - r * 1.3, x, y - r * .45); c.bezierCurveTo(x + r * .8, y - r * 1.3, x + r * 1.6, y - r * .2, x, y + r * .9);
  c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = r * .22; c.strokeStyle = PLUM; c.lineJoin = 'round'; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(x - r * .55, y - r * .45, r * .18, r * .12, -.6, 0, 6.29); c.fill();
}

// ---------------------------------------------------------------- STUDY (x = 0)
const STONE = V(1.62, .62, .32);          // centre of the stone block's carved face
function buildStudy(scene) {
  const g = new THREE.Group(); scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), painted(carpetTex({ base: '#2f5aa8', band: '#e0b050', rep: [2, 2], rows: 2 }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  // back wall with an arched window (one piece with a hole); the dusk city behind it
  const WX = [.55, 1.75], WY = [1.05, 2.35];
  const bw = holedWall(7, 3.4, [WX[0], WY[0], WX[1], WY[1]], painted(stoneTex({ base: '#9db2d4', rep: [1 / 1.4, 1 / 1.1] })));
  bw.position.set(0, 0, -2.4); g.add(bw); bw.castShadow = true;
  const side = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.4), painted(stoneTex({ base: '#93a8cc', rep: [3, 2] }))); side.position.set(-2.6, 1.7, 0); side.rotation.y = Math.PI / 2; g.add(side);
  const cini = ciniTex({ kind: 'lale', rep: [7 / .46, 2] });
  const dado = new THREE.Mesh(new THREE.PlaneGeometry(7, .92), painted(cini)); dado.position.set(0, .46, -2.35); g.add(dado);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(7, .07, .12), flat('#d9a441')); strip.position.set(0, .95, -2.34); g.add(strip);
  const friz = new THREE.Mesh(new THREE.PlaneGeometry(7, .6), painted(frizTex({ rep: [3, 1] }))); friz.position.set(0, 2.85, -2.35); g.add(friz);
  const jamb = flat('#c9b28a');
  const box = (sx, sy, sz, x, y, z, m = jamb) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); g.add(b); return b; };
  box(WX[1] - WX[0] + .24, .12, .3, (WX[0] + WX[1]) / 2, WY[0] - .02, -2.3); box(WX[1] - WX[0] + .24, .12, .3, (WX[0] + WX[1]) / 2, WY[1] + .04, -2.3);
  for (const x of WX) box(.12, WY[1] - WY[0], .3, x, (WY[0] + WY[1]) / 2, -2.3);
  for (let k = 1; k < 4; k++) box(.03, WY[1] - WY[0], .04, WX[0] + k * (WX[1] - WX[0]) / 4, (WY[0] + WY[1]) / 2, -2.26, flat('#5a4634'));
  const yaw = Math.atan2(1.15 - .9, -2.4 - 1.6);
  const vis = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), vistaMat(nightCityTex(), { yaw, az: Math.PI / 2, el: [-10 * DEG, 35 * DEG], gain: 1.25 }));
  vis.position.set(1.15, 1.7, -2.55); g.add(vis);
  // the desk with the plan of a dome on it
  const wood = painted(woodTex({ base: '#8f6444' }));
  box(1.5, .06, .8, 0, .86, -.35, wood);
  for (const [x, z] of [[-.68, -.7], [.68, -.7], [-.68, 0], [.68, 0]]) box(.06, .86, .06, x, .43, z, painted(woodTex({ base: '#6e4428' })));
  const plan = canvasTex(1024, 720, (c, w, h) => {
    c.fillStyle = '#f6ecd2'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2c3c80'; c.lineWidth = 6; c.strokeRect(40, 40, w - 80, h - 80);
    const cx = w * .42, cy = h * .5, R = h * .32;
    c.lineWidth = 7; c.strokeRect(cx - R * 1.25, cy - R * 1.25, R * 2.5, R * 2.5);
    c.beginPath(); c.arc(cx, cy, R, 0, 6.29); c.stroke();
    c.lineWidth = 3; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; c.beginPath(); c.moveTo(cx + Math.cos(a) * R * .25, cy + Math.sin(a) * R * .25); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
    c.beginPath(); c.arc(cx, cy, R * .25, 0, 6.29); c.stroke();
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(cx + dx * R * 1.25, cy + dy * R * 1.25, 18, 0, 6.29); c.stroke(); }
    c.fillStyle = '#b8323a'; c.font = 'italic 44px serif'; c.fillText('M', w * .78, h * .3);
    c.strokeStyle = '#2c3c80'; c.lineWidth = 4; c.beginPath(); c.arc(w * .8, h * .62, 46, 0, 6.29); c.stroke();
    c.beginPath(); c.arc(w * .8, h * .62, 46, -1.2, 1.2); c.arc(w * .8 + 30, h * .62, 40, 1.4, -1.4, true); c.stroke();
  });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(.62, .44), new THREE.MeshBasicMaterial({ map: plan })); paper.rotation.x = -Math.PI / 2; paper.rotation.z = .08; paper.position.set(.08, .892, -.32); g.add(paper);
  // compasses and a ruler on the desk
  const brass = flat('#e0a83c', { emissive: '#3a2408' });
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.006, .004, .2, 6), brass); leg.position.set(.48 + s * .03, .9, -.18); leg.rotation.set(Math.PI / 2, 0, s * .25); g.add(leg); }
  box(.42, .012, .04, -.36, .895, -.08, painted(woodTex({ base: '#c99a5a' })));
  // shelf with scrolls on the side wall
  box(.3, .05, 1.6, -2.42, 1.9, -1.0, wood);
  for (let k = 0; k < 6; k++) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .32, 12), flat(k % 2 ? '#f1e2bd' : '#e8d4a8')); sc.rotation.z = Math.PI / 2; sc.position.set(-2.4, 1.98 + (k % 2) * .09, -1.6 + k * .22); g.add(sc); }
  // the stone block on a low stand (the carving face looks at +z)
  box(.82, .22, .62, STONE.x, .11, .3, painted(woodTex({ base: '#6e4428' })));
  const sm = painted(stoneTex({ base: '#e6d6b6', bw: 128, bh: 128, rep: [1, 1] }));
  const blk = box(.7, .6, .5, STONE.x, .52, .28, sm);
  dyn.carve = { c: document.createElement('canvas'), drawn: -1 };
  dyn.carve.c.width = dyn.carve.c.height = 512; dyn.carve.g = dyn.carve.c.getContext('2d');
  dyn.carve.tex = new THREE.CanvasTexture(dyn.carve.c); dyn.carve.tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.6, .5), new THREE.MeshLambertMaterial({ map: dyn.carve.tex, transparent: true }));
  face.position.set(STONE.x, .52, .531); g.add(face);
  // the chisel (3D, held by Sinan's 3D hand) and chips
  const ch = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(.007, .002, .1, 8), flat('#b8bcc8')); blade.position.y = .05; ch.add(blade);
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(.014, .012, .11, 10), flat('#9a6a3a')); hd.position.y = .15; ch.add(hd);
  scene.add(ch); dyn.chisel = ch;
  // the desk lamp: a glass kandil on a brass stand: the key light, with shadows on the wall
  const pole = box(.018, .62, .018, -.52, 1.2, -.62, brass); pole.userData.noShadow = true;
  const arm = box(.2, .018, .018, -.44, 1.5, -.62, brass); arm.userData.noShadow = true;
  box(.16, .03, .16, -.52, .9, -.62, brass);
  const k = kandil({ chain: .14, s: 1.25, light: 7, range: 9, decay: 1.3, halo: .5 });
  k.position.set(-.36, 1.49, -.62); g.add(k); dyn.studyLamp = k;
  const ks = k.light.shadow; k.light.castShadow = true; ks.mapSize.set(1024, 1024); ks.camera.near = .1; ks.camera.far = 12; ks.bias = -.003; ks.normalBias = .04; ks.radius = 4;
  k.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#8f9cff', '#4a3a6a', 1.6));
  const dusk = keySpot('#9ab0ff', 2.2, [2.4, 4.4, -6.5], [.8, 0, .4], .45, { near: 2, far: 16 }); L.add(dusk); L.add(dusk.target);
  scene.add(L); sets.study = { g, L };
  shadows(g);
  dyn.stBeam = beam(scene, [1.15, 1.7, -2.35], [.6, .05, .9], { r0: .55, r1: .9, color: '#a9bcff', strength: .12 });
}
// the carving: a sun and a crescent appear in the stone, cut by the chisel (p 0..1)
function carvePath(u) {          // design units 0..512 on the face
  if (u < .5) { const a = -Math.PI / 2 + u / .5 * Math.PI * 2; return [190 + Math.cos(a) * 82, 256 + Math.sin(a) * 82]; }
  const v = (u - .5) / .5, a = -1.1 * Math.PI / 2 + v * Math.PI * 1.1;
  return [350 + Math.cos(a + Math.PI * .5) * 80, 256 + Math.sin(a + Math.PI * .5) * 80 * -1];
}
function drawCarve(p) {
  const D = dyn.carve; if (Math.abs(D.drawn - p) < 1e-4) return; D.drawn = p;
  const c = D.g; c.clearRect(0, 0, 512, 512);
  const N = 240, end = Math.floor(N * p);
  const stroke = (col, w, dx, dy) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = c.lineJoin = 'round';
    c.beginPath(); for (let i = 0; i <= end; i++) { const u = i / N; if (u > .5 && (i - 1) / N <= .5) { const q = carvePath(u); c.moveTo(q[0] + dx, q[1] + dy); continue; } const q = carvePath(u); i ? c.lineTo(q[0] + dx, q[1] + dy) : c.moveTo(q[0] + dx, q[1] + dy); } c.stroke();
  };
  stroke('rgba(255,248,230,.9)', 26, 4, 5); stroke('#5e4e64', 24, 0, 0);
  // sun rays once the circle is closed
  const rays = lin(p, .42, .5);
  c.strokeStyle = '#5e4e64'; c.lineWidth = 18; c.lineCap = 'round';
  for (let k = 0; k < Math.floor(rays * 10); k++) { const a = k / 10 * 6.283; c.beginPath(); c.moveTo(190 + Math.cos(a) * 104, 256 + Math.sin(a) * 104); c.lineTo(190 + Math.cos(a) * 134, 256 + Math.sin(a) * 134); c.stroke(); }
  D.tex.needsUpdate = true;
}

// ---------------------------------------------------------------- PALACE (x = 1000)
function buildPalace(scene) {
  const g = new THREE.Group(); g.position.x = X.palace; scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), painted(stoneTex({ base: '#d8d2e4', seam: '#8a84a8', bw: 128, bh: 128, rep: [5, 5] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), painted(carpetTex({ base: '#a82c3a', band: '#d9a441', rep: [4, 1], rows: 1 }))); runner.rotation.x = -Math.PI / 2; runner.position.set(.4, .005, -.8); g.add(runner);
  const wallM = painted(stoneTex({ base: '#7f8cc8', rep: [5, 2] }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.4), wallM); back.position.set(0, 2.2, -2.9); g.add(back);
  const cini = ciniTex({ kind: 'yildiz', rep: [10 / .5, 2] });
  const dado = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.0), painted(cini)); dado.position.set(0, .5, -2.85); g.add(dado);
  const box = (sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); g.add(b); return b; };
  box(10, .07, .12, 0, 1.03, -2.84, flat('#d9a441'));
  // the arcade: columns with striped arches in front of the back wall
  const colM = painted(stoneTex({ base: '#efe6d6', rep: [1, 3] })), capM = flat('#d9a441');
  for (const x of [-2.4, -1.0, .4, 1.8]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, 2.5, 18), colM); c.position.set(x, 1.25, -2.05); g.add(c);
    box(.38, .12, .38, x, 2.56, -2.05, capM); box(.36, .14, .36, x, .07, -2.05, colM);
  }
  for (const x of [-1.7, -.3, 1.1]) { const a = voussoirArch({ span: 1.3, rise: .62, thick: .2, depth: .32, n: 11, bevel: .02 }); a.position.set(x, 2.62, -2.05); g.add(a); }
  box(4.8, .5, .34, -.3, 3.55, -2.05, painted(stoneTex({ base: '#e8dcc4', rep: [3, 1] })));
  // the gate on the right, with a guard beside it
  const doorM = painted(woodTex({ base: '#7a3f22', rep: [1, 2], vertical: true }));
  box(1.5, 2.6, .3, 2.95, 1.3, -2.78, painted(stoneTex({ base: '#e2d4b6', rep: [1, 2] })));
  dyn.gate = [];
  for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(2.95 + s * .55, 0, -2.6); g.add(pv); const d = new THREE.Mesh(new THREE.BoxGeometry(.55, 2.1, .08), doorM); d.position.set(-s * .275, 1.05, 0); pv.add(d); dyn.gate.push({ pv, s }); }
  const ga = voussoirArch({ span: 1.2, rise: .5, thick: .16, depth: .3, n: 9, bevel: .02 }); ga.position.set(2.95, 2.1, -2.6); g.add(ga);
  // the big column at the front left, Sinan hides behind it
  const big = new THREE.Mesh(new THREE.CylinderGeometry(.24, .27, 3.6, 24), colM); big.position.set(-.85, 1.8, .55); g.add(big);
  box(.62, .18, .62, -.85, .09, .55, colM); box(.66, .16, .66, -.85, 3.5, .55, capM);
  // a potted rose bush
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.2, .15, .32, 16), flat('#c8663a')); pot.position.set(2.2, .16, -1.3); g.add(pot);
  const bush = new THREE.Mesh(new THREE.SphereGeometry(.26, 16, 12), flat('#3f7a48')); bush.position.set(2.2, .5, -1.3); g.add(bush);
  for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), flat('#e8384a')); const a = k * 2.4; r.position.set(2.2 + Math.cos(a) * .2, .55 + (k % 3) * .06, -1.3 + Math.sin(a) * .2); g.add(r); }
  // the lamps of the arcade: the warm key, hung between the columns
  dyn.pLamps = [];
  for (const x of [-1.7, -.3, 1.1]) {
    const k = kandil({ chain: .5, s: 1.4, light: 0, halo: .45 }); k.position.set(x, 2.55, -1.75); g.add(k); dyn.pLamps.push(k);
    k.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#8a92ee', '#554680', 1.5));
  for (const x of [-1.7, -.3, 1.1]) { const pl = new THREE.PointLight('#ffca7c', 5.5, 6, 1.5); pl.position.set(X.palace + x, 1.9, -1.7); L.add(pl); }
  const key = new THREE.PointLight('#ffc070', 4, 6, 1.4); key.position.set(X.palace - .3, 1.9, -1.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.002; key.shadow.radius = 4; L.add(key);
  const moon = keySpot('#a3b8ff', 2.2, [X.palace + 6, 9, 7], [X.palace, 0, -1], .5, { near: 3, far: 30 }); L.add(moon); L.add(moon.target);
  scene.add(L); sets.palace = { g, L }; dyn.pMoon = V(6, 9, 7);
  shadows(g);
  dyn.pBeam = beam(scene, [X.palace + 3.6, 5.2, 4.4], [X.palace + .6, 0, -.8], { r0: .5, r1: 1.4, color: '#a9bcff', strength: .1 });
  // hearts over Sinan ("deliler gibi âşık") and the guard's laugh marks are drawn by the toon
  dyn.hearts = [0, 1, 2].map(i => card(scene, .22, .22, (c, w) => heart(c, w / 2, w / 2 + 10, w * .3), 256));
}

// ---------------------------------------------------------------- CITY (x = 2000)
// Istanbul at dusk, stylised: the strait runs away from us; Edirnekapı on a high hill on the west bank (left), Üsküdar on
// the shore of the east bank (right); we stand on a hill on the west bank (VP) from which both are seen.
const HILLS = [[-45, -200, 70, 60, 34], [-40, 240, 40, 36, 30], [140, -190, 95, 70, 42], [-200, -330, 140, 90, 52], [0, -470, 300, 80, 36], [230, 60, 90, 80, 26], [-210, 80, 90, 90, 22], [-170, -40, 60, 60, 18]];
function landH(x, z) {
  const west = S((-x - 26) / 16), east = S((x - 34) / 16);
  let h = -5 + 7 * Math.max(west, east);
  for (const [cx, cz, rx, rz, top] of HILLS) {
    const d = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2; if (d >= 1) continue;
    const bell = .5 + .5 * Math.cos(Math.PI * Math.sqrt(d));
    h = Math.max(h, 2 + (top - 2) * Math.min(1, 1.5 * bell));
  }
  return h;
}
const EK = V(-45, landH(-45, -200), -200);    // Edirnekapı mosque base
const UK = V(60, 2, -80);                     // Üsküdar mosque base (on the shore)
const VP = V(-36, landH(-36, 236) + 1.6, 236); // the eye of the viewer on the hill
const EK_MIN = V(EK.x - 13, 0, EK.z + 13);    // its single minaret (front left corner); y filled in buildCity
const azTo = p => Math.atan2(p.x - VP.x, -(p.z - VP.z));
const skyDir = (az, el) => V(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

function minaret(h, { r = 1.05, stone, lead, gold } = {}) {
  const m = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(r * 2.8, h * .14, r * 2.8), stone); base.position.y = h * .07; m.add(base);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(r * .92, r, h * .7, 16), stone); sh.position.y = h * .14 + h * .35; m.add(sh);
  const bal = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.55, r * 1.1, h * .03, 16), stone); bal.position.y = h * .7; m.add(bal);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.55, r * 1.55, h * .025, 16, 1, true), stone); rail.position.y = h * .725; m.add(rail);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * .8, r * .85, h * .12, 16), stone); top.position.y = h * .76 + h * .06; m.add(top);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(r * .95, h * .16, 16), lead); cap.position.y = h * .88 + h * .08; m.add(cap);
  const alem = new THREE.Mesh(new THREE.SphereGeometry(r * .22, 8, 6), gold); alem.position.y = h * 1.05; m.add(alem);
  m.userData.top = h * 1.05; return m;
}
function windowWall(w, h, { cols = 5, rows = 2, arch = true, base = '#efe6d2', glass = '#3a4a8a' } = {}) {
  return canvasTex(512, Math.round(512 * h / w), (c, W2, H2) => {
    c.fillStyle = base; c.fillRect(0, 0, W2, H2);
    c.strokeStyle = 'rgba(120,100,90,.35)'; c.lineWidth = 2; for (let y = 0; y < H2; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(W2, y); c.stroke(); }
    if (arch) { c.strokeStyle = '#a88a70'; c.lineWidth = 8; c.beginPath(); c.moveTo(W2 * .06, H2); c.lineTo(W2 * .06, H2 * .45); c.quadraticCurveTo(W2 * .06, H2 * .04, W2 * .5, H2 * .04); c.quadraticCurveTo(W2 * .94, H2 * .04, W2 * .94, H2 * .45); c.lineTo(W2 * .94, H2); c.stroke(); }
    const ww = W2 * .7 / cols, wh = H2 * .7 / (rows + 1);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const x = W2 * .15 + k * W2 * .7 / cols + ww * .2, y = H2 * .2 + r * H2 * .78 / rows, w2 = ww * .6, h2 = Math.min(wh, H2 * .78 / rows * .7);
      c.fillStyle = glass; c.beginPath(); c.moveTo(x, y + h2); c.lineTo(x, y + ww * .3); c.arc(x + ww * .3, y + ww * .3, ww * .3, Math.PI, 0); c.lineTo(x + ww * .6, y + h2); c.closePath(); c.fill();
      c.strokeStyle = '#6a5a5a'; c.lineWidth = 3; c.stroke();
    }
  });
}
function mosqueEK(mats) {           // Edirnekapı: a tall cube, a thin dome on a drum, four corner turrets, ONE minaret
  const g = new THREE.Group();
  const B = 24, H = 20;
  const walls = new THREE.MeshLambertMaterial({ map: windowWall(B, H, { cols: 6, rows: 3 }) });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(B, H, B), walls); cube.position.y = H / 2; g.add(cube);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10, 3.6, 32), new THREE.MeshLambertMaterial({ map: windowWall(60, 3.6, { cols: 24, rows: 1, arch: false }) })); drum.position.y = H + 1.8; g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9.6, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.lead); dome.scale.y = .62; dome.position.y = H + 3.6; g.add(dome);
  const alem = new THREE.Mesh(new THREE.SphereGeometry(.5, 10, 8), mats.gold); alem.position.y = H + 3.6 + 6.2; g.add(alem);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 5, 12), mats.stone); t.position.set(x * B * .5, H + 2.5, z * B * .5); g.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.4, 12), mats.lead); c.position.set(x * B * .5, H + 6.2, z * B * .5); g.add(c);
  }
  const m = minaret(40, mats); m.position.set(-13 - 1.5, 0, 13 + 1.5); g.add(m);
  g.userData.minTop = m.userData.top;
  return g;
}
function mosqueUK(mats) {           // Üsküdar: a dome and three half domes spreading low and wide, a double portico (the skirts), two minarets
  const g = new THREE.Group();
  const walls = new THREE.MeshLambertMaterial({ map: windowWall(22, 11, { cols: 5, rows: 2 }) });
  const core = new THREE.Mesh(new THREE.BoxGeometry(22, 11, 20), walls); core.position.y = 5.5; g.add(core);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.4, 3, 32), new THREE.MeshLambertMaterial({ map: windowWall(50, 3, { cols: 20, rows: 1, arch: false }) })); drum.position.y = 12.5; g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.lead); dome.scale.y = .72; dome.position.y = 14; g.add(dome);
  const alem = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), mats.gold); alem.position.y = 20.2; g.add(alem);
  for (const [x, z, ry] of [[-11, 0, -Math.PI / 2], [11, 0, Math.PI / 2], [0, -10, Math.PI]]) {         // half domes on three sides
    const h = new THREE.Mesh(new THREE.SphereGeometry(6.4, 28, 12, 0, Math.PI, 0, Math.PI / 2), mats.lead); h.scale.y = .7; h.rotation.y = ry; h.position.set(x, 11, z); g.add(h);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 3, 20, 1, false, 0, Math.PI), mats.stone); wall.rotation.y = ry; wall.position.set(x, 9.5, z); g.add(wall);
  }
  // inner portico with five small domes
  const por = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 7), new THREE.MeshLambertMaterial({ map: windowWall(24, 7, { cols: 5, rows: 1, arch: false, glass: '#2a2a50' }) })); por.position.set(0, 3.5, 13.5); g.add(por);
  for (let k = -2; k <= 2; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.lead); d.position.set(k * 4.6, 7, 13.5); g.add(d); }
  // the outer portico: a low sloping roof that spreads out like a skirt
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(13, 17, 3.2, 4, 1, true), mats.lead); skirt.rotation.y = Math.PI / 4; skirt.scale.set(1.25, 1, .42); skirt.position.set(0, 4.4, 18.5); g.add(skirt);
  for (let k = -5; k <= 5; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 3.0, 10), mats.stone); c.position.set(k * 2.6, 1.5, 22.5); g.add(c); }
  for (const s of [-1, 1]) { const m = minaret(30, mats); m.position.set(s * 13.5, 0, 11); g.add(m); }
  return g;
}
function skyMat() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: true,
    uniforms: { sunAz: { value: 0 }, zen: { value: RAW('#2b2f78') }, warm: { value: RAW('#ff8a52') }, glow: { value: RAW('#ffd08a') }, cool: { value: RAW('#7b78d0') }, haze: { value: RAW('#c98aa8') }, dim: { value: 1 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position, 1.0)).xyz - (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float sunAz; uniform vec3 zen; uniform vec3 warm; uniform vec3 glow; uniform vec3 cool; uniform vec3 haze; uniform float dim; varying vec3 vD;
      void main(){
        float el = max(vD.y, 0.0);
        vec2 s = vec2(sin(sunAz), -cos(sunAz));
        float toward = dot(normalize(vD.xz), s) * 0.5 + 0.5;              // 1 = the sun's side
        vec3 hor = mix(cool, mix(haze, warm, smoothstep(0.45, 0.95, toward)), smoothstep(0.15, 0.75, toward));
        hor = mix(hor, glow, pow(toward, 14.0) * 0.8 * exp(-el * 9.0));
        vec3 c = mix(hor, zen, smoothstep(0.0, 0.55, el));
        gl_FragColor = vec4(c * dim, 1.0);
      }` });
}
function waterTex() {
  return canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#3a5ab8'; c.fillRect(0, 0, w, h); const R = rng(4);
    for (let i = 0; i < 260; i++) { c.strokeStyle = R() < .5 ? 'rgba(170,190,255,.45)' : 'rgba(40,50,130,.5)'; c.lineWidth = 3; const x = R() * w, y = R() * h, l = 20 + R() * 50; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 5, x + l, y); c.stroke(); }
  });
}
function buildCity(scene) {
  const g = new THREE.Group(); g.position.x = X.city; scene.add(g);
  const mats = { stone: painted(stoneTex({ base: '#efe4cc', bw: 64, bh: 32, rep: [3, 3] })), lead: flat('#8e9cc4'), gold: flat('#f0b846', { emissive: '#5a3a08' }) };
  // terrain: one displaced plane with vertex colours (sand at the shore, green slopes)
  const N = 200, SZ = 900, geo = new THREE.PlaneGeometry(SZ, SZ, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), cA = new THREE.Color('#d9b877'), cB = new THREE.Color('#6f9a55'), cC = new THREE.Color('#8aa860'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = landH(x, z); pos.setY(i, y);
    tmp.copy(cA).lerp(cB, S((y - 1.5) / 3)).lerp(cC, S((y - 18) / 20) * .6); col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.receiveShadow = true; g.add(ground);
  const wt = waterTex(); wt.repeat.set(30, 30);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), new THREE.MeshLambertMaterial({ map: wt })); water.rotation.x = -Math.PI / 2; water.position.y = .3; water.receiveShadow = true; g.add(water);
  // houses and cypresses
  const R = rng(17), hs = [], cy = [];
  for (let i = 0; i < 9000 && hs.length < 650; i++) {
    const x = (R() - .5) * 560, z = -400 + R() * 700, y = landH(x, z);
    if (y < 2.2) continue;
    if (Math.hypot(x - EK.x, z - EK.z) < 24 || Math.hypot(x - UK.x, z - UK.z - 6) < 26 || Math.hypot(x - VP.x, z - VP.z) < 14) continue;
    const s = .8 + R() * .7; hs.push([x, y, z, s, R() * Math.PI]);
    if (R() < .18) cy.push([x + 4, landH(x + 4, z + 3), z + 3, .8 + R() * .5]);
  }
  const hb = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 4, 5).translate(0, 2, 0), new THREE.MeshLambertMaterial(), hs.length);
  const rf = new THREE.InstancedMesh(new THREE.ConeGeometry(4.1, 2.4, 4).rotateY(Math.PI / 4).translate(0, 5.2, 0), flat('#c0503c'), hs.length);
  const pal = ['#f4dfb4', '#eec0a4', '#f6ecd8', '#cfdcec', '#f0cc7c', '#e6b4b4'].map(c => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  hs.forEach(([x, y, z, s, r], i) => { m4.compose(V(x, y - .6, z), q.setFromAxisAngle(V(0, 1, 0), r), V(s, s * (.8 + (i % 3) * .25), s)); hb.setMatrixAt(i, m4); rf.setMatrixAt(i, m4); hb.setColorAt(i, pal[i % pal.length]); });
  hb.castShadow = hb.receiveShadow = true; rf.castShadow = true; g.add(hb); g.add(rf);
  const tr = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 9, 8).translate(0, 4.5, 0), flat('#2f5a3e'), cy.length);
  cy.forEach(([x, y, z, s], i) => { m4.compose(V(x, y - .3, z), q.identity(), V(s, s, s)); tr.setMatrixAt(i, m4); }); tr.castShadow = true; g.add(tr);
  // the two mosques
  const ek = mosqueEK(mats); ek.position.copy(EK); ek.rotation.y = .08; g.add(ek);
  const uk = mosqueUK(mats); uk.position.copy(UK); uk.rotation.y = -.25; g.add(uk);
  ek.updateMatrixWorld(true);
  ek.updateMatrix(); EK_MIN.copy(V(-14.5, ek.userData.minTop * .97, 14.5).applyMatrix4(ek.matrix));
  dyn.ukTop = V(UK.x, 20, UK.z);
  // a pier and a few boats in front of Üsküdar
  const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 26), painted(woodTex({ base: '#8a5a34', rep: [2, 6] }))); pier.position.set(UK.x - 22, .6, UK.z + 22); g.add(pier);
  for (const [x, z, r] of [[48, -10, .4], [20, 30, -.6], [-10, -80, .2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 9), flat('#b8323a')); b.position.set(x, .8, z); b.rotation.y = r; g.add(b);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 7, 6), flat('#6a4a30')); mast.position.set(x, 4.5, z); g.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.4), flat('#f2ead8', { side: THREE.DoubleSide })); sail.position.set(x, 5.2, z + .4); sail.rotation.y = r + .5; g.add(sail);
  }
  // sky dome, sun and moon (the sun and moon are drawn over a depth copy of the world: the minaret cuts the sun)
  dyn.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMat()); g.add(dyn.sky);
  dyn.sun = new THREE.Mesh(new THREE.CircleGeometry(26, 64), new THREE.MeshBasicMaterial({ color: HDR(3.1, .42, .2) })); dyn.sun.layers.set(1); scene.add(dyn.sun);
  dyn.sunGlow = glow(scene, [0, 0, 0], '#ff4a2a', 300, .5);
  const moonT = canvasTex(256, 256, (c, w) => {
    c.fillStyle = '#fff6e8'; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 2, 0, 6.29); c.fill(); const R2 = rng(8);
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(190,180,200,.6)'; c.beginPath(); c.arc(60 + R2() * 140, 60 + R2() * 140, 8 + R2() * 18, 0, 6.29); c.fill(); }
  });
  dyn.moon = new THREE.Mesh(new THREE.CircleGeometry(17, 48), new THREE.MeshBasicMaterial({ map: moonT, color: HDR(1.5, 1.5, 1.6), transparent: true })); dyn.moon.layers.set(1); scene.add(dyn.moon);
  dyn.moonGlow = glow(scene, [0, 0, 0], '#b9c4ff', 170, .4);
  // lights: the low sun (key, long shadows), a violet sky fill
  const L = new THREE.Group();
  dyn.cHemi = new THREE.HemisphereLight('#9a9cf0', '#6a5068', 1.5); L.add(dyn.cHemi);
  const sun = new THREE.DirectionalLight('#ffa060', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -280, right: 280, top: 280, bottom: -280, near: 10, far: 1400 }); sun.shadow.bias = -.0008; sun.shadow.normalBias = .6;
  L.add(sun); L.add(sun.target); dyn.cSun = sun;
  scene.add(L); sets.city = { g, L };
  shadows(ek); shadows(uk);
}

// ---------------------------------------------------------------- INTERIOR of Edirnekapı (x = 3000)
function buildInside(scene) {
  const g = new THREE.Group(); g.position.x = X.inside; scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), painted(carpetTex({ base: '#b02c3a', band: '#e0b050', rep: [5, 5] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const st = painted(stoneTex({ base: '#e6dccb', bw: 128, bh: 64, rep: [6, 5] }));
  const Wd = 20, Hh = 15;
  for (const [x, z, ry] of [[0, -10, 0], [0, 10, Math.PI], [-10, 0, Math.PI / 2], [10, 0, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Hh), st); w.position.set(x, Hh / 2, z); w.rotation.y = ry; g.add(w);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(Wd, 1.4), painted(ciniTex({ kind: 'lale', rep: [Wd / .7, 2] }))); d.position.set(x, .7, z); d.rotation.y = ry; d.translateZ(.05); g.add(d);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(Wd, 1.1), painted(frizTex({ rep: [5, 1] }))); fr.position.set(x, 3.0, z); fr.rotation.y = ry; fr.translateZ(.05); g.add(fr);
  }
  // the windows: hundreds of small arched openings, brighter than white (they bloom), on the four walls and the drum
  const ash = new THREE.Shape(); ash.moveTo(-.38, -.6); ash.lineTo(.38, -.6); ash.lineTo(.38, .22); ash.absarc(0, .22, .38, 0, Math.PI, false); ash.lineTo(-.38, -.6);
  const wg = new THREE.ShapeGeometry(ash, 8), wins = [];
  for (const [x, z, ry] of [[0, -10, 0], [0, 10, Math.PI], [-10, 0, Math.PI / 2], [10, 0, -Math.PI / 2]])
    for (const [y, n] of [[5.0, 9], [7.6, 9], [10.2, 7], [12.6, 5]]) for (let k = 0; k < n; k++) {
      const u = (k - (n - 1) / 2) * (n > 7 ? 2.0 : 2.3);
      if (y > 9.5 && Math.abs(u) > 7 - (y - 10) * 1.6) continue;         // the windows of the tympanum follow its arch
      wins.push([x + Math.cos(ry) * u, y, z - Math.sin(ry) * u, ry]);
    }
  for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; wins.push([Math.sin(a) * 9.75, 16.2, Math.cos(a) * 9.75, a + Math.PI]); }
  const wm = new THREE.InstancedMesh(wg, new THREE.MeshBasicMaterial({ color: HDR(1.9, 1.75, 1.35) }), wins.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  wins.forEach(([x, y, z, ry], i) => { const o = V(x, y, z), n = V(Math.sin(ry), 0, Math.cos(ry)); o.addScaledVector(n, .06); m4.compose(o, q.setFromAxisAngle(V(0, 1, 0), ry), V(1, 1, 1)); wm.setMatrixAt(i, m4); });
  g.add(wm); dyn.nWindows = wins.length;
  // the drum and the dome (painted with its own light)
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 2.6, 64, 1, true), new THREE.MeshLambertMaterial({ color: '#e6dccb', side: THREE.BackSide })); drum.position.y = 16.2; g.add(drum);
  const pend = new THREE.Mesh(new THREE.TorusGeometry(10, .3, 8, 64), flat('#d9a441')); pend.rotation.x = Math.PI / 2; pend.position.y = 14.9; pend.userData.noShadow = true; g.add(pend);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: domeTex({ windows: 32 }), side: THREE.BackSide })); dome.position.y = 17.5; dome.scale.y = .7; g.add(dome);
  const ceil = new THREE.Shape(); ceil.moveTo(-10, -10); ceil.lineTo(10, -10); ceil.lineTo(10, 10); ceil.lineTo(-10, 10); ceil.closePath(); const hole = new THREE.Path(); hole.absarc(0, 0, 9.95, 0, Math.PI * 2, true); ceil.holes.push(hole);
  const cm = new THREE.Mesh(new THREE.ShapeGeometry(ceil, 48), flat('#d9c9a8', { side: THREE.DoubleSide })); cm.rotation.x = Math.PI / 2; cm.position.y = Hh; g.add(cm);
  // the "sarkıtlar": a ring of lamps on long chains hanging from the dome
  const iron = flat('#2a2630'), ring = 5.2, n = 40, LS = 1.6;
  const tor = new THREE.Mesh(new THREE.TorusGeometry(ring, .04, 6, 128), iron); tor.rotation.x = Math.PI / 2; tor.position.y = 3.3; tor.userData.noShadow = true; g.add(tor);
  const lamps = new THREE.InstancedMesh(kandilParts.geo(), new THREE.MeshBasicMaterial({ map: kandilParts.tex(), color: HDR(1.2, 1.15, 1.05), side: THREE.DoubleSide }), n);
  const flames = new THREE.InstancedMesh(kandilParts.flame(), new THREE.MeshBasicMaterial({ color: HDR(3.3, 2.05, .6) }), n);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; m4.makeScale(LS, LS, LS).setPosition(Math.cos(a) * ring, 3.2, Math.sin(a) * ring); lamps.setMatrixAt(i, m4); flames.setMatrixAt(i, m4); }
  g.add(lamps); g.add(flames); dyn.iFlames = flames;
  for (let i = 0; i < 24; i++) {
    const a = (i + .5) / 24 * Math.PI * 2, p0 = V(Math.cos(a) * ring, 3.3, Math.sin(a) * ring), p1 = V(Math.cos(a) * 1.4, 23, Math.sin(a) * 1.4);
    const len = p0.distanceTo(p1), c = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, len, 5), iron);
    c.position.copy(p0).lerp(p1, .5); c.lookAt(V(p1.x + X.inside, p1.y, p1.z)); c.rotateX(Math.PI / 2); c.userData.noShadow = true; g.add(c);
  }
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#b8c4ff', '#7a6a8e', 2.0));
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; const pl = new THREE.PointLight('#ffca7c', 7, 10, 1.6); pl.position.set(X.inside + Math.cos(a) * 5, 2.8, Math.sin(a) * 5); L.add(pl); }
  const sun = keySpot('#ffd9a0', 3.2, [X.inside - 22, 26, -10], [X.inside + 2, 0, 2], .5, { near: 8, far: 70 }); L.add(sun); L.add(sun.target);
  scene.add(L); sets.inside = { g, L };
  shadows(g);
  dyn.iBeams = [];
  for (const [x, y, z] of [[-9.8, 10.2, -2], [-9.8, 7.6, 2], [-9.8, 12.6, 0], [-6, 16.2, -7.8], [-9.8, 5.0, -4], [-8, 16.2, 5.5]]) {
    const from = V(X.inside + x, y, z), dir = V(1, -.78, .35).normalize();
    dyn.iBeams.push(beam(scene, from.toArray(), from.clone().addScaledVector(dir, y / .78).toArray(), { r0: .45, r1: 1.4, color: '#ffe2b0', strength: .14 }));
  }
}

// ---------------------------------------------------------------- CAST
export const LOOK = {
  sinan: { hat: 'sarik-big', beard: '#e4ded6', mustache: '#cfc6bc', body: 'robe', cloth: '#2d7466', trim: '#e0aa3e', sash: '#b8323a', height: 1.74 },
  mihrimah: { hat: 'tac', body: 'gown', cloth: '#d2486a', clothDark: '#8e2a52', trim: '#f2c85a', longHair: '#3a2232', lashes: true, blush: '#ff7a8a', collar: false, height: 1.6, headW: 252, headH: 238, bodyW: 170 },
  bostanci: { hat: 'kulah', hatColor: '#b8323a', cloth: '#3a5aa8', buttons: '#e0aa3e', mustache: true, hair: '#2e2026', height: 1.72 },
};

// ---------------------------------------------------------------- CAMERA (seconds come from words)
const SINAN_ST = V(-.1, 0, -.95), SINAN_CARVE = V(.92, 0, .22);
const P_SINAN = V(-1.25, 0, .22), P_GUARD = V(2.15, 0, -1.9), P_MIH0 = V(1.6, 0, -.9), P_MIH1 = V(.15, 0, -.75);
const VP_S = V(VP.x, VP.y - 1.6, VP.z);       // where Sinan stands on the hill
const at = (p, x) => [p.x + x, p.y, p.z];
function cameraPath() {
  const t = W, cx = X.city, px = X.palace, ix = X.inside;
  const toward = (p, k) => VP.clone().lerp(p, k);
  const ekMin = V(EK_MIN.x, EK_MIN.y * .78, EK_MIN.z), c1 = toward(EK_MIN, .42), c2 = toward(dyn.ukTop, .42);
  const hill = VP_S, mid = EK.clone().lerp(UK, .5).setY(20), dirMid = mid.clone().sub(VP).setY(0).normalize();
  const behind = d => VP_S.clone().addScaledVector(dirMid, -d).add(V(-dirMid.z * .8, 1.2, dirMid.x * .8));
  const wide = VP.clone().addScaledVector(dirMid, -40).add(V(0, 34, 0));
  const keys = [
    // hook: Sinan at his desk -> he looks out of the window -> the two mosques -> the sun behind one, the moon behind the other
    { t: 0, pos: [.85, 1.32, 1.35], look: [-.15, 1.28, -.9], fov: 40, creep: .3, drift: .04 },
    { t: t('aşamadığı') + .1, dur: .7, pos: [-1.0, 1.4, 1.2], look: [.55, 1.5, -1.6], fov: 44, creep: .28, drift: .03 },
    { t: t('iki') + .1, dur: .3, move: 'whip', pos: [cx + wide.x, wide.y, wide.z], look: [cx + mid.x, mid.y, mid.z], fov: 46, creep: .27, drift: .6 },
    { t: t('biri') + .35, dur: .8, pos: [cx + c1.x, c1.y, c1.z], look: [cx + ekMin.x, ekMin.y + 4, ekMin.z], fov: 30, creep: .3, drift: .5 },
    { t: t('öbürü') + .35, dur: .8, pos: [cx + c2.x, c2.y, c2.z], look: [cx + dyn.ukTop.x, dyn.ukTop.y + 4, dyn.ukTop.z], fov: 30, creep: .3, drift: -.5 },
    // "Bakın": the palace courtyard; Sinan behind the column, Mihrimah walks in
    { t: t('Bakın') + .12, dur: .3, move: 'whip', pos: [px - .7, 1.55, 5.4], look: [px + .25, 1.15, -.8], fov: 50, creep: .26, drift: .05 },
    { t: t('Sinan', 2) + .35, dur: .6, pos: [px - 2.4, 1.45, 2.3], look: [px - 1.4, 1.35, .1], fov: 38, creep: .3, drift: .04 },
    { t: t('padişahın') + .35, dur: .8, pos: [px + .9, 1.32, 2.5], look: [px + .4, 1.2, -.85], fov: 38, creep: .28, drift: -.05 },
    { t: t('deliler') + .25, dur: .55, pos: [px - 2.0, 1.65, 2.6], look: [px - 1.3, 1.6, .2], fov: 34, creep: .32, drift: .03 },
    // "Kavuşmak mı? Olacak iş değil.": the guard laughs, the gate closes
    { t: t('Kavuşmak') + .2, dur: .5, pos: [px + 1.4, 1.55, 1.7], look: [px + 2.3, 1.3, -1.9], fov: 40, creep: .28, drift: .05 },
    // "Sinan da aşkını taşa yazıyor.": the stone, the chisel
    { t: t('Sinan', 3) + .05, dur: .3, move: 'whip', pos: [2.35, 1.4, 3.2], look: [1.3, .9, .3], fov: 46, creep: .3, drift: .04 },
    // Üsküdar from the water; the skirts
    { t: t('Önce') + .1, dur: .3, move: 'whip', pos: [cx + UK.x - 42, 5, UK.z + 68], look: [cx + UK.x - 2, 9, UK.z], fov: 38, creep: .28, drift: .4 },
    { t: t('uzaktan') + .3, dur: 1.2, pos: [cx + UK.x - 66, 16, UK.z + 110], look: [cx + UK.x, 12, UK.z], fov: 36, creep: .26, drift: .3 },
    // Edirnekapı: up the hill -> the single minaret -> the thin dome
    { t: t('Sonra') + .1, dur: .32, move: 'whip', pos: [cx + EK.x + 22, EK.y - 9, EK.z + 75], look: [cx + EK.x, EK.y + 14, EK.z], fov: 44, creep: .26, drift: .4 },
    { t: t('tepelerinden') + .4, dur: 1.2, pos: [cx + EK.x + 30, EK.y + 22, EK.z + 58], look: [cx + EK.x - 4, EK.y + 16, EK.z], fov: 42, creep: .27, drift: .4 },
    { t: t('Tek') + .3, dur: .7, pos: [cx + EK.x + 8, EK.y + 12, EK.z + 46], look: [cx + EK.x - 14.5, EK.y + 34, EK.z + 14.5], fov: 34, creep: .3, drift: .2 },
    { t: t('incecik') + .35, dur: .8, pos: [cx + EK.x + 20, EK.y + 34, EK.z + 32], look: [cx + EK.x, EK.y + 24, EK.z], fov: 38, creep: .3, drift: .3 },
    // inside: hundreds of windows, then down the chains of the lamps
    { t: t('kubbeyi') + .15, dur: .3, move: 'whip', pos: [ix + 1.5, 1.7, 7.5], look: [ix - .4, 17, -2], fov: 66, creep: .24, drift: .1 },
    { t: t('İçerideki') + .45, dur: 1.4, pos: [ix + 3.2, 2.8, 8.4], look: [ix - .5, 5.5, -2], fov: 52, creep: .27, drift: .12 },
    // her hair, from the crown down to the heels
    { t: t('onun') + .05, dur: .3, move: 'whip', pos: [px + .2, 1.55, 1.45], look: [px + .15, 1.42, -.75], fov: 36, creep: .2, drift: .02 },
    { t: t('dökülen') + .3, dur: 1.2, pos: [px + .25, .75, 1.6], look: [px + .15, .32, -.75], fov: 42, creep: .25, drift: .02 },
    // the hill: both mosques; 21 March; the sun behind the minaret, the moon behind Üsküdar
    { t: t('Şimdi') + .1, dur: .32, move: 'whip', pos: [cx + behind(7).x, behind(7).y + 1.0, behind(7).z], look: [cx + mid.x, mid.y, mid.z], fov: 50, creep: .25, drift: .15 },
    { t: t('21') + .2, dur: .6, pos: [cx + hill.x + 2.0, hill.y + 1.55, hill.z + 3.4], look: [cx + hill.x + .15, hill.y + 1.5, hill.z], fov: 44, creep: .28, drift: .04 },
    { t: t('gece') + .9, dur: .9, pos: [cx + behind(9).x, behind(9).y + 1.6, behind(9).z], look: [cx + mid.x, mid.y + 10, mid.z], fov: 54, creep: .24, drift: .2 },
    { t: t('Edirnekapı\'nın') + .3, dur: 1.0, pos: [cx + c1.x, c1.y + 1, c1.z], look: [cx + ekMin.x, ekMin.y + 2, ekMin.z], fov: 28, creep: .26, drift: .3 },
    { t: t('Üsküdar\'ın') + .3, dur: 1.0, pos: [cx + c2.x, c2.y + 1, c2.z], look: [cx + dyn.ukTop.x, dyn.ukTop.y + 6, dyn.ukTop.z], fov: 28, creep: .26, drift: -.3 },
    { t: t('Mart') + .1, dur: 1.2, pos: [cx + behind(10).x, behind(10).y + 1.2, behind(10).z], look: [cx + mid.x, mid.y + 12, mid.z], fov: 56, creep: .24, drift: .12 },
    { t: t('Çünkü') + .3, dur: 1.0, pos: [cx + hill.x + 1.6, hill.y + 1.6, hill.z + 2.9], look: [cx + hill.x - .1, hill.y + 1.5, hill.z - 1], fov: 36, creep: .3, drift: .03 },
  ];
  const cp = new CamPath(keys, { fps: FPS });
  cp.kick(t('deliler') + .05, .6); cp.kick(t('değil.') + .05, .8);
  return cp;
}

// ---------------------------------------------------------------- SUN AND MOON over time
function sunEl(t) {
  const T = W;
  if (t < T('Bakın')) return 6.5;          // the hook: the sun sits on the minaret's balcony
  return lerpN(lerpN(13, 6.5, ramp(t, T('Şimdi'), T('Edirnekapı\'nın'))), -2.5, ramp(t, T('Edirnekapı\'nın') + .3, T('Mihrimah\'ın') + .4));
}
function moonEl(t) {
  const T = W;
  if (t < T('Bakın')) return 5.5;
  return lerpN(-3.5, 7, ramp(t, T('Üsküdar\'ın') - .2, T('Mihrimah\'ın') + .6)) + 2 * ramp(t, T('Çünkü'), T('Çünkü') + 3);
}

// ---------------------------------------------------------------- SETUP
export async function setup(ctx) {
  C = ctx; W = wordTimes(ctx.words);
  DUR = Math.ceil((ctx.words[ctx.words.length - 1].end + .6) * FPS) / FPS;
  const { scene, cam } = ctx;
  cam.far = 2600; cam.updateProjectionMatrix();
  scene.background = new THREE.Color('#1a1f3a');
  buildStudy(scene); buildPalace(scene); buildCity(scene); buildInside(scene);
  for (const [k, l] of Object.entries(LOOK)) cast[k] = new Toon(l, scene);
  // the giant, translucent Mihrimah over Üsküdar ("etekleri yerleri süpüren bir kadın")
  cast.ghost = new Toon(LOOK.mihrimah, scene);
  cast.ghost.mat.depthTest = false; cast.ghost.mat.depthWrite = false; cast.ghost.mesh.renderOrder = 30;
  dyn.armC = new Arm3D(scene, cast.sinan);
  // a calendar page for "21 Mart"
  dyn.cal = card(scene, .5, .56, (c, w, h) => {
    c.lineJoin = 'round';
    c.fillStyle = '#fbf3e0'; c.strokeStyle = PLUM; c.lineWidth = 16; c.beginPath(); c.roundRect(14, 30, w - 28, h - 44, 34); c.fill(); c.stroke();
    c.fillStyle = '#c8324a'; c.beginPath(); c.roundRect(14, 30, w - 28, 120, [34, 34, 0, 0]); c.fill(); c.stroke();
    for (const x of [.3, .7]) { c.fillStyle = '#8a8fa8'; c.beginPath(); c.roundRect(w * x - 12, 6, 24, 60, 10); c.fill(); c.stroke(); }
    c.fillStyle = '#fff'; c.font = '900 76px "Segoe UI Black", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MART', w / 2, 92);
    c.fillStyle = '#2a1a2c'; c.font = '900 230px "Segoe UI Black", "Arial Black", sans-serif'; c.fillText('21', w / 2, h * .62);
  });
  dyn.bheart = card(scene, 30, 30, (c, w) => heart(c, w / 2, w / 2 + 20, w * .3, '#ff5a78'), 256);
  // sparks from the chisel, dust in the beams
  smokes.sparks = new Smoke(scene, { color: '#ffe0a0', maxPoints: 300, H: ctx.H, additive: true });
  smokes.sparks.wisps.push({ n: 40, size: .02, alpha: .9, speed: 1.4, on: t => t >= W('taşa') - .1 && t < W('Önce'),
    path: (u, t, i) => { const a = i * 2.39 + Math.floor(t * 6), tip = dyn.chiselTip || STONE; return [tip.x + Math.cos(a) * u * .25, tip.y + Math.sin(u * 3) * .12 - u * u * .2, tip.z + .02 + u * .12]; } });
  smokes.motes = new Smoke(scene, { color: '#fff0d0', maxPoints: 900, H: ctx.H, additive: true, near: 2.6 });
  const hash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const motes = (n, c, sz, on, size = .008) => smokes.motes.wisps.push({ n, size, alpha: .5, speed: .05, on,
    path: (u, t, i) => [c[0] + (hash(i, 1) - .5) * sz[0] + Math.sin(t * .5 + i) * .06, c[1] + (hash(i, 2) - .5) * sz[1] + (u - .5) * .5, c[2] + (hash(i, 3) - .5) * sz[2] + Math.cos(t * .4 + i * 2) * .06] });
  motes(120, [.6, 1.4, -.6], [3, 2, 3], t => t < W('iki') || (t >= W('Sinan', 3) && t < W('Önce')));
  motes(260, [X.inside - 2, 7, 0], [14, 12, 14], t => t >= W('kubbeyi') && t < W('onun'), .03);
  dyn.cam = cameraPath();
  // sound cue table for audio/mix.py
  const cue = (t, type, extra = {}) => CUES.push({ t: +t.toFixed(3), type, ...extra });
  cue(W('Bakın') - .1, 'whoosh'); cue(W('Önce') - .12, 'whoosh'); cue(W('Şimdi') - .1, 'whoosh');     // keep these three first: mix.py reads the sets from them
  cue(W('iki') - .05, 'rise', { dur: .5 }); cue(W('Sinan', 3) - .1, 'rise', { dur: .4 }); cue(W('Sonra') - .1, 'rise', { dur: .4 }); cue(W('kubbeyi') - .05, 'rise', { dur: .4 }); cue(W('onun') - .1, 'rise', { dur: .4 });
  cue(W('deliler') + .05, 'shimmer'); cue(W('Kavuşmak') + .2, 'laugh', { dur: W('Sinan', 3) - W('Kavuşmak') - .3 }); cue(W('değil.') + .05, 'boom');
  cue(W('taşa') - .1, 'scrape', { dur: W('Önce') - W('taşa') }); cue(W('kadın.') - .2, 'shimmer'); cue(W('kubbeyi') + .2, 'wind', { dur: 3.0 });
  cue(W('21') + .15, 'lock'); cue(W('kıpkırmızı'), 'wind', { dur: 2.6 }); cue(W('doğum') - .1, 'shimmer'); cue(W('demek.') - .2, 'shimmer');
}

// ---------------------------------------------------------------- PER FRAME
const vis = (set, on) => { sets[set].g.visible = on; sets[set].L.visible = on; };
const WARM = '#ffb45a', NIGHT = '#d6d1f2', DUSK = '#e2d6ee';
const STONE_TIP = p => { const q = carvePath(Math.min(.999, p)); return V(STONE.x - .3 + q[0] / 512 * .6, .52 + .25 - q[1] / 512 * .5, .54); };
export function frame(t, ctx) {
  const { cam, env } = ctx;
  const cp = dyn.cam.apply(cam, t);
  const x = cam.position.x;
  const where = x < 500 ? 'study' : x < 1500 ? 'palace' : x < 2500 ? 'city' : 'inside';
  for (const s of ['study', 'palace', 'city', 'inside']) vis(s, s === where);
  const T = W, A = (w, n) => W(w, n) - 2 / FPS;
  const bl = (seed, ...swaps) => blinkAt(t, seed, swaps, FPS);
  for (const c of Object.values(cast)) c.hide();
  dyn.armC.hide(); dyn.chisel.visible = false; dyn.cal.visible = false; dyn.bheart.visible = false; dyn.hearts.forEach(h => h.visible = false);
  dyn.sun.visible = dyn.moon.visible = dyn.sunGlow.visible = dyn.moonGlow.visible = where === 'city';
  dyn.stBeam.visible = where === 'study'; dyn.pBeam.visible = where === 'palace'; dyn.iBeams.forEach(b => { b.visible = where === 'inside'; b.material.uniforms.uT.value = t; });
  const tint = FACE[where].map((v, i) => v / GRADE[where][i]);

  if (where === 'study') {
    dyn.studyLamp.flicker(t);
    const carving = t > T('Sinan', 3) - .2;
    if (!carving) {
      // the hook: drawing the plan, then the look out of the window
      cast.sinan.show(); cast.sinan.place(SINAN_ST.x, 0, SINAN_ST.z, cam, tint);
      const sigh = ramp(t, A('aşamadığı') - .1, A('aşamadığı') + .35);
      cast.sinan.draw({ expr: sigh > .5 ? 'worried' : 'focused', look: lerpN(-.2, .75, sigh), lookY: lerpN(.7, -.2, sigh), gazeY: lerpN(1, -.3, sigh), blink: bl(1, A('aşamadığı') + .1),
        armR: [lerpN(60, 30, sigh), lerpN(55, 20, sigh)], propR: 'pen', armL: [lerpN(50, 18, sigh), lerpN(70, 10, sigh)], tilt: lerpN(4, -5, sigh),
        lit: -1, shade: NIGHT, rim: { color: WARM, a: .42 } });
      cast.sinan.castFrom(dyn.studyLamp.flameAt());
    } else {
      // "taşa yazıyor": the chisel cuts the sun and the moon into the stone; his 3D hand holds the chisel
      const p = lin(t, A('aşkını'), A('Önce') - .25);
      drawCarve(p);
      const tip = STONE_TIP(p); dyn.chiselTip = tip;
      const hit = Math.abs(Math.sin(t * 13)) ** 4;
      dyn.chisel.visible = true; dyn.chisel.position.copy(tip).add(V(0, 0, .01 + hit * .015));
      dyn.chisel.quaternion.setFromUnitVectors(V(0, 1, 0), V(-.55, .25, .8).normalize());
      cast.sinan.show(); cast.sinan.place(SINAN_CARVE.x, 0, SINAN_CARVE.z, cam, tint);
      cast.sinan.draw({ expr: p > .55 ? 'proud' : 'focused', look: .7, lookY: .35, gazeX: 1, blink: bl(1, A('yazıyor.')), noArmR: true, armL: [lerpN(90, 140, hit), 60], propL: 'mallet', lit: -1, shade: NIGHT, rim: { color: WARM, a: .38 } });
      dyn.chisel.updateMatrixWorld(); dyn.armC.set(1, dyn.chisel.localToWorld(V(0, .17, 0)), { sag: .05, tint });
      cast.sinan.castFrom(dyn.studyLamp.flameAt());
    }
  } else if (where === 'palace') {
    dyn.pLamps.forEach(k => k.flicker(t));
    const hairShot = t > T('onun') - .3;
    const walk = hairShot ? 1 : lin(t, T('Bakın'), T('Mihrimah') + .4);
    const mp = P_MIH0.clone().lerp(P_MIH1, S(walk)), walking = walk > 0 && walk < 1;
    cast.mihrimah.show(); cast.mihrimah.place(X.palace + mp.x, 0, mp.z, cam, tint);
    cast.mihrimah.castFrom(V(X.palace - .3, 1.9, -1.4));
    const leave = ramp(t, A('Olacak'), A('Sinan', 3));
    cast.mihrimah.draw({ expr: 'smile', lid: -.1, look: hairShot ? .15 : -.6, lookY: .1, blink: bl(7, A('Mihrimah')), bob: walking ? -Math.abs(Math.sin(t * 7)) * 7 : 0, sway: Math.sin(t * (hairShot ? 2.2 : 3.5)) * (hairShot ? .7 : .5),
      armL: [14, 30], armR: [lerpN(14, 40, leave), 30], lit: 1, shade: NIGHT, rim: { color: WARM, a: .38 } });
    if (!hairShot) {
      // Sinan peeks from behind the column
      const love = t > A('deliler'), worried = t > A('Sinan', 2) && t < A('padişahın');
      cast.sinan.show(); cast.sinan.place(X.palace + P_SINAN.x, 0, P_SINAN.z, cam, tint);
      cast.sinan.draw({ expr: love ? (t > A('Kavuşmak') ? 'worried' : 'grin') : worried ? 'worried' : 'smile', look: .8, lookY: .1, brow: love ? .8 : 0, blink: bl(1, A('Sinan', 2), A('deliler'), A('Kavuşmak')), sweat: worried ? 1 : 0,
        armR: [70, 40], armL: [15, 20], lean: love && t < A('Kavuşmak') ? 5 + Math.sin(t * 6) * 2 : 3, bob: love && t < A('Kavuşmak') ? -Math.abs(Math.sin(t * 9)) * 8 : 0, lit: 1, shade: NIGHT, rim: { color: WARM, a: .35 } });
      cast.sinan.castFrom(V(X.palace - .3, 1.9, -1.4));
      // hearts float up from his head
      if (t > A('deliler') && t < A('Kavuşmak') + .3) dyn.hearts.forEach((h, i) => {
        const k = (t - A('deliler') - i * .22); if (k < 0) return;
        const head = cast.sinan.toWorld(0, 120, .1);
        h.visible = true; h.position.set(head.x + Math.sin(i * 2 + k * 3) * .12 + (i - 1) * .14, head.y + .1 + k * .32, head.z); h.lookAt(cam.position);
        h.scale.setScalar(.3 + .7 * backOut(k / .25)); h.material.opacity = 1 - lin(k, .7, 1.1);
      });
      // the guard: shakes his head, laughs
      const laugh = t > A('Kavuşmak') && t < A('Sinan', 3);
      cast.bostanci.show(); cast.bostanci.place(X.palace + P_GUARD.x, 0, P_GUARD.z, cam, tint);
      cast.bostanci.draw({ expr: laugh ? (t > A('Olacak') ? 'laugh' : 'smug') : 'neutral', look: laugh ? (t > A('Olacak') ? Math.sin(t * 11) * .6 : -.4) : -.3, blink: bl(3, A('Kavuşmak'), A('Olacak')), laughMarks: t > A('Olacak') ? .9 : 0,
        mouth: laugh ? .5 + .5 * Math.abs(Math.sin(t * 13)) : 0, armL: [laugh ? 140 : 20, laugh ? 20 : 10], armR: [20, 10], bob: t > A('Olacak') ? -Math.abs(Math.sin(t * 13)) * 10 : 0, lit: -1, shade: NIGHT, rim: { color: WARM, a: .35 } });
      cast.bostanci.castFrom(V(X.palace - .3, 1.9, -1.4));
    }
    const shut = ramp(t, A('değil.') - .25, A('değil.') + .05);
    dyn.gate.forEach(({ pv, s }) => { pv.rotation.y = s * (1 - shut) * 1.3; });
  } else if (where === 'city') {
    // sun and moon, by azimuth / elevation from the viewer's hill (they sit behind the minaret / behind Üsküdar)
    const sunAz = azTo(EK_MIN) + .004, moonAz = azTo(dyn.ukTop) - .02;
    const sd = skyDir(sunAz, sunEl(t) * DEG), md = skyDir(moonAz, moonEl(t) * DEG);
    const sp = VP.clone().addScaledVector(sd, 800).add(V(X.city, 0, 0)), mpos = VP.clone().addScaledVector(md, 800).add(V(X.city, 0, 0));
    const pulse = (w, n) => 1 + .18 * Math.exp(-(((t - W(w, n)) * 4) ** 2));
    dyn.sun.position.copy(sp); dyn.sun.lookAt(cam.position); dyn.sun.scale.setScalar(pulse('güneş', 2));
    dyn.moon.position.copy(mpos); dyn.moon.lookAt(cam.position); dyn.moon.scale.setScalar(pulse('ay', 2));
    dyn.sunGlow.position.copy(sp); dyn.moonGlow.position.copy(mpos);
    dyn.sky.material.uniforms.sunAz.value = sunAz;
    const dim = t < T('Bakın') ? 1 : lerpN(1, .78, ramp(t, T('Edirnekapı\'nın'), T('Çünkü')));
    dyn.sky.material.uniforms.dim.value = dim;
    const sl = Math.max(4, sunEl(t)) * DEG;
    dyn.cSun.position.copy(V(X.city, 0, 20).add(skyDir(sunAz, sl).multiplyScalar(600))); dyn.cSun.target.position.set(X.city, 0, 20);
    dyn.cSun.intensity = 2.6 * lerpN(.35, 1, S((sunEl(t) + 2) / 8)); dyn.cHemi.intensity = 1.5 * dim;
    // the giant translucent Mihrimah over Üsküdar
    const gh = ramp(t, A('etekleri') - .1, A('kadın.')) * (1 - ramp(t, A('Sonra') - .25, A('Sonra')));
    if (gh > .01) {
      cast.ghost.show(); cast.ghost.shadow.visible = cast.ghost.caster.visible = false;
      cast.ghost.place(X.city + UK.x, UK.y - 2, UK.z + 4, cam, [1, 1, 1], 21);
      cast.ghost.mat.opacity = .42 * gh;
      cast.ghost.draw({ expr: 'smile', look: -.2, blink: bl(9), flare: .55, sway: Math.sin(t * 1.5) * .4, armL: [20, 30], armR: [20, 30], lit: 1, shade: DUSK });
    }
    // Sinan on the hill
    const onHill = t > T('Şimdi') - .3;
    if (onHill) {
      cast.sinan.show(); cast.sinan.place(X.city + VP_S.x, VP_S.y, VP_S.z, cam, tint);
      const end = t > A('Çünkü');
      cast.sinan.draw({ expr: end ? 'proud' : t > A('Mart') ? 'smile' : t > A('21') && t < A('gece') ? 'smug' : 'neutral', look: end ? -.55 : -.3, lookY: end ? -.55 : -.3, brow: end ? .5 : 0, blink: bl(1, A('21'), A('gece'), A('Mart'), A('Çünkü')),
        armR: t > A('21') && t < A('gece') ? [120, 30] : [16, 30], armL: [18, 60], propL: 'scroll', lit: -1, shade: DUSK, rim: { color: '#ff9a5a', a: .45 } });
      cast.sinan.castFrom(V(-sd.x, -sd.y, -sd.z), true);
      // the calendar page pops beside him
      const ck = t - A('21');
      if (ck > 0 && t < A('gece') + .6) {
        const head = cast.sinan.toWorld(250, 160, .1);
        dyn.cal.visible = true; dyn.cal.position.copy(head); dyn.cal.lookAt(cam.position);
        dyn.cal.scale.setScalar(.2 + .8 * backOut(ck / .18)); dyn.cal.rotation.z += Math.sin(ck * 30) * .2 * Math.exp(-ck * 7);
      }
    }
    // a heart between the sun and the moon for the birthday
    const hk = t - A('doğum');
    if (hk > 0 && t < T('Çünkü') + .5) {
      const p = sp.clone().lerp(mpos, .5); p.y += 40; p.lerp(cam.position, .25);
      dyn.bheart.visible = true; dyn.bheart.position.copy(p); dyn.bheart.lookAt(cam.position);
      dyn.bheart.scale.setScalar((.2 + .8 * backOut(hk / .25)) * (1 + .05 * Math.sin(t * 9))); dyn.bheart.material.opacity = 1 - ramp(t, T('Çünkü'), T('Çünkü') + .5);
    }
  } else {
    // inside: the lamp flames flicker
    const M4 = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, f = 1.6 * (1 + .16 * Math.sin(t * (19 + i % 7) + i * 2.4) * Math.sin(t * 11 + i)); M4.makeScale(1.6, f, 1.6).setPosition(Math.cos(a) * 5.2, 3.12, Math.sin(a) * 5.2); dyn.iFlames.setMatrixAt(i, M4); }
    dyn.iFlames.instanceMatrix.needsUpdate = true;
  }
  for (const s of Object.values(smokes)) s.update(t);
  // ---- look (lens, grade) per set / beat
  const focusOn = (p, coc, range) => ({ focus: cam.position.distanceTo(p), coc, range });
  let look;
  if (where === 'study') look = { ...focusOn(t < T('Sinan', 3) - .2 ? V(SINAN_ST.x, 1.3, SINAN_ST.z) : STONE, 6, 1.6), sat: 1.15, lift: [.1, .09, .17], bloom: .85, vignette: .22 };
  else if (where === 'palace') {
    const f = t > T('onun') - .3 ? V(X.palace + P_MIH1.x, 1.0, P_MIH1.z) : t < T('Sinan', 2) ? V(X.palace + .8, 1.2, -.8) : t < T('padişahın') ? V(X.palace + P_SINAN.x, 1.4, P_SINAN.z) : t < T('deliler') ? cast.mihrimah.mesh.position.clone().add(V(0, 1.2, 0)) : t < T('Kavuşmak') ? V(X.palace + P_SINAN.x, 1.5, P_SINAN.z) : V(X.palace + P_GUARD.x, 1.4, P_GUARD.z);
    look = { ...focusOn(f, 6, 2.2), sat: 1.2, lift: [.108, .092, .175], bloom: .85, vignette: .24 };
  } else if (where === 'city') {
    const onHill = t > T('Şimdi') - .3 && !(t > T('Edirnekapı\'nın') && t < T('Mart'));
    look = onHill && (t < T('gece') || t > T('Çünkü')) ? { ...focusOn(V(X.city + VP_S.x, VP_S.y + 1.4, VP_S.z), 4, 3) } : { focus: 80, coc: 0, range: 80 };
    Object.assign(look, { sat: 1.18, lift: [.11, .085, .16], bloom: 1.0, vignette: .2 });
  } else look = { focus: 12, coc: 0, range: 12, sat: 1.1, lift: [.1, .095, .15], bloom: .95, vignette: .18 };
  look.tint = GRADE[where];
  look.blur = cp.moving > .15 ? 16 : 0;
  return look;
}
const GRADE = { study: [1, .98, 1.02], palace: [1, .98, 1.03], city: [1.03, .98, .98], inside: [1.03, 1.0, .96] };
const FACE = { study: [1, .985, .97], palace: [1, .985, .97], city: [1, .97, .95], inside: [1, .99, .96] };
