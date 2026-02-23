import * as THREE from 'three';
import { BUILDING_TYPES } from '../utils/constants.js';

// Shared materials
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 });
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.9 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.8 });
const thatchMat = new THREE.MeshStandardMaterial({ color: 0x8a7a3a, roughness: 0.95 });
const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85 });
const windowMat = new THREE.MeshStandardMaterial({
  color: 0xffaa44,
  emissive: 0xffaa44,
  emissiveIntensity: 0.0,
  roughness: 0.3,
  transparent: true,
  opacity: 0.8
});

export function createBuildingGeometry(type, seed = Math.random()) {
  const group = new THREE.Group();
  group.userData.buildingType = type;
  group.userData.windowMaterials = [];
  group.userData.hasChimney = false;

  switch (type) {
    case BUILDING_TYPES.COTTAGE: buildCottage(group, seed); break;
    case BUILDING_TYPES.MANOR: buildManor(group, seed); break;
    case BUILDING_TYPES.CATHEDRAL: buildCathedral(group, seed); break;
    case BUILDING_TYPES.MILL: buildMill(group, seed); break;
    case BUILDING_TYPES.BLACKSMITH: buildBlacksmith(group, seed); break;
    case BUILDING_TYPES.INN: buildInn(group, seed); break;
    case BUILDING_TYPES.FARM: buildFarm(group, seed); break;
    case BUILDING_TYPES.GUILD_HALL: buildGuildHall(group, seed); break;
    default: buildCottage(group, seed);
  }

  // All buildings cast shadows
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

function buildCottage(group, seed) {
  const w = 0.6 + seed * 0.2;
  const d = 0.6 + seed * 0.2;
  const h = 0.5 + seed * 0.2;

  // Walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
  walls.position.y = h / 2;
  group.add(walls);

  // Steep thatched roof (pyramid)
  const roofH = 0.5 + seed * 0.15;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, roofH, 4), thatchMat);
  roof.position.y = h + roofH / 2;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  // Window
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.15), windowMat.clone());
  win.position.set(w / 2 + 0.001, h * 0.6, 0);
  win.rotation.y = Math.PI / 2;
  group.add(win);
  group.userData.windowMaterials.push(win.material);

  // Small chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), stoneMat);
  chimney.position.set(w * 0.2, h + roofH * 0.5, d * 0.2);
  group.add(chimney);
  group.userData.hasChimney = true;
  group.userData.chimneyPos = chimney.position.clone();
}

function buildManor(group, seed) {
  // L-shaped manor
  const mainW = 1.2, mainD = 0.8, mainH = 1.0;
  const wingW = 0.6, wingD = 0.6, wingH = 0.8;

  // Main block
  const main = new THREE.Mesh(new THREE.BoxGeometry(mainW, mainH, mainD), stoneMat);
  main.position.y = mainH / 2;
  group.add(main);

  // Main roof
  const mainRoof = new THREE.Mesh(
    new THREE.ConeGeometry(mainW * 0.6, 0.6, 4),
    roofMat
  );
  mainRoof.position.y = mainH + 0.3;
  mainRoof.rotation.y = Math.PI / 4;
  group.add(mainRoof);

  // Wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(wingW, wingH, wingD), stoneMat);
  wing.position.set(mainW / 2 + wingW / 2 - 0.1, wingH / 2, mainD / 2 - wingD / 2);
  group.add(wing);

  // Wing roof
  const wingRoof = new THREE.Mesh(new THREE.ConeGeometry(wingW * 0.55, 0.4, 4), roofMat);
  wingRoof.position.set(wing.position.x, wingH + 0.2, wing.position.z);
  wingRoof.rotation.y = Math.PI / 4;
  group.add(wingRoof);

  // Turret
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.4, 6), stoneMat);
  turret.position.set(mainW / 2, 0.7, -mainD / 2);
  group.add(turret);
  const turretTop = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 6), roofMat);
  turretTop.position.set(turret.position.x, 1.55, turret.position.z);
  group.add(turretTop);

  // Windows
  for (let i = 0; i < 3; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.18), windowMat.clone());
    win.position.set(-mainW / 2 - 0.001, mainH * 0.55, -0.25 + i * 0.25);
    win.rotation.y = -Math.PI / 2;
    group.add(win);
    group.userData.windowMaterials.push(win.material);
  }
}

function buildCathedral(group, seed) {
  // Cruciform footprint
  const naveW = 1.0, naveD = 2.5, naveH = 2.0;
  const transW = 1.8, transD = 0.6, transH = 1.6;

  // Nave
  const nave = new THREE.Mesh(new THREE.BoxGeometry(naveW, naveH, naveD), stoneMat);
  nave.position.y = naveH / 2;
  group.add(nave);

  // Nave roof (ridge)
  const naveRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(0, naveW * 0.6, 0.8, 4),
    roofMat
  );
  naveRoof.position.y = naveH + 0.4;
  naveRoof.rotation.y = Math.PI / 4;
  naveRoof.scale.z = naveD / naveW;
  group.add(naveRoof);

  // Transept
  const transept = new THREE.Mesh(new THREE.BoxGeometry(transW, transH, transD), stoneMat);
  transept.position.set(0, transH / 2, -0.3);
  group.add(transept);

  // Spire
  const spireBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), stoneMat);
  spireBase.position.set(0, naveH + 0.3, -naveD / 2 + 0.3);
  group.add(spireBase);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.2, 2.0, 8), darkStoneMat);
  spire.position.set(0, naveH + 1.6, -naveD / 2 + 0.3);
  group.add(spire);

  // Flying buttresses (simplified as angled boxes)
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), stoneMat);
      buttress.position.set(side * (naveW / 2 + 0.15), naveH * 0.4, -0.6 + i * 0.7);
      buttress.rotation.z = side * 0.3;
      group.add(buttress);
    }
  }

  // Rose window (circular detail on front)
  const roseGeo = new THREE.RingGeometry(0.15, 0.2, 12);
  const roseMat = windowMat.clone();
  const rose = new THREE.Mesh(roseGeo, roseMat);
  rose.position.set(0, naveH * 0.7, naveD / 2 + 0.001);
  group.add(rose);
  group.userData.windowMaterials.push(roseMat);

  // Side windows
  for (let i = 0; i < 4; i++) {
    for (let side = -1; side <= 1; side += 2) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.25), windowMat.clone());
      win.position.set(side * (naveW / 2 + 0.001), naveH * 0.5, -0.8 + i * 0.5);
      win.rotation.y = side * Math.PI / 2;
      group.add(win);
      group.userData.windowMaterials.push(win.material);
    }
  }
}

function buildMill(group, seed) {
  // Circular base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), stoneMat);
  base.position.y = 0.6;
  group.add(base);

  // Conical roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 8), roofMat);
  roof.position.y = 1.45;
  group.add(roof);

  // Sails (animated, so store reference)
  const sailGroup = new THREE.Group();
  sailGroup.position.set(0, 1.0, 0.5);
  sailGroup.rotation.x = 0.1;

  for (let i = 0; i < 4; i++) {
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.9), new THREE.MeshStandardMaterial({
      color: 0xccbb88, side: THREE.DoubleSide, roughness: 0.9
    }));
    sail.position.y = 0.45;
    sail.rotation.z = (Math.PI / 2) * i;
    const pivot = new THREE.Group();
    pivot.add(sail);
    pivot.rotation.z = (Math.PI / 2) * i;
    sailGroup.add(pivot);
  }
  group.add(sailGroup);
  group.userData.sails = sailGroup;

  // Door
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.35), woodMat);
  door.position.set(0, 0.175, 0.501);
  group.add(door);
}

function buildBlacksmith(group, seed) {
  // Squat wide building
  const w = 0.9, d = 0.7, h = 0.6;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkStoneMat);
  walls.position.y = h / 2;
  group.add(walls);

  // Low sloped roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.08, d + 0.1), roofMat);
  roof.position.y = h + 0.04;
  roof.rotation.x = 0.05;
  group.add(roof);

  // Wide chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.2), stoneMat);
  chimney.position.set(w * 0.2, h + 0.3, -d * 0.3);
  group.add(chimney);
  group.userData.hasChimney = true;
  group.userData.chimneyPos = new THREE.Vector3(w * 0.2, h + 0.6, -d * 0.3);

  // Anvil in front
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), darkStoneMat);
  anvil.position.set(0.15, 0.05, d / 2 + 0.15);
  group.add(anvil);

  // Window with glow
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), windowMat.clone());
  win.material.emissive.setHex(0xff6622);
  win.position.set(0, h * 0.5, d / 2 + 0.001);
  group.add(win);
  group.userData.windowMaterials.push(win.material);
}

function buildInn(group, seed) {
  // Wide two-story building
  const w = 1.1, d = 0.8, h = 1.0;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
  walls.position.y = h / 2;
  group.add(walls);

  // Steep roof
  const roofH = 0.6;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-w / 2 - 0.05, 0);
  roofShape.lineTo(0, roofH);
  roofShape.lineTo(w / 2 + 0.05, 0);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: d + 0.1, bevelEnabled: false });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.set(0, h, -d / 2 - 0.05);
  group.add(roofMesh);

  // Multiple warm windows
  for (let i = 0; i < 3; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.15), windowMat.clone());
    win.position.set(-0.3 + i * 0.3, h * 0.35, d / 2 + 0.001);
    group.add(win);
    group.userData.windowMaterials.push(win.material);

    // Upper windows
    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.12), windowMat.clone());
    win2.position.set(-0.3 + i * 0.3, h * 0.75, d / 2 + 0.001);
    group.add(win2);
    group.userData.windowMaterials.push(win2.material);
  }

  // Hanging sign
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), woodMat);
  signPost.position.set(w / 2 + 0.15, h * 0.7, d / 2);
  signPost.rotation.z = Math.PI / 2;
  group.add(signPost);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.02), woodMat);
  sign.position.set(w / 2 + 0.15, h * 0.55, d / 2);
  group.add(sign);

  // Chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), stoneMat);
  chimney.position.set(-w * 0.3, h + roofH * 0.3, 0);
  group.add(chimney);
  group.userData.hasChimney = true;
  group.userData.chimneyPos = new THREE.Vector3(-w * 0.3, h + roofH * 0.3 + 0.1, 0);
}

function buildFarm(group, seed) {
  // Long low barn
  const w = 1.5, d = 0.6, h = 0.5;
  const barn = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
  barn.position.y = h / 2;
  group.add(barn);

  // Simple peaked roof
  const roofH = 0.3;
  const roofGeo = new THREE.ConeGeometry(w * 0.55, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, thatchMat);
  roof.position.y = h + roofH / 2;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = d / w;
  group.add(roof);

  // Surrounding field (flat green-gold plane)
  const fieldMat = new THREE.MeshStandardMaterial({
    color: 0x8a9a3a,
    roughness: 0.95,
  });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), fieldMat);
  field.rotation.x = -Math.PI / 2;
  field.position.y = 0.01;
  field.receiveShadow = true;
  group.add(field);

  // Fence posts
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), woodMat);
    post.position.set(Math.cos(angle) * 1.4, 0.15, Math.sin(angle) * 1.4);
    group.add(post);
  }
}

function buildGuildHall(group, seed) {
  const w = 1.0, d = 0.9, h = 1.2;

  // Stone walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
  walls.position.y = h / 2;
  group.add(walls);

  // Peaked roof
  const roofH = 0.5;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-w / 2 - 0.05, 0);
  roofShape.lineTo(0, roofH);
  roofShape.lineTo(w / 2 + 0.05, 0);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: d + 0.1, bevelEnabled: false });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.set(0, h, -d / 2 - 0.05);
  group.add(roofMesh);

  // Arched doorway (simplified)
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 8, Math.PI), stoneMat);
  arch.position.set(0, 0.35, d / 2 + 0.001);
  group.add(arch);

  // Windows
  for (let side = -1; side <= 1; side += 2) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), windowMat.clone());
    win.position.set(side * (w / 2 + 0.001), h * 0.5, 0);
    win.rotation.y = side * Math.PI / 2;
    group.add(win);
    group.userData.windowMaterials.push(win.material);
  }
}

export function getWindowMaterials(buildingGroup) {
  return buildingGroup.userData.windowMaterials || [];
}

export function setWindowGlow(buildingGroup, intensity) {
  const mats = buildingGroup.userData.windowMaterials || [];
  for (const mat of mats) {
    mat.emissiveIntensity = intensity;
  }
}
