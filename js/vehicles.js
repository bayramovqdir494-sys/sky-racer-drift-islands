import * as THREE from 'three';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { DRACOLoader } from '../lib/DRACOLoader.js';
import { CARS, COLORS } from './data.js';

let loader = null;
const cache = new Map();
let meta = null;

export async function initVehicles(onProg) {
  const draco = new DRACOLoader();
  draco.setDecoderPath('./lib/');
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  meta = await fetch('./models/meta.json').then(r => r.json());
  const names = CARS.map(c => c.id);
  const props = Object.keys(meta.props || { pine:1, oak:1, cactus:1, rock:1, ramp:1, arch:1 });
  const total = names.length + props.length;
  let done = 0;
  const tick = () => { done++; onProg && onProg(done / total); };
  await Promise.all([
    ...names.map(async n => { cache.set('car:' + n, await loadGLB(`./models/cars/${n}.glb`)); tick(); }),
    ...props.map(async n => { cache.set('prop:' + n, await loadGLB(`./models/props/${n}.glb`)); tick(); })
  ]);
  return meta;
}

function loadGLB(url) {
  return new Promise((res, rej) => {
    loader.load(url, gltf => {
      const root = gltf.scene;
      root.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        }
      });
      res(root);
    }, undefined, rej);
  });
}

function paintMaterial(baseMat, colorHex) {
  const mat = baseMat.clone();
  mat.vertexColors = true;
  mat.metalness = 0.35;
  mat.roughness = 0.38;
  const paint = new THREE.Color(colorHex);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.paintColor = { value: paint };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 paintColor;`)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float mask = smoothstep(0.10, 0.22, luma) * (1.0 - smoothstep(0.78, 0.93, luma));
        // keep very blue/dark glass-ish pixels
        float sat = length(diffuseColor.rgb - vec3(luma));
        mask *= 1.0 - smoothstep(0.22, 0.38, sat) * step(diffuseColor.b, 0.35) * step(luma, 0.45);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, paintColor * (0.55 + luma), 0.86), mask);
      `);
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => 'paint-' + colorHex.toString(16);
  return mat;
}

function makeWheel(r) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r, r, r * 0.68, 14);
  geo.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.6, metalness: 0.25 }));
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

export function makeCar(carId, colorId, opts = {}) {
  const info = (meta && meta.cars && meta.cars[carId]) || null;
  const def = CARS.find(c => c.id === carId) || CARS[0];
  const col = COLORS.find(c => c.id === colorId) || COLORS[0];
  const root = new THREE.Group();
  const body = new THREE.Group();
  const src = cache.get('car:' + carId);
  const wheelsMeta = (info && info.wheels) || [
    { x: 0.75, y: 0.38, z: -1.3, r: 0.38 },
    { x: 0.75, y: 0.38, z: 1.25, r: 0.38 }
  ];

  if (src) {
    const inst = src.clone(true);
    inst.traverse(o => {
      if (o.isMesh) {
        o.material = paintMaterial(o.material, col.hex);
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // Fit: models are Y-up, Z-forward after glTF export. Sit so wheels sit on y=0.
    const box = new THREE.Box3().setFromObject(inst);
    // Don't auto-center X/Z too aggressively — meta len/w is authoritative
    inst.updateMatrixWorld(true);
    body.add(inst);
  } else {
    const dummy = new THREE.Mesh(
      new THREE.BoxGeometry(def.id === 'pickup' ? 2.2 : 1.9, 0.7, def.id === 'muscle' ? 4.7 : 4.1),
      new THREE.MeshStandardMaterial({ color: col.hex, metalness: 0.4, roughness: 0.4 })
    );
    dummy.position.y = 0.7;
    body.add(dummy);
  }

  const wheels = [];
  const rDefault = wheelsMeta[0].r;
  for (const axle of wheelsMeta) {
    for (const sx of [-1, 1]) {
      const piv = new THREE.Group();
      piv.position.set(sx * axle.x, axle.y, axle.z);
      const wh = makeWheel(axle.r);
      piv.add(wh);
      body.add(piv);
      wheels.push({ piv, wh, front: axle.z > 0, r: axle.r, y0: axle.y });
      // dark wheel-well cap hides ragged Hunyuan cuts
      const well = new THREE.Mesh(
        new THREE.CircleGeometry(axle.r * 1.22, 12),
        new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 1, metalness: 0.08 })
      );
      well.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      well.position.set(sx * (axle.x - 0.08), axle.y, axle.z);
      body.add(well);
    }
  }

  // headlights / taillights
  const head = info && info.head, tail = info && info.tail;
  const lightM = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0xff2210, emissive: 0xff2000, emissiveIntensity: 0.8 });
  if (head) {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), lightM.clone());
      m.position.set(sx * head.x, head.y, head.z);
      body.add(m);
    }
  }
  const tails = [];
  if (tail) {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), tailM.clone());
      m.position.set(sx * tail.x, tail.y, tail.z);
      body.add(m); tails.push(m);
    }
  }
  // nitro flames at tail
  const flames = [];
  const flameGeo = new THREE.ConeGeometry(0.16, 0.8, 8);
  flameGeo.rotateX(Math.PI);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x66eeff, transparent: true, opacity: 0.85, depthWrite: false });
  const tz = tail ? tail.z : -2.1, ty = tail ? tail.y : 0.5;
  for (const sx of [-0.28, 0.28]) {
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(sx, ty * 0.7, tz - 0.15);
    f.visible = false;
    body.add(f);
    flames.push(f);
  }

  root.add(body);
  root.userData = { wheels, body, tails, flames, flameMat, carId, colorId, info, def };
  return root;
}

export function spinWheels(mesh, speed, steer, dt, airborne) {
  const U = mesh.userData;
  if (!U || !U.wheels) return;
  for (const w of U.wheels) {
    const v = airborne ? speed * 0.4 : speed;
    w.wh.rotation.x += (v / Math.max(0.22, w.r)) * dt;
    if (w.front) w.piv.rotation.y = steer * 0.45;
  }
}

export function setCarFX(mesh, { brake, nitro, drift }) {
  const U = mesh.userData;
  if (!U) return;
  if (U.tails) for (const t of U.tails) {
    t.material.emissiveIntensity = brake ? 2.4 : 0.7;
  }
  if (U.flames) {
    for (const f of U.flames) {
      f.visible = !!nitro;
      if (nitro) {
        const k = 0.9 + Math.random() * 0.7;
        f.scale.set(k, 0.8 + k, k);
      }
    }
    if (U.flameMat) U.flameMat.color.setHex(Math.random() < 0.5 ? 0x66eeff : 0xffaa33);
  }
}

export function makeProp(kind, scale = 1) {
  const src = cache.get('prop:' + kind);
  const g = new THREE.Group();
  if (src) {
    const inst = src.clone(true);
    inst.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(inst);
    const size = new THREE.Vector3(); box.getSize(size);
    inst.position.y = -box.min.y;
    g.add(inst);
    const denom = (kind === 'floating_rock')
      ? Math.max(size.x, size.y, size.z, 0.001)
      : Math.max(size.y, 0.001);
    const s = scale / denom;
    g.scale.setScalar(s);
    if (kind === 'crystal') {
      inst.traverse(o => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(0xaa88ff);
          o.material.emissiveIntensity = 0.7;
          o.material.roughness = 0.18;
          o.material.metalness = 0.15;
          o.material.vertexColors = true;
        }
      });
    }
  } else {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 6), new THREE.MeshStandardMaterial({ color: 0x2f7a38, flatShading: true }));
    m.position.y = 1; m.castShadow = true; g.add(m);
    g.scale.setScalar(scale / 2);
  }
  return g;
}

export function getMeta() { return meta; }
