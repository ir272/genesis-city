import { GRID_SIZE, CELL_TYPES } from './constants.js';

class MinHeap {
  constructor() {
    this.data = [];
  }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f < this.data[parent].f) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const len = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < len && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < len && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else break;
    }
  }
}

const DIRS = [
  [0, 1], [1, 0], [0, -1], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

export function findPath(grid, startX, startY, endX, endY, opts = {}) {
  const {
    allowDiagonal = false,
    noiseFn = null,
    noiseScale = 0,
    avoidTypes = [CELL_TYPES.WATER],
    preferRoads = false,
    maxIterations = 10000
  } = opts;

  const dirs = allowDiagonal ? DIRS : DIRS.slice(0, 4);

  if (!inBounds(startX, startY) || !inBounds(endX, endY)) return null;

  const open = new MinHeap();
  const closed = new Set();
  const gScore = new Map();
  const parent = new Map();

  const key = (x, y) => y * GRID_SIZE + x;
  const heuristic = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

  const startKey = key(startX, startY);
  gScore.set(startKey, 0);
  open.push({ x: startX, y: startY, f: heuristic(startX, startY, endX, endY) });

  let iterations = 0;
  while (open.size > 0 && iterations < maxIterations) {
    iterations++;
    const current = open.pop();
    const ck = key(current.x, current.y);

    if (current.x === endX && current.y === endY) {
      // Reconstruct path
      const path = [];
      let k = ck;
      while (k !== undefined) {
        const y = Math.floor(k / GRID_SIZE);
        const x = k % GRID_SIZE;
        path.unshift({ x, y });
        k = parent.get(k);
      }
      return path;
    }

    if (closed.has(ck)) continue;
    closed.add(ck);

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!inBounds(nx, ny)) continue;

      const nk = key(nx, ny);
      if (closed.has(nk)) continue;

      const cell = grid.getCell(nx, ny);
      if (avoidTypes.includes(cell.type)) continue;

      let moveCost = (dx !== 0 && dy !== 0) ? 1.414 : 1;

      // Add noise for organic paths
      if (noiseFn && noiseScale > 0) {
        moveCost += noiseFn(nx * 0.1, ny * 0.1) * noiseScale;
      }

      // Prefer roads for citizen pathfinding
      if (preferRoads && cell.type === CELL_TYPES.ROAD) {
        moveCost *= 0.3;
      }

      const tentativeG = (gScore.get(ck) || 0) + moveCost;
      if (tentativeG < (gScore.get(nk) || Infinity)) {
        gScore.set(nk, tentativeG);
        parent.set(nk, ck);
        open.push({ x: nx, y: ny, f: tentativeG + heuristic(nx, ny, endX, endY) });
      }
    }
  }
  return null;
}

function inBounds(x, y) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

// Cache for citizen paths
const pathCache = new Map();
const CACHE_MAX = 200;

export function findPathCached(grid, sx, sy, ex, ey, opts = {}) {
  const cacheKey = `${sx},${sy}-${ex},${ey}`;
  if (pathCache.has(cacheKey)) return pathCache.get(cacheKey);

  const path = findPath(grid, sx, sy, ex, ey, { ...opts, preferRoads: true });
  if (path) {
    if (pathCache.size >= CACHE_MAX) {
      const firstKey = pathCache.keys().next().value;
      pathCache.delete(firstKey);
    }
    pathCache.set(cacheKey, path);
  }
  return path;
}

export function clearPathCache() {
  pathCache.clear();
}
