import * as THREE from 'three';
import { GRID_SIZE, CELL_TYPES, BUILDING_TYPES, CATHEDRAL_POP_THRESHOLD } from '../utils/constants.js';
import { createBuildingGeometry, setWindowGlow } from '../buildings/BuildingGeometry.js';
import { eventBus } from '../utils/EventBus.js';

export class BuildingSpawner {
  constructor(grid, registry, scene, terrain) {
    this.grid = grid;
    this.registry = registry;
    this.scene = scene;
    this.terrain = terrain;
    this.buildingsGroup = new THREE.Group();
    this.buildingsGroup.name = 'buildings';
    this.scene.add(this.buildingsGroup);
    this.spawnCooldown = 0;
    this.cathedralBuilt = false;
    this.constructingBuildings = [];
  }

  update(dt, gameDays, population) {
    this.spawnCooldown -= dt;

    // Construction animations
    for (let i = this.constructingBuildings.length - 1; i >= 0; i--) {
      const b = this.constructingBuildings[i];
      b.constructionProgress += dt / 4; // 4 seconds to build
      if (b.constructionProgress >= 1) {
        b.constructionProgress = 1;
        b.isConstructing = false;
        b.mesh.position.y = b.targetY;
        b.mesh.scale.set(1, 1, 1);
        this.constructingBuildings.splice(i, 1);
      } else {
        // Rise from ground
        const t = b.constructionProgress;
        const eased = t * t * (3 - 2 * t); // smooth step
        b.mesh.position.y = b.startY + (b.targetY - b.startY) * eased;
        b.mesh.scale.y = 0.1 + 0.9 * eased;
      }
    }

    if (this.spawnCooldown > 0) return;

    // Try to spawn a building
    const spawned = this._trySpawn(gameDays, population);
    if (spawned) {
      this.spawnCooldown = 3 + Math.random() * 5; // 3-8 seconds between spawns
    } else {
      this.spawnCooldown = 1;
    }
  }

  _trySpawn(gameDays, population) {
    // Find road-adjacent empty cells
    const candidates = [];
    const roadCells = this.grid.getRoadCells();

    for (const { x: rx, y: ry } of roadCells) {
      const neighbors = this.grid.getNeighbors(rx, ry);
      for (const n of neighbors) {
        if (n.cell.type === CELL_TYPES.EMPTY && !this._hasAdjacentBuilding(n.x, n.y, 1)) {
          candidates.push({ x: n.x, y: n.y });
        }
      }
    }

    if (candidates.length === 0) return false;

    // Pick one candidate weighted by zone appropriateness
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const zone = this.grid.getZone(chosen.x, chosen.y);
    const buildingType = this._pickBuildingType(zone, population);

    if (!buildingType) return false;

    // Check cathedral threshold
    if (buildingType === BUILDING_TYPES.CATHEDRAL) {
      if (this.cathedralBuilt) return false;
      this.cathedralBuilt = true;
    }

    // Create building
    const mesh = createBuildingGeometry(buildingType, Math.random());
    const worldPos = this.terrain.getWorldPos(chosen.x, chosen.y);

    const targetY = worldPos.y;
    const startY = worldPos.y - 2;
    mesh.position.set(worldPos.x, startY, worldPos.z);
    mesh.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);

    this.buildingsGroup.add(mesh);

    // Register
    const id = this.registry.register({
      gridX: chosen.x,
      gridY: chosen.y,
      type: buildingType,
      mesh,
      builtDay: gameDays
    });

    const building = this.registry.get(id);
    building.startY = startY;
    building.targetY = targetY;
    this.constructingBuildings.push(building);

    // Update grid
    this.grid.setCell(chosen.x, chosen.y, {
      type: CELL_TYPES.BUILDING,
      buildingType,
      buildingId: id
    });

    eventBus.emit('buildingSpawned', { x: chosen.x, y: chosen.y, type: buildingType, id });
    return true;
  }

  _pickBuildingType(zone, population) {
    // Cathedral check
    if (!this.cathedralBuilt && population >= CATHEDRAL_POP_THRESHOLD) {
      if (Math.random() < 0.3) return BUILDING_TYPES.CATHEDRAL;
    }

    const roll = Math.random();

    if (zone === 'market') {
      if (roll < 0.3) return BUILDING_TYPES.INN;
      if (roll < 0.6) return BUILDING_TYPES.GUILD_HALL;
      return BUILDING_TYPES.COTTAGE;
    }

    if (zone === 'residential') {
      if (roll < 0.5) return BUILDING_TYPES.COTTAGE;
      if (roll < 0.75) return BUILDING_TYPES.MANOR;
      if (roll < 0.9) return BUILDING_TYPES.INN;
      return BUILDING_TYPES.COTTAGE;
    }

    // Industrial zone
    if (roll < 0.3) return BUILDING_TYPES.BLACKSMITH;
    if (roll < 0.5) return BUILDING_TYPES.MILL;
    if (roll < 0.8) return BUILDING_TYPES.FARM;
    return BUILDING_TYPES.COTTAGE;
  }

  _hasAdjacentBuilding(x, y, radius) {
    return this.grid.countNearbyType(x, y, CELL_TYPES.BUILDING, radius) > 0;
  }

  updateWindowGlow(timeOfDay) {
    // timeOfDay: 0-24 hours
    const isNight = timeOfDay < 5 || timeOfDay > 20;
    const isDusk = timeOfDay > 18 && timeOfDay <= 20;
    const isDawn = timeOfDay >= 5 && timeOfDay < 7;

    let glowIntensity = 0;
    if (isNight) glowIntensity = 0.6 + Math.sin(Date.now() * 0.003) * 0.1; // flicker
    else if (isDusk) glowIntensity = ((timeOfDay - 18) / 2) * 0.6;
    else if (isDawn) glowIntensity = ((7 - timeOfDay) / 2) * 0.4;

    for (const building of this.registry.getAll()) {
      if (building.mesh) {
        setWindowGlow(building.mesh, glowIntensity);
      }
    }
  }

  // Update mill sails rotation
  updateAnimations(dt) {
    for (const building of this.registry.getAll()) {
      if (building.type === BUILDING_TYPES.MILL && building.mesh.userData.sails) {
        building.mesh.userData.sails.rotation.z += dt * 0.5;
      }
    }
  }
}
