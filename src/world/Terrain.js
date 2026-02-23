import * as THREE from 'three';
import { SimplexNoise } from '../utils/SimplexNoise.js';
import { GRID_SIZE, CELL_TYPES } from '../utils/constants.js';
import { eventBus } from '../utils/EventBus.js';

export class Terrain {
  constructor(grid, seed) {
    this.grid = grid;
    this.seed = seed;
    this.noise = new SimplexNoise(seed);
    this.noiseDetail = new SimplexNoise(seed * 1.7);
    this.riverPoints = [];
    this.forestClusters = [];
    this.gatePosition = null;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
  }

  generate() {
    this._generateElevation();
    this._generateRiver();
    this._generateForests();
    this._placeGate();
    this._placeMarketSquare();
    this._buildTerrainMesh();
    this._buildWaterPlane();
    this._buildTreeMeshes();
    this._buildMarketSquareMesh();
    return this.group;
  }

  _generateElevation() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        let e = this.noise.fbm(x * 0.008, y * 0.008, 5, 2.2, 0.45);
        // Gentle hills — keep elevation subtle
        e = (e + 1) * 0.5; // Normalize to 0-1
        e = e * 3.0; // Max height ~3 units
        // Flatten center for market area
        const cx = GRID_SIZE / 2, cy = GRID_SIZE / 2;
        const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (distFromCenter < 20) {
          e *= Math.max(0.1, distFromCenter / 20);
        }
        this.grid.setElevation(x, y, e);
      }
    }
  }

  _generateRiver() {
    // River curves from one edge to another
    const startEdge = Math.random() < 0.5 ? 'top' : 'left';
    let rx, ry;
    if (startEdge === 'top') {
      rx = 40 + Math.floor(Math.random() * 30);
      ry = 0;
    } else {
      rx = 0;
      ry = 40 + Math.floor(Math.random() * 30);
    }

    const targetX = GRID_SIZE - 40 + Math.floor(Math.random() * 30);
    const targetY = GRID_SIZE - 1;

    this.riverPoints = [];
    while (ry < GRID_SIZE && rx < GRID_SIZE) {
      // Meander using noise
      const bend = this.noiseDetail.noise2D(rx * 0.02, ry * 0.02) * 3;
      rx = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(rx + bend * 0.3)));

      // Set river cells (width 2-3)
      const width = 2 + Math.floor(Math.abs(this.noise.noise2D(rx * 0.05, ry * 0.05)));
      for (let w = -width; w <= width; w++) {
        const cx = Math.round(rx + w);
        if (this.grid.inBounds(cx, ry)) {
          this.grid.setCell(cx, ry, { type: CELL_TYPES.WATER });
          this.grid.setElevation(cx, ry, -0.3);
          this.riverPoints.push({ x: cx, y: ry });
        }
      }

      // Move toward target
      if (rx < targetX) rx += Math.random() < 0.7 ? 1 : 0;
      else if (rx > targetX) rx -= Math.random() < 0.7 ? 1 : 0;
      ry++;
    }
  }

  _generateForests() {
    const forestCount = 2 + Math.floor(Math.random() * 2);
    const cx = GRID_SIZE / 2, cy = GRID_SIZE / 2;

    for (let f = 0; f < forestCount; f++) {
      // Place forests away from center
      let fx, fy;
      do {
        fx = 20 + Math.floor(Math.random() * (GRID_SIZE - 40));
        fy = 20 + Math.floor(Math.random() * (GRID_SIZE - 40));
      } while (Math.sqrt((fx - cx) ** 2 + (fy - cy) ** 2) < 30);

      const radius = 8 + Math.floor(Math.random() * 10);
      this.forestClusters.push({ x: fx, y: fy, radius });

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;
          const tx = fx + dx, ty = fy + dy;
          if (!this.grid.inBounds(tx, ty)) continue;
          const cell = this.grid.getCell(tx, ty);
          if (cell.type !== CELL_TYPES.EMPTY) continue;
          // Organic edge using noise
          const edgeNoise = this.noise.noise2D(tx * 0.1, ty * 0.1);
          if (dist > radius * 0.7 && edgeNoise > 0) continue;
          this.grid.setCell(tx, ty, { type: CELL_TYPES.FOREST });
        }
      }
    }
  }

  _placeGate() {
    // Place gate on grid edge
    const edge = Math.floor(Math.random() * 4);
    let gx, gy;
    switch (edge) {
      case 0: gx = GRID_SIZE / 2 + Math.floor(Math.random() * 20 - 10); gy = 2; break;
      case 1: gx = GRID_SIZE - 3; gy = GRID_SIZE / 2 + Math.floor(Math.random() * 20 - 10); break;
      case 2: gx = GRID_SIZE / 2 + Math.floor(Math.random() * 20 - 10); gy = GRID_SIZE - 3; break;
      case 3: gx = 2; gy = GRID_SIZE / 2 + Math.floor(Math.random() * 20 - 10); break;
    }
    this.gatePosition = { x: Math.floor(gx), y: Math.floor(gy) };
    eventBus.emit('gatePlaced', this.gatePosition);
  }

  _placeMarketSquare() {
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);
    // 3x3 market square
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.grid.setCell(cx + dx, cy + dy, { type: CELL_TYPES.MARKET });
      }
    }
    eventBus.emit('marketPlaced', { x: cx, y: cy });
  }

  _buildTerrainMesh() {
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position;

    // Color array
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = Math.round(positions.getX(i) + GRID_SIZE / 2);
      const y = Math.round(positions.getZ(i) + GRID_SIZE / 2);
      const elev = this.grid.inBounds(x, y) ? this.grid.getElevation(x, y) : 0;
      positions.setY(i, elev);

      // Vertex colors
      const cell = this.grid.getCell(x, y);
      if (cell.type === CELL_TYPES.WATER) {
        colors[i * 3] = 0.15; colors[i * 3 + 1] = 0.25; colors[i * 3 + 2] = 0.35;
      } else if (cell.type === CELL_TYPES.FOREST) {
        const v = 0.12 + this.noise.noise2D(x * 0.3, y * 0.3) * 0.04;
        colors[i * 3] = v * 0.7; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v * 0.5;
      } else {
        // Earthy ground
        const v = 0.22 + this.noise.noise2D(x * 0.15, y * 0.15) * 0.06;
        colors[i * 3] = v; colors[i * 3 + 1] = v * 0.85; colors[i * 3 + 2] = v * 0.6;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.name = 'ground';
    this.group.add(this.terrainMesh);
  }

  _buildWaterPlane() {
    // Simple water plane at the river level
    const waterGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a3040,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.6,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = -0.2;
    this.waterMesh.receiveShadow = true;
    this.waterMesh.name = 'water';
    // Only render where there's water — clip using a smaller plane positioned at river
    // For simplicity, we'll keep it large but very transparent, the terrain dips into it at the river
    this.group.add(this.waterMesh);
  }

  _buildTreeMeshes() {
    // Instanced trees for forest cells
    const treeTrunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 5);
    const treeTopGeo = new THREE.ConeGeometry(0.4, 1.0, 6);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.8 });

    const forestCells = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.grid.getCell(x, y).type === CELL_TYPES.FOREST) {
          // Thin out for performance — ~40% density
          if (this.noise.noise2D(x * 0.5, y * 0.5) > -0.2) {
            forestCells.push({ x, y });
          }
        }
      }
    }

    if (forestCells.length === 0) return;

    const trunkInst = new THREE.InstancedMesh(treeTrunkGeo, trunkMat, forestCells.length);
    const leafInst = new THREE.InstancedMesh(treeTopGeo, leafMat, forestCells.length);
    trunkInst.castShadow = true;
    leafInst.castShadow = true;
    leafInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < forestCells.length; i++) {
      const { x, y } = forestCells[i];
      const wx = x - GRID_SIZE / 2;
      const wy = y - GRID_SIZE / 2;
      const elev = this.grid.getElevation(x, y);
      const scale = 0.7 + Math.random() * 0.6;
      const rotation = Math.random() * Math.PI * 2;

      // Trunk
      dummy.position.set(wx + Math.random() * 0.3, elev + 0.4 * scale, wy + Math.random() * 0.3);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = rotation;
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      // Leaves
      dummy.position.y = elev + 1.0 * scale;
      dummy.updateMatrix();
      leafInst.setMatrixAt(i, dummy.matrix);
    }

    this.treeInstances = { trunk: trunkInst, leaves: leafInst };
    this.group.add(trunkInst);
    this.group.add(leafInst);
  }

  getWorldPos(gridX, gridY) {
    return {
      x: gridX - GRID_SIZE / 2,
      y: this.grid.getElevation(gridX, gridY),
      z: gridY - GRID_SIZE / 2
    };
  }

  _buildMarketSquareMesh() {
    // Stone plaza at city center
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);
    const elev = this.grid.getElevation(cx, cy);

    const plazaGeo = new THREE.PlaneGeometry(3, 3);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x7a7a6a,
      roughness: 0.85,
      metalness: 0.05
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, elev + 0.03, 0);
    plaza.receiveShadow = true;
    this.group.add(plaza);

    // Market cross / well at center
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.8 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(0, elev + 0.4, 0);
    post.castShadow = true;
    this.group.add(post);

    // Cross top
    const crossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.04, 0.04),
      postMat
    );
    crossH.position.set(0, elev + 0.85, 0);
    crossH.castShadow = true;
    this.group.add(crossH);
  }

  updateSeasonColors(season) {
    if (!this.treeInstances) return;
    const leafMat = this.treeInstances.leaves.material;
    const seasonColors = [
      0x2a5a2a, // Spring — fresh green
      0x1a3a1a, // Summer — deep green
      0x8a4a1a, // Autumn — orange-brown
      0x4a4a5a  // Winter — grey-blue
    ];
    leafMat.color.setHex(seasonColors[season]);
  }
}
