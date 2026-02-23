import * as THREE from 'three';
import { eventBus } from '../utils/EventBus.js';

export class CinematicDirector {
  constructor(cameraController, registry, terrain) {
    this.camera = cameraController;
    this.registry = registry;
    this.terrain = terrain;
    this.enabled = true;
    this.cooldown = 0;
    this.minCooldown = 30; // seconds between auto-flytos

    // Listen for interesting events
    eventBus.on('buildingSpawned', (data) => {
      if (data.type === 'cathedral') {
        this._flyToEvent(data.x, data.y);
      }
    });
  }

  update(dt) {
    if (!this.enabled) return;
    this.cooldown -= dt;

    // Periodically fly to interesting locations
    if (this.cooldown <= 0) {
      this.cooldown = this.minCooldown + Math.random() * 30;
      this._autoFly();
    }
  }

  _autoFly() {
    if (this.camera.isDragging || this.camera.cinematicMode) return;

    const buildings = this.registry.getAll();
    if (buildings.length === 0) return;

    // Pick a random building, prefer newer or special ones
    const candidates = buildings.filter(b => !b.isConstructing);
    if (candidates.length === 0) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this._flyToEvent(pick.gridX, pick.gridY);
  }

  _flyToEvent(gx, gy) {
    if (this.camera.isDragging) return;
    const wp = this.terrain.getWorldPos(gx, gy);
    const target = new THREE.Vector3(wp.x, wp.y, wp.z);
    this.camera.flyToBuilding(target);
  }

  toggle() {
    this.enabled = !this.enabled;
  }
}
