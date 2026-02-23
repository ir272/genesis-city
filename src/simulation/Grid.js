import { GRID_SIZE, CELL_TYPES, ROAD_LEVELS } from '../utils/constants.js';
import { eventBus } from '../utils/EventBus.js';

export class Grid {
  constructor() {
    this.cells = new Array(GRID_SIZE * GRID_SIZE);
    this.elevation = new Float32Array(GRID_SIZE * GRID_SIZE);
    this.history = []; // For time-lapse replay

    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = {
        type: CELL_TYPES.EMPTY,
        buildingType: null,
        buildingId: null,
        roadLevel: ROAD_LEVELS.DIRT,
        traffic: 0,
        age: 0,
        ownerId: null,
        metadata: null
      };
    }
  }

  idx(x, y) {
    return y * GRID_SIZE + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
  }

  getCell(x, y) {
    if (!this.inBounds(x, y)) return { type: CELL_TYPES.EMPTY };
    return this.cells[this.idx(x, y)];
  }

  setCell(x, y, data) {
    if (!this.inBounds(x, y)) return;
    const cell = this.cells[this.idx(x, y)];
    Object.assign(cell, data);
    eventBus.emit('cellChanged', { x, y, cell });
  }

  getElevation(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.elevation[this.idx(x, y)];
  }

  setElevation(x, y, val) {
    if (!this.inBounds(x, y)) return;
    this.elevation[this.idx(x, y)] = val;
  }

  incrementTraffic(x, y) {
    if (!this.inBounds(x, y)) return;
    const cell = this.cells[this.idx(x, y)];
    if (cell.type === CELL_TYPES.ROAD) {
      cell.traffic++;
    }
  }

  getNeighbors(x, y, includeDiagonal = false) {
    const neighbors = [];
    const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
    if (includeDiagonal) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (this.inBounds(nx, ny)) {
        neighbors.push({ x: nx, y: ny, cell: this.getCell(nx, ny) });
      }
    }
    return neighbors;
  }

  countNearbyType(x, y, type, radius) {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, ny) && this.getCell(nx, ny).type === type) {
          count++;
        }
      }
    }
    return count;
  }

  isAdjacentToRoad(x, y) {
    return this.getNeighbors(x, y).some(n => n.cell.type === CELL_TYPES.ROAD);
  }

  findNearestOfType(x, y, type, maxRadius = 50) {
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (this.inBounds(nx, ny) && this.getCell(nx, ny).type === type) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return null;
  }

  getRandomEmptyCellNear(x, y, radius, condition = null) {
    const candidates = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const cell = this.getCell(nx, ny);
        if (cell.type === CELL_TYPES.EMPTY) {
          if (!condition || condition(nx, ny, cell)) {
            candidates.push({ x: nx, y: ny });
          }
        }
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  ageCells(gameDays) {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].type !== CELL_TYPES.EMPTY) {
        this.cells[i].age = gameDays;
      }
    }
  }

  getRoadCells() {
    const roads = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.getCell(x, y).type === CELL_TYPES.ROAD) {
          roads.push({ x, y });
        }
      }
    }
    return roads;
  }

  getBuildingCells() {
    const buildings = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.getCell(x, y);
        if (cell.type === CELL_TYPES.BUILDING) {
          buildings.push({ x, y, cell });
        }
      }
    }
    return buildings;
  }

  distanceToCenter(x, y) {
    const cx = GRID_SIZE / 2, cy = GRID_SIZE / 2;
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  }

  getZone(x, y) {
    const dist = this.distanceToCenter(x, y);
    if (dist < 15) return 'market';
    if (dist < 45) return 'residential';
    return 'industrial';
  }
}
