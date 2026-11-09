import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const asset = (name) => new URL(`../assets/stackchan3d/${name}`, import.meta.url).href;

function faceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const round = (x, y, w, h, r, color) => {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    context.fill();
  };
  const ellipse = (x, y, rx, ry) => {
    context.fillStyle = "#191d1c";
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  };
  function draw(faceCanvas) {
    context.clearRect(0, 0, 512, 512);
    round(7, 7, 498, 498, 28, "#f6f8f5");
    round(49, 45, 414, 316, 8, "#222725");
    round(61, 57, 390, 292, 3, "#fff");
    if (faceCanvas) {
      context.imageSmoothingEnabled = false;
      context.drawImage(faceCanvas, 61, 57, 390, 292);
    }
    ellipse(256, 424, 15, 15);
    context.strokeStyle = "#89918d"; context.lineWidth = 5;
    context.beginPath(); context.arc(256, 424, 24, 0, Math.PI * 2); context.stroke();
    for (const x of [146, 179, 333, 366]) ellipse(x, 425, 4, 4);
    texture.needsUpdate = true;
  }
  draw(null);
  return { texture, draw };
}

function shellMaterial(color) {
  return new THREE.MeshStandardMaterial({color, roughness:0.72, metalness:0});
}

function makeEar(x, top, front) {
  const outer = new THREE.Shape();
  outer.moveTo(-0.008, 0);
  outer.lineTo(-0.006, 0.011);
  outer.lineTo(0, 0.021);
  outer.lineTo(0.006, 0.011);
  outer.lineTo(0.008, 0);
  outer.closePath();
  const white = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, {
    depth:0.007, bevelEnabled:true, bevelThickness:0.0006,
    bevelSize:0.0004, bevelSegments:1, steps:1,
  }), [shellMaterial("#f6f7f3"), shellMaterial("#cfd9cf")]);
  white.position.set(x, top - 0.002, front - 0.005);
  white.castShadow = true;
  const red = new THREE.Shape();
  red.moveTo(-0.0049, 0.002);
  red.lineTo(-0.0036, 0.010);
  red.lineTo(0, 0.016);
  red.lineTo(0.0036, 0.010);
  red.lineTo(0.0049, 0.002);
  red.closePath();
  const inset = new THREE.Mesh(new THREE.ExtrudeGeometry(red, {
    depth:0.0008, bevelEnabled:false,
  }), shellMaterial("#be3e34"));
  inset.position.set(x, top - 0.002, front + 0.0026);
  return [white, inset];
}

function makeTail(headBox) {
  const left = headBox.min.x;
  const y = headBox.min.y + (headBox.max.y-headBox.min.y)*0.43;
  const shape = new THREE.Shape();
  const points = [
    [left+0.006,y-0.004], [left-0.006,y-0.003], [left-0.011,y+0.002],
    [left-0.016,y+0.003], [left-0.020,y+0.010], [left-0.023,y+0.016],
    [left-0.024,y+0.023], [left-0.021,y+0.029], [left-0.016,y+0.027],
    [left-0.013,y+0.021], [left-0.008,y+0.016], [left-0.003,y+0.009],
    [left+0.006,y+0.008],
  ];
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();
  const tail = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth:0.012, bevelEnabled:true, bevelThickness:0.001,
    bevelSize:0.0008, bevelSegments:2, steps:1,
  }), [shellMaterial("#fafbf7"), shellMaterial("#c8d4ca")]);
  tail.position.z = headBox.min.z - 0.002;
  tail.castShadow = true;
  return tail;
}

export function createStackchanScene(canvas, loading) {
  const { texture, draw } = faceTexture();
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.005, 2);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.11;
  controls.maxDistance = 0.45;
  controls.maxPolarAngle = Math.PI * 0.78;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8da79b, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(0.10,0.19,0.16);
  key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -0.18;
  key.shadow.camera.right = key.shadow.camera.top = 0.18;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd8e9e0, 1.1);
  fill.position.set(-0.13,0.06,-0.10);
  scene.add(fill);
  let yawRig, pitchRig, pendingYaw = 0, pendingPitch = 30;

  function resize() {
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  function frame() {
    controls.update();
    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const loader = new GLTFLoader();
  const load = (name) => new Promise((resolve,reject) => loader.load(asset(name),resolve,undefined,reject));
  Promise.all([load("assembled.glb"),load("coreS3_face.glb")]).then(([bodyFile,faceFile]) => {
    const root = bodyFile.scene;
    const palette = {
      MainBody:"#f5f7f3", Base:"#eef1ea", BaseCover:"#dfe6dc",
      ServoBody:"#242c2a", ServoArm:"#313b36", ServoCover:"#d3ddd2",
      ServoSideCover:"#d4ded4", BearingFixture:"#aebbb0",
      "LightGuideBar-A":"#f1f4ef", "LightGuideBar-B":"#f1f4ef",
    };
    root.traverse((part) => {
      if (!part.isMesh) return;
      part.material = shellMaterial(palette[part.name] || "#e5ebe4");
      part.castShadow = true;
      part.receiveShadow = true;
    });
    scene.add(root);
    root.updateMatrixWorld(true);
    const head = root.getObjectByName("MainBody");
    if (!head) throw new Error("MainBody がモデル内にありません。");
    const headBox = new THREE.Box3().setFromObject(head);
    const headSize = headBox.getSize(new THREE.Vector3());
    const core = faceFile.scene;
    const coreBox = new THREE.Box3().setFromObject(core);
    const coreSize = coreBox.getSize(new THREE.Vector3());
    const coreCenter = coreBox.getCenter(new THREE.Vector3());
    const k = headSize.x * 0.92 / coreSize.x;
    core.scale.setScalar(k);
    core.rotation.z = Math.PI;
    core.position.set(coreCenter.x*k, coreCenter.y*k,
      -coreCenter.z*k-coreSize.z*k/2+headSize.y*0.12);
    core.traverse((part) => { if (part.isMesh) {part.material=shellMaterial("#f2f5f0");part.castShadow=true;} });
    const caseMount = new THREE.Group();
    caseMount.name = "CoreS3";
    const saved = root.getObjectByName("CoreS3_Xform");
    if (saved) {
      caseMount.position.copy(saved.position);
      caseMount.quaternion.copy(saved.quaternion);
      caseMount.scale.copy(saved.scale);
      saved.removeFromParent();
    } else caseMount.position.set(headBox.getCenter(new THREE.Vector3()).x,
      headBox.getCenter(new THREE.Vector3()).y,headBox.max.z);
    caseMount.add(core);
    const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(coreSize.x*k*0.99,coreSize.x*k*0.99),
      new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
    facePlane.position.z = headSize.y*0.12 + headSize.y*0.006;
    facePlane.renderOrder = 3;
    caseMount.add(facePlane);
    root.add(caseMount);

    yawRig = new THREE.Group();
    yawRig.position.set(0,-0.017,0);
    root.add(yawRig);
    pitchRig = new THREE.Group();
    pitchRig.position.set(0,0.014,0);
    yawRig.add(pitchRig);
    root.updateMatrixWorld(true);
    for (const name of ["MainBody","LightGuideBar-A","LightGuideBar-B","ServoArm"]) {
      const part = root.getObjectByName(name);
      if (part) pitchRig.attach(part);
    }
    pitchRig.attach(caseMount);
    for (const x of [-0.0155,0.0155]) for (const ear of makeEar(x,headBox.max.y,headBox.max.z)) {
      root.add(ear);pitchRig.attach(ear);
    }
    const tail = makeTail(headBox);
    root.add(tail);pitchRig.attach(tail);

    const assemblyBox = new THREE.Box3().setFromObject(root);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.4),
      new THREE.ShadowMaterial({opacity:0.23}));
    ground.rotation.x = -Math.PI/2;
    ground.position.y = assemblyBox.min.y - 0.001;
    ground.receiveShadow = true;
    scene.add(ground);
    const target = assemblyBox.getCenter(new THREE.Vector3());
    target.y += 0.002;
    controls.target.copy(target);
    camera.position.set(target.x,target.y+0.025,target.z+0.19);
    camera.lookAt(target);
    controls.update();
    yawRig.rotation.y = THREE.MathUtils.degToRad(pendingYaw);
    pitchRig.rotation.x = THREE.MathUtils.degToRad(15-pendingPitch);
    loading.hidden = true;
  }).catch(() => {
    loading.textContent = "3Dモデルを読み込めませんでした。サーバーの状態を確認してください。";
  });

  return {
    setFaceCanvas:draw,
    setPose(yaw,pitch) {
      pendingYaw = yaw; pendingPitch = pitch;
      if (yawRig && pitchRig) {
        yawRig.rotation.y = THREE.MathUtils.degToRad(yaw);
        pitchRig.rotation.x = THREE.MathUtils.degToRad(15-pitch);
      }
    },
  };
}
