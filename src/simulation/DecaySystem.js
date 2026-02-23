import { CELL_TYPES, DECAY_DAYS_THRESHOLD } from '../utils/constants.js';
import { eventBus } from '../utils/EventBus.js';

export class DecaySystem {
  constructor(grid, registry) {
    this.grid = grid;
    this.registry = registry;
    this.checkInterval = 10; // check every 10 seconds
    this.timer = 0;
  }

  update(dt, gameDays) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.checkInterval;

    const buildings = this.registry.getAll();
    for (const building of buildings) {
      if (building.isConstructing) continue;

      // Check if building is adjacent to road
      const isNearRoad = this.grid.isAdjacentToRoad(building.gridX, building.gridY);
      const age = gameDays - building.builtDay;

      if (!isNearRoad && age > DECAY_DAYS_THRESHOLD) {
        // Start decay
        if (!building.decaying) {
          building.decaying = true;
          building.decayProgress = 0;
          eventBus.emit('buildingDecaying', { id: building.id, x: building.gridX, y: building.gridY });
        }
      }

      // Progress decay
      if (building.decaying) {
        building.decayProgress += dt / this.checkInterval * 0.05; // slow decay

        if (building.mesh) {
          // Visual: sink into ground and darken
          const sink = building.decayProgress * 1.5;
          building.mesh.position.y = building.targetY - sink;

          // Darken material
          building.mesh.traverse(child => {
            if (child.isMesh && child.material && child.material.color) {
              const factor = 1 - building.decayProgress * 0.3;
              child.material.color.multiplyScalar(factor > 0.5 ? 1 : 0.999);
            }
          });
        }

        if (building.decayProgress >= 1) {
          // Remove building
          if (building.mesh && building.mesh.parent) {
            building.mesh.parent.remove(building.mesh);
          }
          this.grid.setCell(building.gridX, building.gridY, {
            type: CELL_TYPES.EMPTY,
            buildingType: null,
            buildingId: null
          });
          this.registry.remove(building.id);
          eventBus.emit('buildingDecayed', { id: building.id, x: building.gridX, y: building.gridY });
        }
      }
    }
  }
}
