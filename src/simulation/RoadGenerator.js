import { GRID_SIZE, CELL_TYPES, ROAD_LEVELS, TRAFFIC_COBBLESTONE, TRAFFIC_BOULEVARD } from '../utils/constants.js';
import { findPath } from '../utils/AStar.js';
import { SimplexNoise } from '../utils/SimplexNoise.js';
import { eventBus } from '../utils/EventBus.js';

export class RoadGenerator {
  constructor(grid, seed) {
    this.grid = grid;
    this.noise = new SimplexNoise(seed * 2.3);
    this.primaryRoads = [];
    this.secondaryRoads = [];
    this.pendingRoads = [];
    this.roadMeshes = new Map();
    this.lastBranchTime = 0;
    this.branchInterval = 15; // seconds between branch attempts
  }

  init(marketPos, gatePos, forestClusters, riverPoints) {
    this.marketPos = marketPos;
    this.attractors = [];
    if (gatePos) this.attractors.push(gatePos);

    // Add river bank points as attractors
    if (riverPoints && riverPoints.length > 0) {
      // Sample a few river-adjacent points
      for (let i = 0; i < riverPoints.length; i += 40) {
        const rp = riverPoints[i];
        // Find adjacent land cell
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = rp.x + dx, ny = rp.y + dy;
          if (this.grid.inBounds(nx, ny) && this.grid.getCell(nx, ny).type === CELL_TYPES.EMPTY) {
            this.attractors.push({ x: nx, y: ny });
            break;
          }
        }
      }
    }

    // Forest edges as attractors
    if (forestClusters) {
      for (const fc of forestClusters) {
        this.attractors.push({ x: fc.x + fc.radius, y: fc.y });
        this.attractors.push({ x: fc.x, y: fc.y + fc.radius });
      }
    }

    // Queue primary roads from market to each attractor
    for (const att of this.attractors) {
      this.pendingRoads.push({
        from: { ...this.marketPos },
        to: att,
        type: 'primary',
        progress: 0
      });
    }
  }

  update(dt, realTimeElapsed) {
    // Grow pending roads gradually
    for (let i = this.pendingRoads.length - 1; i >= 0; i--) {
      const road = this.pendingRoads[i];
      if (!road.path) {
        // Generate path with noise for organic curves
        road.path = findPath(this.grid, road.from.x, road.from.y, road.to.x, road.to.y, {
          noiseFn: (x, y) => this.noise.noise2D(x, y),
          noiseScale: 3.0,
          avoidTypes: [CELL_TYPES.WATER, CELL_TYPES.BUILDING]
        });
        if (!road.path || road.path.length < 2) {
          this.pendingRoads.splice(i, 1);
          continue;
        }
        road.placed = 0;
      }

      // Place cells gradually — primary roads grow faster
      const speed = road.type === 'primary' ? 8 : 4; // cells per second
      road.progress += dt * speed;

      while (road.placed < road.path.length && road.progress >= 1) {
        const point = road.path[road.placed];
        const cell = this.grid.getCell(point.x, point.y);
        if (cell.type === CELL_TYPES.EMPTY || cell.type === CELL_TYPES.FOREST) {
          this.grid.setCell(point.x, point.y, {
            type: CELL_TYPES.ROAD,
            roadLevel: ROAD_LEVELS.DIRT,
            traffic: 0
          });
          eventBus.emit('roadPlaced', { x: point.x, y: point.y, level: ROAD_LEVELS.DIRT });
        }
        road.placed++;
        road.progress -= 1;
      }

      if (road.placed >= road.path.length) {
        if (road.type === 'primary') this.primaryRoads.push(road.path);
        else this.secondaryRoads.push(road.path);
        this.pendingRoads.splice(i, 1);
      }
    }

    // Branch secondary roads periodically
    if (realTimeElapsed - this.lastBranchTime > this.branchInterval && realTimeElapsed > 10) {
      this.lastBranchTime = realTimeElapsed;
      this._tryBranchRoad();
    }

    // Upgrade roads based on traffic
    this._upgradeRoads();
  }

  _tryBranchRoad() {
    // Pick a random point on an existing road
    const roadCells = this.grid.getRoadCells();
    if (roadCells.length === 0) return;

    // Prefer high-traffic cells for branching
    const weighted = roadCells.filter(rc => {
      const cell = this.grid.getCell(rc.x, rc.y);
      return cell.traffic > 5 || Math.random() < 0.3;
    });
    if (weighted.length === 0) return;

    const source = weighted[Math.floor(Math.random() * weighted.length)];

    // Find a direction away from existing roads
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.floor(Math.random() * 25);
    const targetX = Math.round(source.x + Math.cos(angle) * dist);
    const targetY = Math.round(source.y + Math.sin(angle) * dist);

    if (!this.grid.inBounds(targetX, targetY)) return;
    if (this.grid.getCell(targetX, targetY).type === CELL_TYPES.WATER) return;

    this.pendingRoads.push({
      from: source,
      to: { x: targetX, y: targetY },
      type: 'secondary',
      progress: 0
    });
  }

  _upgradeRoads() {
    const roadCells = this.grid.getRoadCells();
    for (const { x, y } of roadCells) {
      const cell = this.grid.getCell(x, y);
      if (cell.traffic >= TRAFFIC_BOULEVARD && cell.roadLevel < ROAD_LEVELS.BOULEVARD) {
        cell.roadLevel = ROAD_LEVELS.BOULEVARD;
        eventBus.emit('roadUpgraded', { x, y, level: ROAD_LEVELS.BOULEVARD });
      } else if (cell.traffic >= TRAFFIC_COBBLESTONE && cell.roadLevel < ROAD_LEVELS.COBBLESTONE) {
        cell.roadLevel = ROAD_LEVELS.COBBLESTONE;
        eventBus.emit('roadUpgraded', { x, y, level: ROAD_LEVELS.COBBLESTONE });
      }
    }
  }

  getPendingCount() {
    return this.pendingRoads.length;
  }
}
