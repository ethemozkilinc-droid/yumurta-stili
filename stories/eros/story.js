// Eros ve Psyche — the myth as Apuleius tells it, in 63 s: Aphrodite sends Eros to make Psyche love the worst of men;
// he falls for her himself, hides her in a palace, forbids her to see his face; the sisters, the lamp, the drop of oil;
// Aphrodite's tasks, the box, the sleep; Zeus makes her immortal. "Psyche" is Greek for "soul" (and "butterfly").
// Sets (far apart in x): OLYMPOS (x≈0), TEMPLE (x≈1000), PALACE (x≈2000), UNDERWORLD (x≈3000).
// Every cue is pinned to a word of voice/words.json (W('word', n) = start of the n-th match).
// Light, per set (the light source is IN the picture, warm against cool, real cast shadows):
//   olympos     a low golden sun among the clouds (warm key, long shadows) against a blue sky
//   temple      a warm afternoon sun on marble against a cool blue sky and blue shade
//   palace      night: cool moonlight through the window; a warm oil lamp (and Psyche's own lamp) makes the pools
//   underworld  teal glow of the Styx (cool) against two warm torches
import * as THREE from 'three';
import { stoneTex, woodTex, carpetTex, tileTex, frizTex, painted, flat, rng } from '/engine/src/paint.js';
import { Toon, Arm3D, PLUM, flap, blinkAt } from '/engine/src/toon.js';
import { CamPath, smoother } from '/engine/src/camera.js';
import { Smoke, ribbon, beam, glow } from '/engine/src/fx.js';
import { kandil } from '/engine/src/props.js';

export const NAME = 'eros';
export const FPS = 30;
export let DUR = 64;
export const CUES = [];

const S = smoother;
const ramp = (t, a, b) => S((t - a) / (b - a));
const lin = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const lerpN = (a, b, k) => a + (b - a) * k;
const V = (...a) => new THREE.Vector3(...a);
const HDR = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const RAW = hex => { const c = parseInt(hex.slice(1), 16); return new THREE.Vector3((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255); };
const backOut = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const X = { oly: 0, temple: 1000, palace: 2000, under: 3000 };
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
    if (/Box|Cylinder|Extrude|Torus|Sphere|Cone|Icosahedron/.test(o.geometry.type) && !o.userData.noShadow) o.castShadow = true;
  });
}
function sunLight(color, intensity, from, to, size) {
  const l = new THREE.DirectionalLight(color, intensity); l.position.set(...from); l.target.position.set(...to); l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048); Object.assign(l.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: .5, far: 80 });
  l.shadow.bias = -.0006; l.shadow.normalBias = .03; l.shadow.radius = 3; return l;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
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
function skyMat(cols) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: true,
    uniforms: { sunAz: { value: cols.az }, zen: { value: RAW(cols.zen) }, warm: { value: RAW(cols.warm) }, glow: { value: RAW(cols.glow) }, cool: { value: RAW(cols.cool) }, haze: { value: RAW(cols.haze) } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position, 1.0)).xyz - (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float sunAz; uniform vec3 zen; uniform vec3 warm; uniform vec3 glow; uniform vec3 cool; uniform vec3 haze; varying vec3 vD;
      void main(){
        float el = max(vD.y, -0.2) ;
        vec2 s = vec2(sin(sunAz), -cos(sunAz));
        float toward = dot(normalize(vD.xz + 1e-5), s) * 0.5 + 0.5;
        vec3 hor = mix(cool, mix(haze, warm, smoothstep(0.45, 0.95, toward)), smoothstep(0.15, 0.75, toward));
        hor = mix(hor, glow, pow(toward, 10.0) * 0.8 * exp(-abs(el) * 6.0));
        vec3 c = mix(hor, zen, smoothstep(0.0, 0.6, el));
        gl_FragColor = vec4(c, 1.0);
      }` });
}

// ---------------------------------------------------------------- OLYMPOS (x = 0)
function column(mat, cap, h = 4, r = .22) {
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(r * .9, r, h, 20), mat); sh.position.y = h / 2; g.add(sh);
  const b = new THREE.Mesh(new THREE.BoxGeometry(r * 2.8, .16, r * 2.8), mat); b.position.y = .08; g.add(b);
  const c = new THREE.Mesh(new THREE.BoxGeometry(r * 3, .18, r * 3), cap); c.position.y = h + .09; g.add(c);
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * .9, .16, 20), mat); c2.position.y = h - .08; g.add(c2);
  return g;
}
function clouds(g, R, n, rMin, rMax, yMin, yMax, seed, mat) {
  const geo = new THREE.SphereGeometry(1, 16, 12), m = new THREE.InstancedMesh(geo, mat, n * 5), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, r = rMin + R() * (rMax - rMin), y = yMin + R() * (yMax - yMin), s = .8 + R() * 1.6;
    for (let j = 0; j < 5; j++) { const sc = s * (.6 + R() * .6), tx = (j - 2) * s * .9; m4.compose(V(Math.cos(a) * (r + Math.abs(tx) * .3) - Math.sin(a) * tx, y + R() * s * .4, Math.sin(a) * r + Math.cos(a) * tx + (R() - .5) * s), q, V(sc * 1.3, sc * .8, sc)); m.setMatrixAt(k++, m4); }
  }
  g.add(m); return m;
}
function buildOlympos(scene) {
  const g = new THREE.Group(); scene.add(g);
  const marble = painted(stoneTex({ base: '#f2ece2', seam: '#c8bcd8', bw: 128, bh: 128, rep: [3, 3] })), gold = flat('#f2d488', { emissive: '#3a2808' });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, .6, 48), marble); plat.position.y = -.3; g.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.02, .06, 6, 96), gold); ring.rotation.x = Math.PI / 2; ring.position.y = -.02; ring.userData.noShadow = true; g.add(ring);
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), painted(tileTex({ a: '#3f6ac0', b: '#f2ece2', rep: [3, 3] }))); inlay.rotation.x = -Math.PI / 2; inlay.position.y = .005; g.add(inlay);
  for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i / 8 * .9); const c = column(marble, gold); c.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2); g.add(c); }
  // an architrave over the back columns
  const arc = new THREE.Mesh(new THREE.TorusGeometry(5.2, .2, 6, 64, Math.PI * .92), marble); arc.rotation.x = Math.PI / 2; arc.rotation.z = Math.PI * 1.04; arc.position.y = 4.3; g.add(arc);
  // thrones at the back (the wedding; shown only then)
  dyn.thrones = new THREE.Group(); g.add(dyn.thrones);
  for (const [x, z, s] of [[0, -2.4, 1.25], [-1.1, -2.2, 1], [1.1, -2.2, 1]]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(.9 * s, .5, .7), gold); seat.position.set(x, .25, z); dyn.thrones.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(.9 * s, 1.5 * s, .14), gold); back.position.set(x, .75 * s + .2, z - .32); dyn.thrones.add(back);
  }
  const cm = new THREE.MeshLambertMaterial({ color: '#ffffff' }), R = rng(12);
  clouds(g, R, 40, 11, 24, -3.2, -1.6, 1, cm); clouds(g, R, 26, 25, 60, -6, 8, 2, cm);
  dyn.olySky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat({ az: -2.4, zen: '#4f78e0', warm: '#ffb860', glow: '#fff0c0', cool: '#9fc0f4', haze: '#f4b8c8' })); g.add(dyn.olySky);
  dyn.olySun = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ color: HDR(2.6, 2.1, 1.2) })); dyn.olySun.layers.set(1);
  dyn.olySun.position.set(-110, 18, 90); dyn.olySun.lookAt(0, 1, 0); scene.add(dyn.olySun);
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#a8c0ff', '#b49ac8', 1.6));
  const sun = sunLight('#ffcc80', 2.8, [-12, 6, 10], [0, 0, 0], 8); L.add(sun); L.add(sun.target);
  scene.add(L); sets.oly = { g, L };
  shadows(g);
}

// ---------------------------------------------------------------- TEMPLE of Aphrodite on earth (x = 1000)
function buildTemple(scene) {
  const g = new THREE.Group(); g.position.x = X.temple; scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), painted(stoneTex({ base: '#e8dcc0', seam: '#a8988a', bw: 128, bh: 128, rep: [10, 10] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const marble = painted(stoneTex({ base: '#f4ede0', seam: '#cfc2d6', bw: 64, bh: 64, rep: [2, 4] })), pink = flat('#e8a0a8');
  for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(9.6 - k * .6, .22, 5.4 - k * .4), marble); st.position.set(0, .11 + k * .22, -7.2); g.add(st); }
  for (let i = 0; i < 6; i++) { const c = column(marble, pink, 4.4, .26); c.position.set(-3.75 + i * 1.5, .66, -5.4); g.add(c); }
  const ent = new THREE.Mesh(new THREE.BoxGeometry(9.2, .7, 1.2), marble); ent.position.set(0, 5.6, -5.6); g.add(ent);
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(9.2, .45), painted(frizTex({ rep: [4, 1] }))); fr.position.set(0, 5.55, -4.99); g.add(fr);
  const tri = new THREE.Shape(); tri.moveTo(-4.7, 0); tri.lineTo(4.7, 0); tri.lineTo(0, 1.7); tri.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.1, bevelEnabled: false }), marble); ped.position.set(0, 5.95, -6.15); g.add(ped);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.2, 4.4), marble); roof.position.set(0, 5.6, -7.9); g.add(roof);
  const cella = new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.6, .3), painted(stoneTex({ base: '#c87a7a', rep: [3, 2] }))); cella.position.set(0, 3.0, -8.8); g.add(cella);
  // the statue's pedestal and the cold altar
  const pd = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), marble); pd.position.set(0, 1.16, -7.6); g.add(pd);
  const alt = new THREE.Mesh(new THREE.BoxGeometry(1.0, .9, .7), marble); alt.position.set(0, .45, -3.2); g.add(alt);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.36, .2, .2, 20, 1, true), flat('#8a6a4a', { side: THREE.DoubleSide })); bowl.position.set(0, 1.0, -3.2); g.add(bowl);
  const ash = new THREE.Mesh(new THREE.CircleGeometry(.33, 20), flat('#5a5268')); ash.rotation.x = -Math.PI / 2; ash.position.set(0, .96, -3.2); g.add(ash);
  // cypresses and a flower bed
  for (const [x, z] of [[-6.5, -4], [6.5, -4], [-8, 1], [8.5, 0]]) { const t = new THREE.Mesh(new THREE.ConeGeometry(.6, 4.5, 12), flat('#2f6a46')); t.position.set(x, 2.25, z); g.add(t); }
  for (let i = 0; i < 18; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), flat(['#e8384a', '#f2c84a', '#ffffff'][i % 3])); f.position.set(-2.6 + (i % 9) * .65, .12, -2.2 - Math.floor(i / 9) * .3); f.userData.noShadow = true; g.add(f); }
  dyn.tSky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat({ az: 2.2, zen: '#3f70d8', warm: '#ffd898', glow: '#fff2d0', cool: '#a8c8f4', haze: '#f0d8d0' })); g.add(dyn.tSky);
  const R = rng(7); clouds(g, R, 14, 60, 120, 18, 40, 3, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#a8c4ff', '#9a88a8', 1.7));
  const sun = sunLight('#ffd49a', 2.6, [X.temple + 9, 10, 8], [X.temple, 0, -2], 12); L.add(sun); L.add(sun.target);
  scene.add(L); sets.temple = { g, L };
  shadows(g);
  // the wind that carries Psyche off
  dyn.winds = [0, 1, 2, 3].map(i => ribbon(scene, [[X.temple - 2.5 + i * .3, .3, .5], [X.temple - .5, 1.2 + i * .2, -.4], [X.temple + 1.0, 2.6, -1.4], [X.temple + .2, 4.0, -.8], [X.temple + 1.4, 6.5, -1.6]], { radius: .05, color: '#eaf7ff' }));
}

// ---------------------------------------------------------------- PALACE, night (x = 2000)
const BED = V(-.7, 0, -1.7);
function buildPalace(scene) {
  const g = new THREE.Group(); g.position.x = X.palace; scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), painted(tileTex({ a: '#3a4a9a', b: '#d8d0e8', rep: [10, 10] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), painted(carpetTex({ base: '#8a2a5a', band: '#e0b050', rep: [1, 1], rows: 1 }))); rug.rotation.x = -Math.PI / 2; rug.position.set(-.3, .006, -.6); g.add(rug);
  const wallM = painted(stoneTex({ base: '#7068b8', rep: [4, 2] }));
  // the back wall has a window: four pieces around an opening (x -1.9..-.9, y 1.2..2.6)
  const piece = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM); m.position.set(x, y, -4); g.add(m); };
  piece(3.1, 4, -3.45, 2); piece(5.9, 4, 2.05, 2); piece(1, 1.2, -1.4, .6); piece(1, 1.4, -1.4, 3.3);
  const sky = canvasTex(512, 512, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2a6a'); gr.addColorStop(1, '#5a4a9a'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const R = rng(3); c.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { c.globalAlpha = .4 + R() * .6; c.beginPath(); c.arc(R() * w, R() * h * .8, 1 + R() * 2, 0, 6.29); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = '#fff6e0'; c.beginPath(); c.arc(w * .62, h * .3, 60, 0, 6.29); c.fill();
    c.fillStyle = '#2a2a5a'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * .8); c.quadraticCurveTo(w * .3, h * .66, w * .55, h * .82); c.quadraticCurveTo(w * .8, h * .7, w, h * .78); c.lineTo(w, h); c.fill();
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), new THREE.MeshBasicMaterial({ map: sky, color: HDR(1.15, 1.15, 1.2) })); win.position.set(-1.4, 1.9, -4.3); g.add(win);
  const fm = flat('#e8dcc8'); for (const [w, h, x, y] of [[1.2, .12, -1.4, 1.2], [1.2, .12, -1.4, 2.6], [.12, 1.5, -1.95, 1.9], [.12, 1.5, -.85, 1.9]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .25), fm); b.position.set(x, y, -3.95); g.add(b); }
  const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), wallM); side.position.set(-3.6, 2, 0); side.rotation.y = Math.PI / 2; g.add(side);
  const side2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), wallM); side2.position.set(5, 2, 0); side2.rotation.y = -Math.PI / 2; g.add(side2);
  const friz = new THREE.Mesh(new THREE.PlaneGeometry(10, .5), painted(frizTex({ rep: [4, 1] }))); friz.position.set(1, 3.3, -3.95); g.add(friz);
  const dado = new THREE.Mesh(new THREE.PlaneGeometry(10, .8), painted(tileTex({ a: '#c8a040', b: '#f2ead8', rep: [12, 1] }))); dado.position.set(1, .4, -3.95); g.add(dado);
  // the bed with a canopy
  const wood = painted(woodTex({ base: '#8a5a3a' })), sheet = flat('#f4eef8'), silk = flat('#e88ab0', { side: THREE.DoubleSide, transparent: true, opacity: .8 });
  const box = (sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); g.add(b); return b; };
  box(2.3, .4, 1.4, BED.x, .2, BED.z, wood); box(2.2, .16, 1.3, BED.x, .48, BED.z, sheet);
  box(.4, .14, .9, BED.x - .85, .62, BED.z, flat('#ffffff'));
  box(1.2, .06, 1.32, BED.x + .45, .57, BED.z, flat('#c84a7a'));
  for (const [dx, dz] of [[-1.1, -.65], [1.1, -.65], [-1.1, .65], [1.1, .65]]) box(.08, 2.4, .08, BED.x + dx, 1.2, BED.z + dz, wood);
  box(2.3, .08, 1.4, BED.x, 2.42, BED.z, wood);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(.5, 2.2), silk); c.position.set(BED.x + s * 1.1, 1.3, BED.z + .2); c.rotation.y = Math.PI / 2; c.userData.noShadow = true; g.add(c); }
  // a lamp on a stand: the warm key of the room
  const brass = flat('#e0a83c', { emissive: '#3a2408' });
  box(.05, 1.5, .05, .9, .75, -2.6, brass); box(.3, .04, .3, .9, .02, -2.6, brass); box(.3, .03, .03, 1.0, 1.5, -2.6, brass);
  dyn.roomLamp = kandil({ chain: .1, s: 1.2, light: 4, range: 8, decay: 1.4, halo: .4 }); dyn.roomLamp.position.set(1.12, 1.5, -2.6); g.add(dyn.roomLamp);
  dyn.roomLamp.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const ks = dyn.roomLamp.light.shadow; dyn.roomLamp.light.castShadow = true; ks.mapSize.set(1024, 1024); ks.camera.near = .1; ks.camera.far = 12; ks.bias = -.003; ks.normalBias = .04; ks.radius = 4;
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#7a86e8', '#4a3a7a', 1.3));
  const moon = new THREE.SpotLight('#a3b8ff', 3.2, 0, .45, .4, 0); moon.position.set(X.palace - 3.2, 4.6, -9); moon.target.position.set(X.palace - .4, 0, -.6); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -.0008;
  L.add(moon); L.add(moon.target);
  scene.add(L); sets.palace = { g, L };
  shadows(g);
  dyn.pBeam = beam(scene, [X.palace - 1.4, 1.9, -4.0], [X.palace - .5, .05, -.4], { r0: .55, r1: 1.0, color: '#a9bcff', strength: .14 });
}

// ---------------------------------------------------------------- UNDERWORLD (x = 3000)
const ST = { grain: V(-2.0, 0, -.3), sheep: V(-.2, 0, -.9), river: 1.75, box: V(3.35, 0, -.6) };
function buildUnder(scene) {
  const g = new THREE.Group(); g.position.x = X.under; scene.add(g);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), painted(stoneTex({ base: '#4a4270', seam: '#2a2448', bw: 128, bh: 96, rep: [8, 8] }))); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const rockM = new THREE.MeshLambertMaterial({ color: '#4a4486', flatShading: true }), R = rng(5);
  for (let i = 0; i < 22; i++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), rockM); const s = 1.5 + R() * 2.5; r.scale.set(s, s * (1 + R()), s); r.position.set(-9 + i * .9 + R(), s * .6, -5.5 - R() * 2.5); r.rotation.set(R() * 3, R() * 3, R() * 3); g.add(r); }
  for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.ConeGeometry(.3 + R() * .3, 1.5 + R() * 2, 6), rockM); r.rotation.x = Math.PI; r.position.set(-7 + i * 1.6, 5 - R(), -3 - R() * 2); r.userData.noShadow = true; g.add(r); }
  // the Styx: a glowing teal river crossing the cave
  const rt = canvasTex(256, 1024, (c, w, h) => { c.fillStyle = '#2fb8b0'; c.fillRect(0, 0, w, h); const Rr = rng(9); for (let i = 0; i < 120; i++) { c.strokeStyle = Rr() < .5 ? 'rgba(200,255,250,.6)' : 'rgba(20,90,110,.6)'; c.lineWidth = 3; const x = Rr() * w, y = Rr() * h; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y + 20, x, y + 40); c.stroke(); } });
  rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(1, 4); dyn.styx = rt;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 16), new THREE.MeshBasicMaterial({ map: rt, color: HDR(1.1, 1.2, 1.2) })); river.rotation.x = -Math.PI / 2; river.position.set(ST.river, .02, -2); g.add(river);
  for (const s of [-1, 1]) { const bank = new THREE.Mesh(new THREE.BoxGeometry(.2, .14, 16), rockM); bank.position.set(ST.river + s * .78, .07, -2); g.add(bank); }
  // grains: two heaps, gold and brown, with seeds scattered between
  for (const [dx, col] of [[-.35, '#e0b04a'], [.35, '#8a5a3a']]) { const h = new THREE.Mesh(new THREE.ConeGeometry(.42, .34, 24), flat(col)); h.position.set(ST.grain.x + dx, .17, ST.grain.z); g.add(h); }
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(.025, 6, 4), flat('#c89040'), 80), m4 = new THREE.Matrix4();
  for (let i = 0; i < 80; i++) { m4.makeTranslation(ST.grain.x + (R() - .5) * 1.4, .02, ST.grain.z + .3 + R() * .5); seeds.setMatrixAt(i, m4); } g.add(seeds);
  // golden sheep: fluffy blobs that catch the torch light
  const wool = flat('#f2c040', { emissive: '#6a4208' }), dark = flat('#3a2a30');
  for (const [dx, dz, s] of [[0, 0, 1], [.75, -.35, .85], [-.6, -.5, .8]]) {
    const sh = new THREE.Group(); sh.position.set(ST.sheep.x + dx, 0, ST.sheep.z + dz); sh.scale.setScalar(s); g.add(sh);
    for (const [x, y, z, r] of [[0, .42, 0, .26], [.2, .45, .05, .22], [-.2, .44, -.05, .22], [0, .55, 0, .2], [.1, .38, .15, .18]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), wool); b.position.set(x, y, z); sh.add(b); }
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), dark); hd.position.set(.36, .5, .12); sh.add(hd);
    for (const [x, z] of [[-.15, -.1], [.15, -.1], [-.15, .1], [.15, .1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .3, 6), dark); l.position.set(x, .15, z); sh.add(l); }
  }
  // the box of beauty on a pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.3, .36, .8, 16), painted(stoneTex({ base: '#d8d0e8', rep: [1, 1] }))); ped.position.set(ST.box.x, .4, ST.box.z); g.add(ped);
  const boxM = flat('#f0c050', { emissive: '#5a3a08' });
  const bx = new THREE.Mesh(new THREE.BoxGeometry(.34, .2, .24), boxM); bx.position.set(ST.box.x, .9, ST.box.z); g.add(bx);
  const lidP = new THREE.Group(); lidP.position.set(ST.box.x, 1.0, ST.box.z - .12); g.add(lidP);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(.37, .05, .27), flat('#e8384a')); lid.position.set(0, .025, .12); lidP.add(lid); dyn.lid = lidP;
  dyn.boxTop = V(X.under + ST.box.x, 1.02, ST.box.z);
  // torches
  const brass = flat('#e0a83c', { emissive: '#3a2408' });
  dyn.torches = [];
  for (const x of [-3.0, 2.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.6, 8), brass); p.position.set(x, .8, -1.5); g.add(p);
    const k = kandil({ chain: .08, s: 1.3, light: 9, range: 8, decay: 1.3, halo: .45 }); k.position.set(x, 1.62, -1.5); g.add(k); k.traverse(o => { if (o.isMesh) o.castShadow = false; }); dyn.torches.push(k);
  }
  const ks = dyn.torches[0].light.shadow; dyn.torches[0].light.castShadow = true; ks.mapSize.set(1024, 1024); ks.bias = -.003; ks.radius = 4;
  const L = new THREE.Group();
  L.add(new THREE.HemisphereLight('#8a90f0', '#5a4a8a', 2.0));
  for (const z of [-4, -1, 2]) { const p = new THREE.PointLight('#40e0d0', 3, 4, 1.5); p.position.set(X.under + ST.river, .5, z); L.add(p); }
  scene.add(L); sets.under = { g, L };
  shadows(g);
}

// ---------------------------------------------------------------- CAST
export const LOOK = {
  eros: { wings: 'feather', cloth: '#f4ece2', sash: '#e8708a', curls: '#f0c050', height: 1.45, headW: 266, headH: 248, bodyW: 170 },
  psyche: { body: 'gown', cloth: '#b48ae0', clothDark: '#6a4a9a', trim: '#f2c85a', longHair: '#5a3424', lashes: true, blush: '#ff7a8a', collar: false, height: 1.56, headW: 250, headH: 236, bodyW: 165 },
  afrodit: { hat: 'tac', body: 'gown', cloth: '#e8486a', clothDark: '#a02a52', trim: '#f2c85a', longHair: '#f0b840', lashes: true, blush: '#ff7a8a', collar: false, height: 1.72, headW: 256, headH: 240, bodyW: 172 },
  abla1: { body: 'gown', cloth: '#3f9a7a', clothDark: '#22604a', trim: '#f2c85a', longHair: '#2a1a20', lashes: true, collar: false, height: 1.6, headW: 252, headH: 238, bodyW: 165 },
  abla2: { body: 'gown', cloth: '#e09a3a', clothDark: '#9a5a1a', trim: '#f2ead8', longHair: '#6a3020', lashes: true, collar: false, height: 1.54, headW: 250, headH: 236, bodyW: 165 },
  kotu: { hat: 'kulah', hatColor: '#3a3440', cloth: '#5a6a3a', buttons: '#2a2a2a', mustache: true, hair: '#2a2a2a', height: 1.48, headW: 292, headH: 252 },
  hayran1: { hat: 'kulah', hatColor: '#3d5a8a', cloth: '#dba63e', buttons: '#7a4a2a', height: 1.62 },
  hayran2: { cloth: '#c8643a', pattern: 'stripes', mustache: true, hair: '#3a2a24', height: 1.7 },
  zeus: { hat: 'defne', beard: '#f4f0ea', beardLen: .95, mustache: '#e8e2da', body: 'robe', cloth: '#f2ece0', trim: '#e0aa3e', sash: '#3a62b0', height: 1.95 },
};

// ---------------------------------------------------------------- CAMERA
const O = { eros: V(-.6, 0, 0), afr: V(.65, 0, -.4), zeus: V(0, 0, -1.9), pFin: V(.55, 0, -.3), eFin: V(-.55, 0, -.3) };
const T_ = { psy: V(.3, 0, -.9), kotu: V(1.25, 0, -.8), erosAir: V(-1.6, 1.5, -.3), h1: V(-1.5, 0, -.1), h2: V(1.7, 0, -.3) };
const P_ = { sil: V(-.2, 0, -1.0), psy: V(.75, 0, -.6), a1: V(2.0, 0, -1.6), a2: V(3.0, 0, -1.7), psyS: V(2.5, 0, -.8), psyL: V(.3, 0, -.72) };
function cameraPath() {
  const t = W, tx = X.temple, px = X.palace, ux = X.under;
  const keys = [
    // hook: Eros and his bow -> Aphrodite gives the order -> Psyche and the worst of men -> Eros aims -> he falls for her
    { t: 0, pos: [-.25, 1.25, 2.3], look: [-.6, 1.15, 0], fov: 40, creep: .3, drift: .05 },
    { t: t('tek') + .15, dur: .6, pos: [.3, 1.4, 2.5], look: [.45, 1.35, -.4], fov: 42, creep: .28, drift: -.05 },
    { t: t('bir', 2) + .05, dur: .3, move: 'whip', pos: [tx + .8, 1.25, 2.3], look: [tx + .8, 1.1, -.8], fov: 42, creep: .3, drift: .05 },
    { t: t('âşık') - .05, dur: .5, pos: [tx - .3, 1.6, 3.2], look: [tx - .2, 1.5, -.6], fov: 50, creep: .27, drift: .05 },
    { t: t('Ama') + .1, dur: .5, pos: [tx - 1.15, 2.3, 2.0], look: [tx - 1.6, 2.55, -.3], fov: 38, creep: .3, drift: .04 },
    // "Bakın": everyone looks at Psyche; Aphrodite's temple is empty
    { t: t('Bakın') + .1, dur: .3, move: 'whip', pos: [tx + .2, 1.8, 5.6], look: [tx, 1.6, -3], fov: 52, creep: .25, drift: .08 },
    { t: t('insanlar') + .25, dur: .8, pos: [tx - 2.0, 1.15, 1.9], look: [tx + .3, 1.25, -.9], fov: 40, creep: .28, drift: .05 },
    { t: t('Afrodit\'in') + .1, dur: 1.0, pos: [tx + .1, 1.8, -.8], look: [tx, 2.3, -7.6], fov: 44, creep: .28, drift: .06 },
    // Aphrodite jealous; she sends Eros
    { t: t('Afrodit') + .05, dur: .3, move: 'whip', pos: [.95, 1.5, 1.6], look: [.65, 1.52, -.4], fov: 36, creep: .3, drift: .03 },
    { t: t('oğlu') + .1, dur: .6, pos: [0, 1.35, 2.9], look: [0, 1.25, -.2], fov: 44, creep: .27, drift: .05 },
    // the wind carries her off
    { t: t('Eros') + .05, dur: .3, move: 'whip', pos: [tx + .3, 1.4, 3.1], look: [tx + .3, 1.3, -.9], fov: 44, creep: .2, drift: .05 },
    { t: t('gizli') + .2, dur: 1.0, pos: [tx + .3, 3.2, 3.4], look: [tx + .3, 4.0, -.9], fov: 48, creep: .25, drift: .05 },
    // the palace by night: the silhouette and the rule
    { t: t('Tek', 2) - .05, dur: .3, move: 'whip', pos: [px + .3, 1.3, 2.5], look: [px + .25, 1.2, -.8], fov: 44, creep: .26, drift: .04 },
    { t: t('Yüzüme') + .1, dur: .6, pos: [px - .05, 1.35, 1.4], look: [px - .2, 1.3, -1], fov: 38, creep: .3, drift: .03 },
    // the sisters
    { t: t('Kız') + .05, dur: .5, pos: [px + 2.5, 1.35, 2.0], look: [px + 2.5, 1.25, -1.3], fov: 44, creep: .26, drift: .04 },
    { t: t('Ya') + .05, dur: .4, pos: [px + 2.5, 1.4, 1.1], look: [px + 2.5, 1.45, -1.3], fov: 40, creep: .3, drift: .02 },
    // the lamp, the drop of oil
    { t: t('gece') + .05, dur: .5, pos: [px - .25, 1.6, 2.4], look: [px - .45, .85, -1.5], fov: 48, creep: .27, drift: .04 },
    { t: t('baktı') + .05, dur: .5, pos: [px - .3, 1.3, .9], look: [px - .55, .8, -1.5], fov: 42, creep: .3, drift: .03 },
    { t: t('damla') + .05, dur: .4, pos: [px - .3, 1.15, .45], look: [px - .4, .82, -1.4], fov: 40, creep: .3, drift: .02 },
    { t: t('uyandı') + .05, dur: .5, pos: [px + .5, 1.6, 2.7], look: [px - .3, 1.7, -1.4], fov: 50, creep: .25, drift: .05 },
    // the underworld: Aphrodite's tasks
    { t: t('Psyche', 3) + .05, dur: .3, move: 'whip', pos: [ux - 3.95, 1.35, 2.2], look: [ux - 4.1, 1.3, -.9], fov: 44, creep: .27, drift: .05 },
    { t: t('tahılları') + .1, dur: .28, move: 'whip', pos: [ux - 2.25, 1.4, 2.3], look: [ux - 2.3, .7, -.4], fov: 44, creep: .28, drift: .05 },
    { t: t('altın') + .1, dur: .28, move: 'whip', pos: [ux - .4, 1.2, 1.8], look: [ux - .45, .75, -.7], fov: 44, creep: .28, drift: .05 },
    { t: t('ölüler') + .1, dur: .28, move: 'whip', pos: [ux + 1.2, 1.35, 2.2], look: [ux + 1.5, .6, -1.0], fov: 46, creep: .28, drift: .05 },
    { t: t('yeraltından') + .1, dur: .28, move: 'whip', pos: [ux + 3.0, 1.3, 1.9], look: [ux + 3.1, .9, -.5], fov: 42, creep: .28, drift: .04 },
    { t: t('Merak') + .1, dur: .5, pos: [ux + 3.1, 1.15, 1.15], look: [ux + 3.15, .95, -.5], fov: 38, creep: .3, drift: .02 },
    { t: t('Eros', 3) + .05, dur: .6, pos: [ux + 2.6, 1.5, 2.9], look: [ux + 2.55, 1.3, -.5], fov: 48, creep: .26, drift: .04 },
    // Olympos: Zeus, the wings, the wedding
    { t: t('Zeus') + .05, dur: .3, move: 'whip', pos: [0, 1.1, 3.7], look: [0, 1.5, -1], fov: 50, creep: .25, drift: .05 },
    { t: t('Çünkü', 2) + .1, dur: .8, pos: [.6, 1.4, 1.7], look: [.55, 1.4, -.3], fov: 40, creep: .28, drift: .03 },
    { t: t('aşk', 2) - .3, dur: .8, pos: [0, 1.35, 2.2], look: [0, 1.3, -.3], fov: 42, creep: .27, drift: .03 },
  ];
  const cp = new CamPath(keys, { fps: FPS });
  cp.kick(t('düştü.') + .02, .9); cp.kick(t('açtı') + .05, .5);
  return cp;
}

// ---------------------------------------------------------------- SETUP
export async function setup(ctx) {
  C = ctx; W = wordTimes(ctx.words);
  DUR = Math.ceil((ctx.words[ctx.words.length - 1].end + .7) * FPS) / FPS;
  const { scene } = ctx;
  scene.background = new THREE.Color('#1a1f3a');
  buildOlympos(scene); buildTemple(scene); buildPalace(scene); buildUnder(scene);
  for (const [k, l] of Object.entries(LOOK)) cast[k] = new Toon(l, scene);
  cast.statue = new Toon({ ...LOOK.afrodit, cloth: '#eeeaf2', clothDark: '#b8b0c8', trim: '#d8d2e0', longHair: '#dcd6e4', blush: undefined, lashes: false }, scene);
  dyn.lamp = kandil({ chain: .14, s: 1.25, light: 7, range: 8, decay: 1.3, halo: .5 }); scene.add(dyn.lamp);
  const ls = dyn.lamp.light.shadow; dyn.lamp.light.castShadow = true; ls.mapSize.set(1024, 1024); ls.camera.near = .1; ls.camera.far = 10; ls.bias = -.003; ls.normalBias = .04; ls.radius = 4;
  dyn.lamp.traverse(o => { if (o.isMesh) o.castShadow = false; });
  dyn.armP = new Arm3D(scene, cast.psyche);
  dyn.drop = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 10), new THREE.MeshBasicMaterial({ color: HDR(3.0, 1.9, .5) })); dyn.drop.layers.set(1); scene.add(dyn.drop);
  dyn.hearts = [0, 1, 2, 3].map(() => card(scene, .22, .22, (c, w) => heart(c, w / 2, w / 2 + 10, w * .3), 256));
  dyn.monster = card(scene, 2.6, 1.9, (c, w, h) => {      // the sisters' monster: a serpent's shadow in a pool of lamp light on the wall
    const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * .5); gr.addColorStop(0, 'rgba(255,190,110,.75)'); gr.addColorStop(.7, 'rgba(255,170,90,.35)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(30,16,50,.85)'; c.beginPath(); c.moveTo(w * .05, h * .9);
    c.bezierCurveTo(w * .2, h * .4, w * .45, h * 1.0, w * .55, h * .55); c.bezierCurveTo(w * .62, h * .25, w * .75, h * .2, w * .85, h * .25);
    c.quadraticCurveTo(w * .98, h * .3, w * .95, h * .4); c.quadraticCurveTo(w * .85, h * .42, w * .78, h * .38); c.bezierCurveTo(w * .7, h * .45, w * .68, h * .75, w * .55, h * .85);
    c.bezierCurveTo(w * .42, h * .98, w * .3, h * .7, w * .12, h * .96); c.closePath(); c.fill();
    c.fillStyle = '#ff4a4a'; c.beginPath(); c.arc(w * .86, h * .3, w * .012, 0, 6.29); c.fill();
    c.strokeStyle = 'rgba(30,16,50,.85)'; c.lineWidth = 8; c.beginPath(); c.moveTo(w * .95, h * .37); c.lineTo(w * .99, h * .34); c.moveTo(w * .95, h * .37); c.lineTo(w * .99, h * .41); c.stroke();
  });
  dyn.zzz = card(scene, .5, .5, (c, w) => { c.fillStyle = '#e8e0ff'; c.strokeStyle = PLUM; c.lineWidth = 10; c.font = '900 120px "Arial Black", sans-serif'; c.textAlign = 'center';
    for (const [x, y, s] of [[.3, .85, .7], [.55, .6, .85], [.78, .32, 1]]) { c.save(); c.translate(w * x, w * y); c.scale(s, s); c.strokeText('Z', 0, 0); c.fillText('Z', 0, 0); c.restore(); } });
  dyn.spark = card(scene, 1.4, 1.4, (c, w) => { c.strokeStyle = '#fff3c4'; c.lineCap = 'round'; c.lineWidth = 14;
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283, r0 = w * (.22 + (k % 2) * .05), r1 = w * (.42 + (k % 2) * .05); c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * r0, w / 2 + Math.sin(a) * r0); c.lineTo(w / 2 + Math.cos(a) * r1, w / 2 + Math.sin(a) * r1); c.stroke(); } });
  dyn.fly = card(scene, .34, .26, (c, w, h) => {        // a butterfly: "psyche" = soul, and butterfly
    c.lineJoin = 'round'; c.strokeStyle = PLUM; c.lineWidth = 10;
    for (const s of [-1, 1]) { c.fillStyle = '#8fd0ff'; c.beginPath(); c.ellipse(w / 2 + s * w * .22, h * .35, w * .2, h * .3, s * -.4, 0, 6.29); c.fill(); c.stroke(); c.fillStyle = '#ffb0e0'; c.beginPath(); c.ellipse(w / 2 + s * w * .17, h * .72, w * .13, h * .18, s * .4, 0, 6.29); c.fill(); c.stroke(); }
    c.fillStyle = PLUM; c.beginPath(); c.ellipse(w / 2, h * .55, w * .03, h * .3, 0, 0, 6.29); c.fill();
  }, 400);
  smokes.sleep = new Smoke(scene, { color: '#c8a8ff', maxPoints: 600, H: ctx.H });
  smokes.sleep.wisps.push({ n: 70, size: .14, alpha: .35, speed: .35, on: t => t >= W('açtı') && t < W('Eros', 3) + .6,
    path: (u, t, i) => { const b = dyn.boxTop; return [b.x + Math.sin(u * 7 + t * 2 + i) * .15 * u * 3 - u * .5, b.y + u * .8, b.z + Math.cos(u * 5 + t) * .1 * u * 3 + u * .4]; } });
  smokes.motes = new Smoke(scene, { color: '#fff0d0', maxPoints: 600, H: ctx.H, additive: true, near: 2.4 });
  const hash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const motes = (n, c, sz, on, size = .01) => smokes.motes.wisps.push({ n, size, alpha: .5, speed: .05, on,
    path: (u, t, i) => [c[0] + (hash(i, 1) - .5) * sz[0] + Math.sin(t * .5 + i) * .06, c[1] + (hash(i, 2) - .5) * sz[1] + (u - .5) * .5, c[2] + (hash(i, 3) - .5) * sz[2] + Math.cos(t * .4 + i * 2) * .06] });
  motes(160, [0, 1.5, 0], [8, 3, 6], t => true);
  motes(120, [X.palace - .6, 1.2, -1.5], [2.5, 2, 3], t => true);
  motes(140, [X.under + .5, 1.2, -1], [9, 2.5, 4], t => true, .014);
  dyn.cam = cameraPath();
  const cue = (t, type, extra = {}) => CUES.push({ t: +t.toFixed(3), type, ...extra });
  cue(W('Bakın') - .1, 'whoosh'); cue(W('Tek', 2) - .15, 'whoosh'); cue(W('Psyche', 3) - .1, 'whoosh');   // keep these three first: mix.py reads the sets from them
  cue(W('bir', 2) - .05, 'rise', { dur: .4 }); cue(W('Afrodit') - .1, 'rise', { dur: .4 }); cue(W('Eros') - .1, 'rise', { dur: .4 }); cue(W('Zeus') - .1, 'rise', { dur: .4 });
  for (const w of ['tahılları', 'altın', 'ölüler', 'yeraltından']) cue(W(w) - .05, 'rise', { dur: .3 });
  cue(W('âşık', 2), 'shimmer'); cue(W('rüzgârla'), 'wind', { dur: 2.6 }); cue(W('canavarsa?"') - .1, 'boom');
  cue(W('kandili') + .1, 'lamps', { dur: W('uyandı') - W('kandili') }); cue(W('düştü.'), 'lock'); cue(W('uçup'), 'wind', { dur: 1.2 });
  cue(W('açtı'), 'shimmer'); cue(W('ölümsüzlük'), 'shimmer'); cue(W('evlendi.') - .3, 'shimmer');
}

// ---------------------------------------------------------------- PER FRAME
const vis = (set, on) => { sets[set].g.visible = on; sets[set].L.visible = on; };
const WARM = '#ffb45a', NIGHT = '#d6d1f2', DAY = '#e8e3f4', GOLD = '#ffd08a';
export function frame(t, ctx) {
  const { cam, env } = ctx;
  const cp = dyn.cam.apply(cam, t);
  const x = cam.position.x;
  const where = x < 500 ? 'oly' : x < 1500 ? 'temple' : x < 2500 ? 'palace' : 'under';
  for (const s of ['oly', 'temple', 'palace', 'under']) vis(s, s === where);
  const T = W, A = (w, n) => W(w, n) - 2 / FPS;
  const bl = (seed, ...swaps) => blinkAt(t, seed, swaps, FPS);
  for (const c of Object.values(cast)) { c.hide(); c.mesh.rotation.z = 0; }
  for (const c of [dyn.monster, dyn.zzz, dyn.spark, dyn.fly, ...dyn.hearts]) c.visible = false;
  dyn.armP.hide(); dyn.lamp.visible = false; dyn.drop.visible = false;
  dyn.olySun.visible = where === 'oly'; dyn.pBeam.visible = where === 'palace'; dyn.winds.forEach(r => { r.visible = where === 'temple'; r.material.uniforms.uT.value = t; });
  const tint = FACE[where].map((v, i) => v / GRADE[where][i]);
  const flapW = (k = 1) => Math.sin(t * 14) * k;
  const hearts = (who, t0, t1) => { if (t < t0 || t > t1) return; dyn.hearts.forEach((h, i) => { const k = t - t0 - i * .2; if (k < 0) return; const head = who.toWorld(0, 120, .1);
    h.visible = true; h.position.set(head.x + Math.sin(i * 2 + k * 3) * .12 + (i - 1.5) * .12, head.y + .1 + k * .3, head.z); h.lookAt(cam.position); h.scale.setScalar(.3 + .7 * backOut(k / .25)); h.material.opacity = 1 - lin(k, .8, 1.2); }); };

  if (where === 'oly') {
    const fin = t > T('Zeus') - .3;
    dyn.thrones.visible = fin;
    if (!fin) {
      // hook (Eros and Aphrodite) and "Afrodit kıskandı ... gönderdi"
      const later = t > T('Afrodit') - .3, sent = later ? ramp(t, A('gönderdi.'), A('gönderdi.') + .8) : 0;
      cast.eros.show(); cast.eros.place(O.eros.x, O.eros.y + sent * 3 + (later ? 0 : .02), O.eros.z, cam, tint);
      cast.eros.draw({ expr: later ? (t > A('oğlu') ? 'smile' : 'worried') : t > A('tek') ? 'focused' : 'smug', look: .6, lookY: -.1, blink: bl(1, A('tek'), A('oğlu')), flap: flapW(sent > 0 ? 1 : .4),
        armL: [40, 50], propL: 'bow', draw: 0, bowAim: -.5, armR: [later && t > A('Eros\'u') ? 140 : 20, 30], lit: -1, shade: DAY, rim: { color: GOLD, a: .4 } });
      cast.afrodit.show(); cast.afrodit.place(O.afr.x, 0, O.afr.z, cam, tint);
      const angry = later || (t > A('tek') && t < A('bir', 2));
      cast.afrodit.draw({ expr: angry ? 'angry' : 'smug', look: -.6, blink: bl(2, A('tek'), A('Afrodit')), armL: [angry ? 120 : 20, angry ? 10 : 30], armR: [20, 30], sway: Math.sin(t * 1.5) * .3, lit: -1, shade: DAY, rim: { color: GOLD, a: .4 } });
      cast.eros.castFrom(V(12, -6, -10), true); cast.afrodit.castFrom(V(12, -6, -10), true);
    } else {
      // Zeus gives her immortality: butterfly wings; the wedding
      const wings = t > A('ölümsüzlük') + .1;
      cast.zeus.show(); cast.zeus.place(O.zeus.x, 0, O.zeus.z, cam, tint);
      cast.zeus.draw({ expr: t > A('verdi.') ? 'smile' : 'proud', look: .3, blink: bl(3, A('verdi.')), armR: [t > A('ölümsüzlük') - .2 && t < A('Çünkü', 2) ? 130 : 20, 20], armL: [20, 40], propL: 'scroll', lit: -1, shade: DAY, rim: { color: GOLD, a: .4 } });
      cast.psyche.show(); cast.psyche.place(O.pFin.x, wings ? .03 + Math.sin(t * 2) * .03 : 0, O.pFin.z, cam, tint);
      cast.psyche.draw({ expr: wings ? 'smile' : 'surprised', look: -.4, blink: bl(4, A('ölümsüzlük') + .1), wings: wings ? 'butterfly' : undefined, flap: Math.sin(t * 5) * .6, sway: Math.sin(t * 1.7) * .4, armL: [20, 30], armR: [20, 30], lit: -1, shade: DAY, rim: { color: GOLD, a: .4 } });
      cast.eros.show(); cast.eros.place(O.eFin.x, 0, O.eFin.z, cam, tint);
      cast.eros.draw({ expr: t > A('aşk', 2) ? 'grin' : 'smile', look: .7, blink: bl(1, A('aşk', 2)), flap: flapW(.3), armR: [t > A('aşk', 2) ? 60 : 20, 30], armL: [20, 40], propL: 'bow', arrow: false, lit: -1, shade: DAY, rim: { color: GOLD, a: .4 } });
      for (const c of [cast.zeus, cast.psyche, cast.eros]) c.castFrom(V(12, -6, -10), true);
      const sk = t - A('ölümsüzlük');
      if (sk > 0 && sk < .45) { const p = cast.psyche.toWorld(0, 400, .2); dyn.spark.visible = true; dyn.spark.position.copy(p); dyn.spark.lookAt(cam.position); dyn.spark.scale.setScalar(.4 + sk * 3); dyn.spark.material.opacity = 1 - sk / .45; }
      if (t > A('ruh') - .2) { const k = t - A('ruh') + .2; const p = cast.psyche.toWorld(250, 90, .25); p.y += Math.sin(t * 6) * .04 + k * .05; p.x += Math.sin(t * 2) * .05;
        dyn.fly.visible = true; dyn.fly.position.copy(p); dyn.fly.lookAt(cam.position); dyn.fly.scale.set(Math.abs(Math.cos(t * 12)) * .7 + .3, 1, 1); dyn.fly.scale.multiplyScalar(backOut(k / .3)); }
      hearts(cast.eros, A('aşk', 2), DUR);
    }
  } else if (where === 'temple') {
    const hook = t < T('Bakın') - .1, wind = t > T('Eros') - .3;
    const up = wind ? ramp(t, A('rüzgârla'), A('taşıdı.') + .3) : 0;
    cast.psyche.show(); cast.psyche.place(X.temple + T_.psy.x, up * 4.2, T_.psy.z, cam, tint);
    cast.psyche.draw({ expr: wind ? (up > .2 ? 'surprised' : 'smile') : hook ? 'neutral' : 'smile', look: hook ? .4 : -.1, lookY: wind ? -.4 : 0, blink: bl(4, A('rüzgârla')), sway: Math.sin(t * (wind ? 6 : 1.8)) * (wind ? .9 : .35), flare: wind ? .15 : 0,
      armL: [wind ? 120 : 20, 30], armR: [wind ? 120 : 20, 30], lit: 1, shade: DAY, rim: { color: GOLD, a: .3 } });
    cast.psyche.castFrom(V(-9, -10, -8), true);
    if (hook) {
      cast.kotu.show(); cast.kotu.place(X.temple + T_.kotu.x, 0, T_.kotu.z, cam, tint);
      cast.kotu.draw({ expr: 'angry', look: -.6, blink: bl(5), lid: .1, armL: [30, 40], armR: [20, 20], soot: .4, lit: 1, shade: DAY });
      cast.kotu.castFrom(V(-9, -10, -8), true);
      // Eros hovers, aims... and falls for her
      const love = t > A('kendisi');
      cast.eros.show(); cast.eros.place(X.temple + T_.erosAir.x, T_.erosAir.y + Math.sin(t * 3) * .05, T_.erosAir.z, cam, tint);
      cast.eros.draw({ expr: love ? 'grin' : t > A('Ama') ? 'surprised' : 'focused', look: .8, lookY: .2, blink: bl(1, A('Ama'), A('kendisi')), flap: flapW(), brow: love ? .8 : 0,
        armL: [love ? 40 : 95, love ? 50 : -10], propL: 'bow', draw: love ? 0 : lin(t, A('âşık') - .3, A('Ama')), bowAim: love ? -.9 : -.15, armR: [love ? 30 : 80, love ? 40 : 60], lit: 1, shade: DAY });
      hearts(cast.eros, A('âşık', 2) - .1, T('Bakın'));
    } else if (!wind) {
      // admirers gaze at Psyche; the statue of Aphrodite stands alone
      for (const [k, p, sd] of [['hayran1', T_.h1, 1], ['hayran2', T_.h2, -1]]) {
        cast[k].show(); cast[k].place(X.temple + p.x, 0, p.z, cam, tint);
        cast[k].draw({ expr: 'grin', look: sd * .7, blink: bl(k === 'hayran1' ? 6 : 7), brow: .8, armL: [20, 20], armR: [sd > 0 ? 40 : 20, 40], lean: sd * 3, lit: 1, shade: DAY });
        cast[k].castFrom(V(-9, -10, -8), true);
      }
      hearts(cast.hayran1, A('güzeldi') - .1, A('Afrodit\'in'));
    }
    cast.statue.show(); cast.statue.place(X.temple, 1.66, -7.6, cam, [.95, .95, 1], 1.1); cast.statue.shadow.visible = false;
    cast.statue.draw({ expr: t > A('Afrodit\'in') + .4 && !wind ? 'angry' : 'neutral', look: 0, lit: 1, shade: '#c8c0d8', blink: 0 });
  } else if (where === 'palace') {
    dyn.roomLamp.flicker(t);
    const scene = t < T('Kız') - .3 ? 'rule' : t < T('gece') - .3 ? 'sisters' : 'lamp';
    if (scene === 'rule') {
      // Eros a silhouette in the dark: she may not see his face
      cast.eros.show(); cast.eros.place(X.palace + P_.sil.x, 0, P_.sil.z, cam, [.07, .06, .12]);
      cast.eros.draw({ expr: 'neutral', look: .5, flap: flapW(.15), armL: [20, 30], armR: [t > A('Yüzüme') ? 120 : 20, 30], lit: 1, shade: NIGHT });
      cast.psyche.show(); cast.psyche.place(X.palace + P_.psy.x, 0, P_.psy.z, cam, tint);
      cast.psyche.draw({ expr: t > A('Yüzüme') ? 'worried' : 'smile', look: -.6, blink: bl(4, A('Yüzüme')), lid: t > A('Yüzüme') ? 0 : .2, sway: Math.sin(t * 1.6) * .3, armL: [20, 30], armR: [20, 30], lit: -1, shade: NIGHT, rim: { color: WARM, a: .3 } });
      cast.eros.castFrom(dyn.roomLamp.flameAt()); cast.psyche.castFrom(dyn.roomLamp.flameAt());
    } else if (scene === 'sisters') {
      for (const [k, p, sd] of [['abla1', P_.a1, 1], ['abla2', P_.a2, -1]]) {
        cast[k].show(); cast[k].place(X.palace + p.x, 0, p.z, cam, tint);
        cast[k].draw({ expr: t > A('Ya') ? 'smug' : 'focused', look: sd * .6, lookY: .2, blink: bl(k === 'abla1' ? 8 : 9, A('Ya')), mouth: t > A('fısıldadı:') && t < A('Ya') + 1.2 ? flap(env, t) * .5 : 0,
          armL: [sd > 0 ? 20 : 70, sd > 0 ? 30 : 60], armR: [sd > 0 ? 70 : 20, sd > 0 ? 60 : 30], lean: sd * 4, lit: -1, shade: NIGHT, rim: { color: WARM, a: .3 } });
        cast[k].castFrom(dyn.roomLamp.flameAt());
      }
      cast.psyche.show(); cast.psyche.place(X.palace + P_.psyS.x, 0, P_.psyS.z, cam, tint);
      cast.psyche.draw({ expr: t > A('canavarsa?"') - .1 ? 'surprised' : 'worried', look: 0, blink: bl(4, A('canavarsa?"') - .1), sweat: t > A('canavarsa?"') ? 1 : 0, armL: [20, 30], armR: [20, 30], lit: -1, shade: NIGHT, rim: { color: WARM, a: .3 } });
      cast.psyche.castFrom(dyn.roomLamp.flameAt());
      const mk = ramp(t, A('kocan'), A('canavarsa?"') + .2);
      if (mk > 0) { dyn.monster.visible = true; dyn.monster.position.set(X.palace + 2.5, 2.1, -3.9); dyn.monster.material.opacity = mk; dyn.monster.scale.setScalar(.8 + mk * .25); }
    } else {
      // she lights the lamp, looks at sleeping Eros; a drop of hot oil; he wakes and flies away
      const woke = t > A('uyandı'), gone = ramp(t, A('uçup'), A('gitti.') + .4);
      cast.eros.show();
      if (!woke) {
        cast.eros.place(X.palace + BED.x + .95, .74, BED.z + .35, cam, tint);
        cast.eros.mesh.rotation.z = Math.PI / 2 - .05; cast.eros.caster.rotation.copy(cast.eros.mesh.rotation); cast.eros.shadow.visible = false;
        const hurt = t > A('düştü.') - .05;
        cast.eros.draw({ expr: hurt ? 'worried' : 'smile', blink: hurt ? 0 : 1, look: 0, armL: [10, 10], armR: [10, 10], lit: 1, shade: NIGHT, rim: { color: WARM, a: .45 } });
      } else {
        cast.eros.place(X.palace + BED.x + gone * -.6, .5 + gone * 2.2, BED.z - gone * 1.4, cam, tint);
        cast.eros.draw({ expr: gone > .1 ? 'angry' : 'surprised', look: -.5, lookY: .2, blink: bl(1, A('uyandı')), flap: flapW(), brow: .5, armL: [60, 30], armR: [80, 40], lit: 1, shade: NIGHT, rim: { color: WARM, a: .45 } });
      }
      cast.psyche.show(); cast.psyche.place(X.palace + P_.psyL.x, 0, P_.psyL.z, cam, tint);
      const sees = t > A('baktı.');
      cast.psyche.draw({ expr: woke ? 'worried' : sees ? (t > A('damla') ? 'surprised' : 'smile') : 'focused', look: -.8, lookY: .5, blink: bl(4, A('baktı.'), A('damla'), A('uyandı')), sweat: woke ? 1 : 0,
        noArmL: !woke, armL: [20, 30], armR: [20, 30], sway: Math.sin(t * 1.4) * .25, lit: -1, shade: NIGHT, rim: { color: WARM, a: .5 } });
      if (!woke) {
        const lift = ramp(t, A('kandili') - .2, A('kandili') + .4);
        const h = cast.psyche.toWorld(-lerpN(150, 250, lift), lerpN(560, 380, lift), .12);
        dyn.lamp.visible = true; dyn.lamp.position.copy(h); dyn.lamp.rotation.set(0, 0, .03 * Math.sin(t * 2.1)); dyn.lamp.flicker(t); dyn.lamp.updateMatrixWorld(true);
        dyn.armP.set(-1, h, { sag: .05, tint });
        cast.eros.castFrom(dyn.lamp.flameAt()); cast.psyche.castFrom(dyn.lamp.flameAt());
        // the drop: from the lamp's glass down to his shoulder
        const d0 = A('damla') + .1, d1 = A('düştü.') + .02;
        if (t > d0 && t < d1 + .2) { const k = lin(t, d0, d1), top = dyn.lamp.flameAt().add(V(0, -.12, 0)), bottom = V(top.x, .8, top.z);
          dyn.drop.visible = true; dyn.drop.position.copy(top).lerp(bottom, k * k); dyn.drop.scale.set(1, 1 + k * .8, 1); }
        if (sees) hearts(cast.psyche, A('baktı.'), A('damla'));
      } else cast.psyche.castFrom(dyn.roomLamp.flameAt());
    }
  } else {
    dyn.torches.forEach(k => k.flicker(t)); dyn.styx.offset.y = -t * .12;
    // Psyche moves from task to task (each move is hidden by a whip)
    const stations = [[T('Psyche', 3) - .3, V(-3.6, 0, -.5)], [T('tahılları') + .2, V(ST.grain.x - .5, 0, ST.grain.z - .15)], [T('altın') + .2, V(ST.sheep.x - .55, 0, ST.sheep.z + .4)], [T('ölüler') + .2, V(ST.river - .75, 0, -.4)], [T('yeraltından') + .2, V(ST.box.x - .6, 0, ST.box.z + .2)]];
    let pp = stations[0][1]; for (const [ts, p] of stations) if (t >= ts) pp = p;
    const task = t < T('tahılları') + .2 ? 0 : t < T('altın') + .2 ? 1 : t < T('ölüler') + .2 ? 2 : t < T('yeraltından') + .2 ? 3 : 4;
    const asleep = t > A('uykuya') && t < A('uyandırdı,') + .2, woke = t > A('uyandırdı,') + .2, opened = ramp(t, A('açtı'), A('açtı') + .4);
    dyn.lid.rotation.x = -opened * 1.9;
    cast.psyche.show(); cast.psyche.place(X.under + pp.x, 0, pp.z, cam, tint);
    cast.psyche.draw({ expr: woke ? 'smile' : asleep ? 'neutral' : task === 4 && t > A('Merak') ? 'focused' : task === 0 ? 'worried' : 'focused', look: task === 0 ? -.5 : .6, lookY: task === 1 || task === 3 ? .6 : 0,
      blink: asleep ? 1 : bl(4, A('tahılları'), A('altın'), A('ölüler'), A('yeraltından'), A('Merak'), A('uyandırdı,') + .2), tilt: asleep ? -16 : 0, lean: asleep ? -6 : 0, sway: Math.sin(t * 1.5) * .3,
      armL: task === 1 ? [70 + Math.sin(t * 16) * 15, 60] : task === 2 ? [60, 40] : task === 4 && !asleep ? [60, 50] : [20, 30], armR: task === 3 ? [50, 50] : task === 1 ? [70 - Math.sin(t * 16) * 15, 60] : [20, 30], propR: task === 3 ? 'jar' : undefined,
      lit: task < 2 ? -1 : 1, shade: NIGHT, rim: { color: task === 3 ? '#80f0e0' : WARM, a: .4 } });
    cast.psyche.castFrom(dyn.torches[0].light.getWorldPosition(V()));
    if (task === 0) {
      cast.afrodit.show(); cast.afrodit.place(X.under - 4.6, 0, -1.2, cam, tint);
      cast.afrodit.draw({ expr: 'smug', look: .6, blink: bl(2, A('imkânsız')), armR: [t > A('imkânsız') ? 110 : 20, 10], armL: [20, 30], sway: Math.sin(t * 1.5) * .3, lit: -1, shade: NIGHT, rim: { color: WARM, a: .4 } });
      cast.afrodit.castFrom(dyn.torches[0].light.getWorldPosition(V()));
    }
    if (asleep) { dyn.zzz.visible = true; const p = cast.psyche.toWorld(150, 40, .2); p.y += Math.sin(t * 2) * .03; dyn.zzz.position.copy(p); dyn.zzz.lookAt(cam.position); dyn.zzz.scale.setScalar(.6 + .1 * Math.sin(t * 3)); }
    if (t > T('Eros', 3) - .3) {
      const land = ramp(t, A('Eros', 3) - .2, A('onu', 2) + .2);
      cast.eros.show(); cast.eros.place(X.under + ST.box.x - 1.15, (1 - land) * 2.2, ST.box.z + .1, cam, tint);
      cast.eros.draw({ expr: woke ? 'grin' : 'worried', look: .7, blink: bl(1, A('uyandırdı,') + .2), flap: flapW(1 - land * .7), armR: [land > .8 ? 80 : 30, 40], armL: [20, 40], lit: 1, shade: NIGHT, rim: { color: WARM, a: .4 } });
      cast.eros.castFrom(dyn.torches[1].light.getWorldPosition(V()));
      hearts(cast.eros, A('uyandırdı,') + .2, T('Zeus'));
    }
  }
  for (const s of Object.values(smokes)) s.update(t);
  // ---- look per set
  const focusOn = (p, coc, range) => ({ focus: cam.position.distanceTo(p), coc, range });
  let look;
  if (where === 'oly') look = { ...focusOn(V(0, 1.3, -.4), 4, 2.5), sat: 1.15, lift: [.12, .11, .16], bloom: .85, vignette: .18 };
  else if (where === 'temple') look = { ...focusOn(V(X.temple + .3, 1.2, -.9), 4, 3), sat: 1.15, lift: [.11, .1, .15], bloom: .7, vignette: .16 };
  else if (where === 'palace') look = { ...focusOn(V(X.palace - .3, 1.0, -1.4), 5, 2.2), sat: 1.15, lift: [.11, .09, .18], bloom: .9, vignette: .26 };
  else look = { ...focusOn(cast.psyche.mesh.position.clone().add(V(0, 1, 0)), 5, 2.2), sat: 1.2, lift: [.1, .09, .18], bloom: 1.0, vignette: .24 };
  look.tint = GRADE[where];
  look.blur = cp.moving > .15 ? 16 : 0;
  return look;
}
const GRADE = { oly: [1.03, 1.0, .97], temple: [1.03, 1.0, .97], palace: [.98, .97, 1.04], under: [.97, .98, 1.04] };
const FACE = { oly: [1, .99, .97], temple: [1, .99, .97], palace: [.97, .97, 1], under: [.96, .97, 1] };
