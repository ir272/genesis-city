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

    this.torchGroup = new THREE.Group();
    this.torchGroup.name = 'torches';
    this.group.add(this.torchGroup);
    this.torchLights = [];
    this.torchInterval = 0;

    // Track road cells for batch rebuild
    this.roadCells = new Map(); // key -> { level }
    this.roadMesh = null;
    this.needsRebuild = false;
    this.rebuildTimer = 0;

    // Materials for road levels — high contrast against earthy terrain
    this.levelColors = {
      [ROAD_LEVELS.DIRT]: new THREE.Color(0xb09870),
      [ROAD_LEVELS.COBBLESTONE]: new THREE.Color(0x9a9590),
      [ROAD_LEVELS.BOULEVARD]: new THREE.Color(0xc0b8a8)
    };

    this.roadMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.02,
      side: THREE.DoubleSide
    });

    // Listen for road events
    eventBus.on('roadPlaced', (data) => {
      this.roadCells.set(`${data.x},${data.y}`, { x: data.x, y: data.y, level: data.level });
      this.needsRebuild = true;
    });
    eventBus.on('roadUpgraded', (data) => {
      const key = `${data.x},${data.y}`;
      const cell = this.roadCells.get(key);
      if (cell) {
        cell.level = data.level;
        this.needsRebuild = true;
      }
    });
  }

  _rebuildRoadMesh() {
    // Remove old mesh
    if (this.roadMesh) {
      this.group.remove(this.roadMesh);
      this.roadMesh.geometry.dispose();
      this.roadMesh = null;
    }

    const cells = Array.from(this.roadCells.values());
    if (cells.length === 0) return;

    // Build a single merged geometry with vertex colors
    const verticesPerCell = 6; // 2 triangles = 6 vertices
    const positions = new Float32Array(cells.length * verticesPerCell * 3);
    const colors = new Float32Array(cells.length * verticesPerCell * 3);

    const offset = 0.08; // height above terrain
    const halfSize = 0.52; // slightly larger than 0.5 to overlap and cover gaps

    for (let i = 0; i < cells.length; i++) {
      const { x: gx, y: gy, level } = cells[i];
      const color = this.levelColors[level] || this.levelColors[ROAD_LEVELS.DIRT];

      // World center
      const cx = gx - GRID_SIZE / 2;
      const cz = gy - GRID_SIZE / 2;

      // Sample elevation at 4 corners for terrain-conforming quad
      const e00 = this._getElevSafe(gx, gy) + offset;
      const e10 = this._getElevSafe(gx + 1, gy) + offset;
      const e01 = this._getElevSafe(gx, gy + 1) + offset;
      const e11 = this._getElevSafe(gx + 1, gy + 1) + offset;

      // Average nearby elevations for smoother conforming
      const eMid = (e00 + e10 + e01 + e11) / 4;

      // 4 corners of the quad (slightly expanded)
      const x0 = cx - halfSize, z0 = cz - halfSize;
      const x1 = cx + halfSize, z1 = cz + halfSize;

      // Blend corner elevations toward center for smoother result
      const blend = 0.7;
      const y00 = e00 * blend + eMid * (1 - blend);
      const y10 = e10 * blend + eMid * (1 - blend);
      const y01 = e01 * blend + eMid * (1 - blend);
      const y11 = e11 * blend + eMid * (1 - blend);

      const base = i * verticesPerCell * 3;

      // Triangle 1
      positions[base]     = x0; positions[base + 1] = y00; positions[base + 2] = z0;
      positions[base + 3] = x0; positions[base + 4] = y01; positions[base + 5] = z1;
      positions[base + 6] = x1; positions[base + 7] = y11; positions[base + 8] = z1;

      // Triangle 2
      positions[base + 9]  = x0; positions[base + 10] = y00; positions[base + 11] = z0;
      positions[base + 12] = x1; positions[base + 13] = y11; positions[base + 14] = z1;
      positions[base + 15] = x1; positions[base + 16] = y10; positions[base + 17] = z0;

      // Vertex colors
      for (let v = 0; v < verticesPerCell; v++) {
        const cb = (i * verticesPerCell + v) * 3;
        colors[cb] = color.r;
        colors[cb + 1] = color.g;
        colors[cb + 2] = color.b;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    this.roadMesh = new THREE.Mesh(geo, this.roadMaterial);
    this.roadMesh.receiveShadow = true;
    this.roadMesh.name = 'road-surface';
    this.group.add(this.roadMesh);
  }

  _getElevSafe(gx, gy) {
    // Average elevation from grid, with bounds safety
    if (this.grid.inBounds(gx, gy)) {
      return this.grid.getElevation(gx, gy);
    }
    // Clamp to nearest valid cell
    const cx = Math.max(0, Math.min(GRID_SIZE - 1, gx));
    const cy = Math.max(0, Math.min(GRID_SIZE - 1, gy));
    return this.grid.getElevation(cx, cy);
  }

  update(dt, timeOfDay) {
    // Batch rebuild road mesh periodically when dirty
    if (this.needsRebuild) {
      this.rebuildTimer -= dt;
      if (this.rebuildTimer <= 0) {
        this._rebuildRoadMesh();
        this.needsRebuild = false;
        this.rebuildTimer = 0.5; // rebuild at most every 0.5s
      }
    }

    // Place torches at night along roads
    this.torchInterval -= dt;
    if (this.torchInterval <= 0) {
      this.torchInterval = 15;
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
    if (this.torchLights.length > 0) return;

    const roadCells = this.grid.getRoadCells();
    let count = 0;
    const maxTorches = 30;
    for (let i = 0; i < roadCells.length && count < maxTorches; i += 8) {
      const { x, y } = roadCells[i];
      const wp = this.terrain.getWorldPos(x, y);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4),
        new THREE.MeshStandardMaterial({ color: 0x3d2b1f })
      );
      post.position.set(wp.x + 0.3, wp.y + 0.3, wp.z);
      post.castShadow = true;
      this.torchGroup.add(post);

      const light = new THREE.PointLight(0xff9944, 0.5, 5, 2);
      light.position.set(wp.x + 0.3, wp.y + 0.65, wp.z);
      light.visible = false;
      this.torchGroup.add(light);

      this.torchLights.push({ light, phase: Math.random() * Math.PI * 2 });
      count++;
    }
  }
}
