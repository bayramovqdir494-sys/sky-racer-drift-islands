import * as THREE from 'three';

function makeSpriteMat(color, size = 64) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(size/2, size/2, 2, size/2, size/2, size/2);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

export function createFX(scene) {
  const smokeMat = makeSpriteMat('rgba(200,200,210,0.55)');
  smokeMat.blending = THREE.NormalBlending;
  const sparkMat = makeSpriteMat('rgba(255,200,80,0.95)');
  const dustMat = makeSpriteMat('rgba(220,200,160,0.5)');
  dustMat.blending = THREE.NormalBlending;

  const N = 28, SN = 16;
  const smokes = [], sparks = [];
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(smokeMat.clone());
    s.visible = false; s.userData.life = 0;
    scene.add(s); smokes.push(s);
  }
  for (let i = 0; i < SN; i++) {
    const s = new THREE.Sprite(sparkMat.clone());
    s.visible = false; s.userData.life = 0;
    scene.add(s); sparks.push(s);
  }

  let si = 0, ki = 0;
  function spawn(arr, iRef, pos, vel, life, scale, color) {
    const s = arr[iRef.v % arr.length];
    iRef.v++;
    s.position.copy(pos);
    s.userData.vel = vel.clone();
    s.userData.life = life;
    s.userData.max = life;
    s.userData.scale = scale;
    s.visible = true;
    s.scale.setScalar(scale);
    if (color && s.material.color) s.material.color.setHex(color);
    s.material.opacity = 0.8;
    return s;
  }
  const sri = { v: 0 }, ski = { v: 0 };

  const speedLines = [];
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-4)]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 });
  for (let i = 0; i < 10; i++) {
    const ln = new THREE.Line(lineGeo, lineMat.clone());
    ln.visible = false;
    scene.add(ln);
    speedLines.push(ln);
  }

  // tire marks: instanced dark quads on the road
  const skidGeo = new THREE.PlaneGeometry(0.28, 1.15);
  skidGeo.rotateX(-Math.PI / 2);
  const skidMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1e, transparent: true, opacity: 0.45, depthWrite: false
  });
  const SK = 48;
  const skids = new THREE.InstancedMesh(skidGeo, skidMat, SK);
  skids.frustumCulled = false;
  const skidDummy = new THREE.Object3D();
  let skidI = 0;
  for (let i = 0; i < SK; i++) {
    skidDummy.position.set(0, -50, 0);
    skidDummy.scale.setScalar(0.001);
    skidDummy.updateMatrix();
    skids.setMatrixAt(i, skidDummy.matrix);
  }
  scene.add(skids);

  return {
    smoke(pos, vel, scale = 0.7) {
      spawn(smokes, sri, pos, vel, 0.55 + Math.random() * 0.35, scale);
    },
    spark(pos, vel) {
      spawn(sparks, ski, pos, vel, 0.25 + Math.random() * 0.2, 0.18 + Math.random() * 0.12);
    },
    dust(pos, vel) {
      spawn(smokes, sri, pos, vel, 0.4, 0.9, 0xdcc8a0);
    },
    update(dt, camera, speed01) {
      for (const s of smokes) {
        if (!s.visible) continue;
        s.userData.life -= dt;
        if (s.userData.life <= 0) { s.visible = false; continue; }
        s.position.addScaledVector(s.userData.vel, dt);
        s.userData.vel.multiplyScalar(0.94);
        s.userData.vel.y += 0.6 * dt;
        const k = s.userData.life / s.userData.max;
        s.material.opacity = k * 0.7;
        s.scale.setScalar(s.userData.scale * (1.2 + (1 - k) * 1.6));
      }
      for (const s of sparks) {
        if (!s.visible) continue;
        s.userData.life -= dt;
        if (s.userData.life <= 0) { s.visible = false; continue; }
        s.position.addScaledVector(s.userData.vel, dt);
        s.userData.vel.y -= 18 * dt;
        const k = s.userData.life / s.userData.max;
        s.material.opacity = k;
        s.scale.setScalar(s.userData.scale * (0.6 + k));
      }
      // speed lines in camera space
      const show = speed01 > 0.72 && !this._low;
      for (let i = 0; i < speedLines.length; i++) {
        const ln = speedLines[i];
        if (!show) { ln.visible = false; continue; }
        ln.visible = true;
        ln.material.opacity = (speed01 - 0.72) * 1.6;
        const a = (i / speedLines.length) * Math.PI * 2 + performance.now() * 0.002;
        const r = 2.2 + (i % 5) * 0.4;
        const local = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.45, -6 - (i % 4));
        ln.position.copy(camera.localToWorld(local));
        ln.lookAt(camera.position);
      }
    },
    skid(pos, yaw) {
      skidDummy.position.set(pos.x, pos.y + 0.03, pos.z);
      skidDummy.rotation.set(0, yaw, 0);
      skidDummy.scale.set(1, 1, 1);
      skidDummy.updateMatrix();
      skids.setMatrixAt(skidI % SK, skidDummy.matrix);
      skids.instanceMatrix.needsUpdate = true;
      skidI++;
    },
    setQuality(q) {
      const hide = q === 'low';
      for (const l of speedLines) if (hide) l.visible = false;
      this._low = hide;
    },
    reset() {
      for (const s of smokes) s.visible = false;
      for (const s of sparks) s.visible = false;
      for (const l of speedLines) l.visible = false;
      for (let i = 0; i < SK; i++) {
        skidDummy.position.set(0, -50, 0);
        skidDummy.scale.setScalar(0.001);
        skidDummy.updateMatrix();
        skids.setMatrixAt(i, skidDummy.matrix);
      }
      skids.instanceMatrix.needsUpdate = true;
      skidI = 0;
    }
  };
}

export function makeSky(theme) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(420, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      mid: { value: new THREE.Color(theme.skyMid) },
      bot: { value: new THREE.Color(theme.skyBot) },
      aurora: { value: theme.aurora ? 1 : 0 },
      neon: { value: theme.neon ? 1 : 0 },
      time: { value: 0 },
      sunDir: { value: new THREE.Vector3(0.42, 0.82, 0.22).normalize() }
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top, mid, bot, sunDir; uniform float aurora, neon, time; varying vec3 vP;
      void main(){
        vec3 n = normalize(vP);
        float h = n.y;
        vec3 col = mix(bot, mid, smoothstep(-0.25, 0.15, h));
        col = mix(col, top, smoothstep(0.15, 0.85, h));
        // sun / moon glow
        float sun = pow(max(0.0, dot(n, sunDir)), 24.0);
        float halo = pow(max(0.0, dot(n, sunDir)), 4.0);
        if (neon > 0.5) {
          col += vec3(0.55, 0.4, 0.9) * sun * 0.9;
          col += vec3(0.25, 0.15, 0.45) * halo * 0.25;
        } else {
          col += vec3(1.0, 0.88, 0.55) * sun * 1.15;
          col += vec3(1.0, 0.7, 0.35) * halo * 0.28;
        }
        // horizon warmth
        col += vec3(1.0, 0.55, 0.25) * (1.0 - smoothstep(-0.05, 0.22, abs(h))) * 0.12;
        if (aurora > 0.5) {
          float a = sin(vP.x*0.03 + time*0.3) * 0.5 + sin(vP.z*0.02 - time*0.2)*0.5;
          float band = smoothstep(0.05, 0.35, h) * (1.0-smoothstep(0.55, 0.85, h));
          col += vec3(0.15, 0.7, 0.45) * max(0.0, a) * band * 0.8;
          col += vec3(0.45, 0.15, 0.7) * max(0.0, -a) * band * 0.55;
        }
        if (neon > 0.5) {
          float tw = step(0.985, fract(sin(dot(n.xy, vec2(12.9, 78.2))) * 43758.5));
          col += vec3(0.8, 0.9, 1.0) * tw * smoothstep(0.2, 0.8, h);
        }
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const dome = new THREE.Mesh(geo, mat);
  group.add(dome);

  // visible sun disc + soft glow
  const sunG = new THREE.Group();
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 16),
    new THREE.MeshBasicMaterial({ color: theme.neon ? 0xd8c4ff : 0xfff3c4 })
  );
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(34, 16, 16),
    new THREE.MeshBasicMaterial({ color: theme.neon ? 0xaa88ff : 0xffc878, transparent: true, opacity: 0.32, depthWrite: false, depthTest: false })
  );
  sunG.add(sunCore, sunHalo);
  sunG.position.set(210, 280, 110);
  group.add(sunG);

  // clouds below the islands
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  cloudGeo.scale(1, 0.38, 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf4f8ff, roughness: 1, metalness: 0, transparent: true, opacity: 0.85, depthWrite: false
  });
  const inst = new THREE.InstancedMesh(cloudGeo, cloudMat, 70);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 200;
    const y = i < 18 ? (-12 - Math.random() * 16) : (-60 - Math.random() * 40);
    const rr = i < 18 ? (70 + Math.random() * 150) : r;
    dummy.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    const s = (i < 18 ? 3 : 5) + Math.random() * (i < 18 ? 6 : 10);
    dummy.scale.set(s * (1.2 + Math.random()), s * 0.45, s * (1.2 + Math.random()));
    dummy.rotation.y = Math.random() * 6;
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.frustumCulled = false;
  inst.renderOrder = -1;
  group.add(inst);
  group.userData = { mat, clouds: inst };
  return group;
}

export function makeLights(theme, scene) {
  scene.background = new THREE.Color(theme.skyMid);
  scene.fog = new THREE.Fog(theme.fog, theme.fogN, theme.fogF);
  const amb = new THREE.AmbientLight(theme.ambient, 0.55);
  const hemi = new THREE.HemisphereLight(theme.hemiTop, theme.hemiBot, 0.7);
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunInt);
  sun.position.set(40, 80, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.001;
  const fill = new THREE.DirectionalLight(theme.neon || theme.aurora ? 0xc8a8ff : 0xa8c8ff, theme.neon || theme.aurora ? 0.55 : 0.32);
  fill.position.set(-30, 20, -40);
  scene.add(amb, hemi, sun, fill);
  return { amb, hemi, sun, fill };
}
