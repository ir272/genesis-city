import * as THREE from 'three';
import { GRID_SIZE, CELL_TYPES, BUILDING_TYPES, MAX_CITIZENS } from '../utils/constants.js';
import { findPathCached, clearPathCache } from '../utils/AStar.js';
import { eventBus } from '../utils/EventBus.js';

const CITIZEN_STATES = {
  SLEEPING: 'sleeping',
  WORKING: 'working',
  MARKET: 'market',
  TAVERN: 'tavern',
  WALKING: 'walking',
  IDLE: 'idle'
};

export class CitizenManager {
  constructor(grid, registry, terrain) {
    this.grid = grid;
    this.registry = registry;
    this.terrain = terrain;
    this.citizens = [];
    this.instancedMesh = null;
    this.maxCitizens = MAX_CITIZENS;
    this.spawnCooldown = 0;
    this.dummy = new THREE.Object3D();
    this.group = new THREE.Group();
    this.group.name = 'citizens';

    this._createInstancedMesh();
  }

  _createInstancedMesh() {
    // Cloaked figure: cylinder body + sphere head
    const bodyGeo = new THREE.CylinderGeometry(0.05, 0.1, 0.3, 5);
    const headGeo = new THREE.SphereGeometry(0.05, 5, 4);

    // Merge into one geometry
    const mergedGeo = new THREE.BufferGeometry();

    // Position body vertices
    const bodyPos = bodyGeo.attributes.position.array.slice();
    const headPos = headGeo.attributes.position.array.slice();

    // Offset head up
    for (let i = 1; i < headPos.length; i += 3) {
      headPos[i] += 0.2;
    }

    // Simple approach: use a capsule-like shape
    const capsuleGeo = new THREE.CapsuleGeometry(0.06, 0.2, 3, 5);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0a,
      roughness: 0.9
    });

    this.instancedMesh = new THREE.InstancedMesh(capsuleGeo, mat, this.maxCitizens);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.count = 0;
    this.instancedMesh.name = 'citizen-instances';

    // Hide all initially
    for (let i = 0; i < this.maxCitizens; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    this.group.add(this.instancedMesh);

    bodyGeo.dispose();
    headGeo.dispose();
  }

  update(dt, timeOfDay, gameDays) {
    this.spawnCooldown -= dt;

    // Try to spawn new citizens from residential buildings
    if (this.spawnCooldown <= 0 && this.citizens.length < this.maxCitizens) {
      this._trySpawnCitizen(gameDays);
      this.spawnCooldown = 5 + Math.random() * 10;
    }

    // Update each citizen
    for (let i = this.citizens.length - 1; i >= 0; i--) {
      const citizen = this.citizens[i];
      this._updateCitizen(citizen, dt, timeOfDay, gameDays);

      // Age out old citizens
      if (gameDays - citizen.bornDay > 60 + Math.random() * 40) {
        this._removeCitizen(i);
        continue;
      }
    }

    // Update instanced mesh
    this._updateInstances();
  }

  _trySpawnCitizen(gameDays) {
    const residentialTypes = [BUILDING_TYPES.COTTAGE, BUILDING_TYPES.MANOR];
    const homes = this.registry.getAll().filter(b =>
      residentialTypes.includes(b.type) && !b.isConstructing
    );

    if (homes.length === 0) return;

    const home = homes[Math.floor(Math.random() * homes.length)];

    // Find work building
    const workTypes = [BUILDING_TYPES.BLACKSMITH, BUILDING_TYPES.MILL, BUILDING_TYPES.FARM,
                       BUILDING_TYPES.GUILD_HALL];
    const workplaces = this.registry.getAll().filter(b =>
      workTypes.includes(b.type) && !b.isConstructing
    );

    // Find tavern
    const taverns = this.registry.getAll().filter(b =>
      b.type === BUILDING_TYPES.INN && !b.isConstructing
    );

    const citizen = {
      id: this.citizens.length,
      instanceIndex: this.citizens.length,
      homeBuilding: home,
      workBuilding: workplaces.length > 0 ? workplaces[Math.floor(Math.random() * workplaces.length)] : home,
      tavernBuilding: taverns.length > 0 ? taverns[Math.floor(Math.random() * taverns.length)] : null,
      state: CITIZEN_STATES.SLEEPING,
      gridX: home.gridX,
      gridY: home.gridY,
      worldX: 0,
      worldY: 0,
      worldZ: 0,
      path: null,
      pathIndex: 0,
      moveSpeed: 2 + Math.random() * 1, // grid cells per second
      bornDay: gameDays,
      isEntrepreneur: Math.random() < 0.15
    };

    const wp = this.terrain.getWorldPos(citizen.gridX, citizen.gridY);
    citizen.worldX = wp.x;
    citizen.worldY = wp.y + 0.15;
    citizen.worldZ = wp.z;

    this.citizens.push(citizen);
    this.instancedMesh.count = Math.min(this.citizens.length, this.maxCitizens);

    eventBus.emit('citizenSpawned', { count: this.citizens.length });
  }

  _removeCitizen(index) {
    this.citizens.splice(index, 1);
    this.instancedMesh.count = this.citizens.length;
    // Re-index
    for (let i = 0; i < this.citizens.length; i++) {
      this.citizens[i].instanceIndex = i;
    }
    eventBus.emit('citizenDespawned', { count: this.citizens.length });
  }

  _updateCitizen(citizen, dt, timeOfDay, gameDays) {
    // Decide state based on time of day
    const desiredState = this._getDesiredState(citizen, timeOfDay);

    if (citizen.state === CITIZEN_STATES.WALKING) {
      // Move along path
      this._moveCitizen(citizen, dt);
      return;
    }

    if (desiredState !== citizen.state) {
      // Need to navigate to new location
      const target = this._getTargetForState(citizen, desiredState);
      if (target) {
        const path = findPathCached(this.grid, citizen.gridX, citizen.gridY, target.x, target.y);
        if (path && path.length > 1) {
          citizen.path = path;
          citizen.pathIndex = 0;
          citizen.state = CITIZEN_STATES.WALKING;
          citizen.nextState = desiredState;
        } else {
          citizen.state = desiredState;
        }
      } else {
        citizen.state = desiredState;
      }
    }
  }

  _getDesiredState(citizen, timeOfDay) {
    if (timeOfDay >= 21 || timeOfDay < 6) return CITIZEN_STATES.SLEEPING;
    if (timeOfDay >= 6 && timeOfDay < 12) return CITIZEN_STATES.WORKING;
    if (timeOfDay >= 12 && timeOfDay < 14) return CITIZEN_STATES.MARKET;
    if (timeOfDay >= 14 && timeOfDay < 18) return CITIZEN_STATES.WORKING;
    if (timeOfDay >= 18 && timeOfDay < 21) return CITIZEN_STATES.TAVERN;
    return CITIZEN_STATES.IDLE;
  }

  _getTargetForState(citizen, state) {
    switch (state) {
      case CITIZEN_STATES.SLEEPING:
        return { x: citizen.homeBuilding.gridX, y: citizen.homeBuilding.gridY };
      case CITIZEN_STATES.WORKING:
        return { x: citizen.workBuilding.gridX, y: citizen.workBuilding.gridY };
      case CITIZEN_STATES.MARKET: {
        const cx = Math.floor(GRID_SIZE / 2), cy = Math.floor(GRID_SIZE / 2);
        return { x: cx, y: cy };
      }
      case CITIZEN_STATES.TAVERN:
        if (citizen.tavernBuilding) {
          return { x: citizen.tavernBuilding.gridX, y: citizen.tavernBuilding.gridY };
        }
        return { x: citizen.homeBuilding.gridX, y: citizen.homeBuilding.gridY };
      default:
        return null;
    }
  }

  _moveCitizen(citizen, dt) {
    if (!citizen.path || citizen.pathIndex >= citizen.path.length) {
      citizen.state = citizen.nextState || CITIZEN_STATES.IDLE;
      citizen.path = null;
      return;
    }

    const target = citizen.path[citizen.pathIndex];
    const wp = this.terrain.getWorldPos(target.x, target.y);
    const tx = wp.x, tz = wp.z;

    const dx = tx - citizen.worldX;
    const dz = tz - citizen.worldZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.1) {
      citizen.gridX = target.x;
      citizen.gridY = target.y;
      citizen.worldX = tx;
      citizen.worldZ = tz;
      citizen.worldY = wp.y + 0.15;

      // Increment road traffic
      this.grid.incrementTraffic(target.x, target.y);

      citizen.pathIndex++;
    } else {
      const speed = citizen.moveSpeed * dt;
      citizen.worldX += (dx / dist) * speed;
      citizen.worldZ += (dz / dist) * speed;
      citizen.worldY = wp.y + 0.15;
    }
  }

  _updateInstances() {
    for (let i = 0; i < this.citizens.length && i < this.maxCitizens; i++) {
      const c = this.citizens[i];
      this.dummy.position.set(c.worldX, c.worldY, c.worldZ);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    // Hide unused instances
    for (let i = this.citizens.length; i < this.maxCitizens; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  getPopulation() {
    return this.citizens.length;
  }

  // Entrepreneur system: citizens can found new buildings
  tryEntrepreneurAction(gameDays) {
    const entrepreneurs = this.citizens.filter(c => c.isEntrepreneur && c.state !== CITIZEN_STATES.WALKING);
    if (entrepreneurs.length === 0) return null;

    const e = entrepreneurs[Math.floor(Math.random() * entrepreneurs.length)];
    // Find empty road-adjacent cell near this citizen
    const candidate = this.grid.getRandomEmptyCellNear(e.gridX, e.gridY, 5, (x, y) => {
      return this.grid.isAdjacentToRoad(x, y);
    });

    if (candidate) {
      return candidate;
    }
    return null;
  }
}
