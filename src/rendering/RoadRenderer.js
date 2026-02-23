import * as THREE from 'three';
import { GRID_SIZE, CELL_TYPES, ROAD_LEVELS } from '../utils/constants.js';
import { eventBus } from '../utils/EventBus.js';

export class RoadRenderer {
  constructor(scene, grid, terrain) {
    this.scene = scene;
    this.grid = grid;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'roads';
    this.scene.add(this.group);

    this.roadMeshes = new Map();
    this.torchGroup = new THREE.Group();
    this.torchGroup.name = 'torches';
    this.group.add(this.torchGroup);
    this.torchLights = [];
    this.torchInterval = 0;

    // Materials for road levels — high contrast against earthy terrain
    this.materials = {
      [ROAD_LEVELS.DIRT]: new THREE.MeshStandardMaterial({
        color: 0xb09870,
        roughness: 0.95,
        metalness: 0
      }),
      [ROAD_LEVELS.COBBLESTONE]: new THREE.MeshStandardMaterial({
        color: 0x9a9590,
        roughness: 0.75,
        metalness: 0.05
      }),
      [ROAD_LEVELS.BOULEVARD]: new THREE.MeshStandardMaterial({
        color: 0xc0b8a8,
        roughness: 0.6,
        metalness: 0.1
      })
    };

    // Shared geometry — full cell width for seamless tiling
    this.roadGeo = new THREE.PlaneGeometry(1.0, 1.0);
    this.roadGeo.rotateX(-Math.PI / 2);

    // Listen for road events
    eventBus.on('roadPlaced', (data) => this._addRoadMesh(data.x, data.y, data.level));
    eventBus.on('roadUpgraded', (data) => this._upgradeRoadMesh(data.x, data.y, data.level));
  }

  _addRoadMesh(gx, gy, level) {
    const key = `${gx},${gy}`;
    if (this.roadMeshes.has(key)) return;

    const mesh = new THREE.Mesh(this.roadGeo, this.materials[level]);
    const wp = this.terrain.getWorldPos(gx, gy);
    mesh.position.set(wp.x, wp.y + 0.05, wp.z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.roadMeshes.set(key, mesh);
  }

  _upgradeRoadMesh(gx, gy, level) {
    const key = `${gx},${gy}`;
    const mesh = this.roadMeshes.get(key);
    if (mesh) {
      mesh.material = this.materials[level];
    }
  }

  update(dt, timeOfDay) {
    // Place torches at night along roads
    this.torchInterval -= dt;
    if (this.torchInterval <= 0) {
      this.torchInterval = 15; // re-check every 15 seconds
      this._updateTorches(timeOfDay);
    }

    // Flicker torches
    const isNight = timeOfDay > 20 || timeOfDay < 5;
    for (const torch of this.torchLights) {
      torch.light.visible = isNight;
      if (isNight) {
        torch.light.intensity = 0.4 + Math.sin(Date.now() * 0.01 + torch.phase) * 0.15;
      }
    }
  }

  _updateTorches(timeOfDay) {
    // Only create torches once, then just toggle visibility
    if (this.torchLights.length > 0) return;

    const roadCells = this.grid.getRoadCells();
    // Place torches every ~8 road cells
    let count = 0;
    const maxTorches = 30; // Performance limit
    for (let i = 0; i < roadCells.length && count < maxTorches; i += 8) {
      const { x, y } = roadCells[i];
      const wp = this.terrain.getWorldPos(x, y);

      // Torch post
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x3d2b1f })
      );
      post.position.set(wp.x + 0.3, wp.y + 0.25, wp.z);
      this.torchGroup.add(post);

      // Torch flame (point light)
      const light = new THREE.PointLight(0xff9944, 0.4, 4, 2);
      light.position.set(wp.x + 0.3, wp.y + 0.55, wp.z);
      light.visible = false;
      this.torchGroup.add(light);

      this.torchLights.push({ light, phase: Math.random() * Math.PI * 2 });
      count++;
    }
  }
}
