import * as THREE from 'three';
import { GRID_SIZE, CELL_TYPES } from '../utils/constants.js';

export class Tooltip {
  constructor(camera, grid, registry, terrain) {
    this.camera = camera;
    this.grid = grid;
    this.registry = registry;
    this.terrain = terrain;
    this.el = document.getElementById('tooltip');
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = null;

    document.addEventListener('click', (e) => this._onClick(e));
    document.addEventListener('mousemove', (e) => this._onMove(e));
  }

  setGroundMesh(mesh) {
    this.groundPlane = mesh;
  }

  _onClick(e) {
    if (e.target.tagName === 'BUTTON') return;

    this.mouse.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Raycast against ground
    if (this.groundPlane) {
      const intersects = this.raycaster.intersectObject(this.groundPlane);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const gx = Math.round(point.x + GRID_SIZE / 2);
        const gy = Math.round(point.z + GRID_SIZE / 2);

        if (this.grid.inBounds(gx, gy)) {
          const cell = this.grid.getCell(gx, gy);
          const info = this._getCellInfo(gx, gy, cell);

          this.el.textContent = info;
          this.el.style.display = 'block';
          this.el.style.left = e.clientX + 15 + 'px';
          this.el.style.top = e.clientY - 10 + 'px';

          // Hide after 3 seconds
          clearTimeout(this._hideTimer);
          this._hideTimer = setTimeout(() => {
            this.el.style.display = 'none';
          }, 3000);
        }
      }
    }
  }

  _onMove(e) {
    // Subtle: hide tooltip on move if far from click point
    if (this.el.style.display === 'block') {
      const rect = this.el.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      if (Math.abs(dx) > 100 || Math.abs(dy) > 100) {
        this.el.style.display = 'none';
      }
    }
  }

  _getCellInfo(gx, gy, cell) {
    const typeNames = {
      [CELL_TYPES.EMPTY]: 'Empty land',
      [CELL_TYPES.ROAD]: 'Road',
      [CELL_TYPES.BUILDING]: 'Building',
      [CELL_TYPES.WATER]: 'River',
      [CELL_TYPES.FOREST]: 'Forest',
      [CELL_TYPES.FARM]: 'Farmland',
      [CELL_TYPES.MARKET]: 'Market Square',
      [CELL_TYPES.PLAZA]: 'Plaza'
    };

    if (cell.type === CELL_TYPES.BUILDING && cell.buildingId) {
      const building = this.registry.get(cell.buildingId);
      if (building) {
        const yearBuilt = Math.floor(building.builtDay / 120) + 1;
        return `${building.name} \u2014 built Year ${yearBuilt}`;
      }
    }

    if (cell.type === CELL_TYPES.ROAD) {
      const levels = ['Dirt path', 'Cobblestone road', 'Wide boulevard'];
      return `${levels[cell.roadLevel]} \u2014 ${cell.traffic} travelers`;
    }

    return typeNames[cell.type] || 'Unknown';
  }
}
