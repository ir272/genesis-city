import * as THREE from 'three';
import { GRID_SIZE, CELL_TYPES, BUILDING_TYPES } from '../utils/constants.js';

export class ParticleSystem {
  constructor(scene, grid, registry, terrain) {
    this.scene = scene;
    this.grid = grid;
    this.registry = registry;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'particles';

    this.smokeSystems = [];
    this.fireflies = null;
    this.leaves = null;
    this.dustParticles = null;

    this._createFireflies();
    this._createLeaves();
    this._createDust();
  }

  _createFireflies() {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * GRID_SIZE;
      positions[i * 3 + 1] = 0.5 + Math.random() * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE;
      phases[i] = Math.random() * Math.PI * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflyPhases = phases;

    const mat = new THREE.PointsMaterial({
      color: 0xaaff44,
      size: 0.12,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    this.fireflies = new THREE.Points(geo, mat);
    this.fireflies.visible = false;
    this.group.add(this.fireflies);
  }

  _createLeaves() {
    const count = 60;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * GRID_SIZE * 0.5;
      positions[i * 3 + 1] = 2 + Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE * 0.5;
      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = -0.3 - Math.random() * 0.3;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.leafVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: 0x886633,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    });

    this.leaves = new THREE.Points(geo, mat);
    this.group.add(this.leaves);
  }

  _createDust() {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xaa9977,
      size: 0.06,
      transparent: true,
      opacity: 0.3,
      sizeAttenuation: true
    });

    this.dustParticles = new THREE.Points(geo, mat);
    this.group.add(this.dustParticles);
    this.dustIndex = 0;
  }

  update(dt, timeOfDay, season, citizenPositions) {
    this._updateFireflies(dt, timeOfDay);
    this._updateLeaves(dt, season);
    this._updateSmoke(dt);
    this._updateDust(dt, citizenPositions);
  }

  _updateFireflies(dt, timeOfDay) {
    const isNight = timeOfDay > 20 || timeOfDay < 5;
    this.fireflies.visible = isNight;

    if (!isNight) return;

    const positions = this.fireflies.geometry.attributes.position.array;
    const t = Date.now() * 0.001;

    for (let i = 0; i < positions.length / 3; i++) {
      const phase = this.fireflyPhases[i];
      // Gentle floating motion
      positions[i * 3] += Math.sin(t + phase) * 0.005;
      positions[i * 3 + 1] += Math.cos(t * 0.7 + phase) * 0.003;
      positions[i * 3 + 2] += Math.sin(t * 0.5 + phase * 1.3) * 0.005;

      // Keep near forests
      if (positions[i * 3 + 1] < 0.3) positions[i * 3 + 1] = 0.5;
      if (positions[i * 3 + 1] > 3) positions[i * 3 + 1] = 2;
    }

    this.fireflies.geometry.attributes.position.needsUpdate = true;

    // Pulsing glow
    this.fireflies.material.opacity = 0.3 + Math.sin(t * 2) * 0.2;
  }

  _updateLeaves(dt, season) {
    // More leaves in autumn
    const opacity = season === 2 ? 0.7 : 0.3; // autumn index
    this.leaves.material.opacity = opacity;
    this.leaves.material.color.setHex(season === 2 ? 0xcc6622 : 0x556633);

    const positions = this.leaves.geometry.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3] += this.leafVelocities[i * 3] * dt;
      positions[i * 3 + 1] += this.leafVelocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += this.leafVelocities[i * 3 + 2] * dt;

      // Swirl
      positions[i * 3] += Math.sin(Date.now() * 0.001 + i * 0.5) * 0.01;

      // Reset fallen leaves
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 3 + Math.random() * 2;
        positions[i * 3] = (Math.random() - 0.5) * GRID_SIZE * 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE * 0.5;
      }
    }
    this.leaves.geometry.attributes.position.needsUpdate = true;
  }

  _updateSmoke(dt) {
    // Update existing smoke systems
    for (let i = this.smokeSystems.length - 1; i >= 0; i--) {
      const smoke = this.smokeSystems[i];
      const positions = smoke.mesh.geometry.attributes.position.array;

      for (let j = 0; j < positions.length / 3; j++) {
        positions[j * 3] += (Math.random() - 0.5) * 0.01;
        positions[j * 3 + 1] += dt * (0.3 + Math.random() * 0.2);
        positions[j * 3 + 2] += (Math.random() - 0.5) * 0.01;

        if (positions[j * 3 + 1] > smoke.origin.y + 4) {
          positions[j * 3] = smoke.origin.x + (Math.random() - 0.5) * 0.1;
          positions[j * 3 + 1] = smoke.origin.y;
          positions[j * 3 + 2] = smoke.origin.z + (Math.random() - 0.5) * 0.1;
        }
      }
      smoke.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  addSmokeSource(worldPos) {
    const count = 15;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 1] = worldPos.y + Math.random() * 2;
      positions[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.1;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x555555,
      size: 0.15,
      transparent: true,
      opacity: 0.25,
      sizeAttenuation: true,
      blending: THREE.NormalBlending
    });

    const mesh = new THREE.Points(geo, mat);
    this.group.add(mesh);
    this.smokeSystems.push({ mesh, origin: worldPos.clone() });
  }

  _updateDust(dt, citizenPositions) {
    if (!citizenPositions || citizenPositions.length === 0) return;

    const positions = this.dustParticles.geometry.attributes.position.array;
    // Place dust near walking citizens
    for (let c = 0; c < Math.min(citizenPositions.length, 5); c++) {
      const cp = citizenPositions[c];
      const idx = (this.dustIndex % (positions.length / 3)) * 3;
      positions[idx] = cp.x + (Math.random() - 0.5) * 0.2;
      positions[idx + 1] = cp.y - 0.1 + Math.random() * 0.1;
      positions[idx + 2] = cp.z + (Math.random() - 0.5) * 0.2;
      this.dustIndex++;
    }

    // Drift dust upward and fade
    for (let i = 0; i < positions.length / 3; i++) {
      if (positions[i * 3 + 1] > -50) {
        positions[i * 3 + 1] += dt * 0.3;
        if (positions[i * 3 + 1] > 1) positions[i * 3 + 1] = -100;
      }
    }
    this.dustParticles.geometry.attributes.position.needsUpdate = true;
  }

  refreshSmokeSources() {
    // Remove old smoke
    for (const s of this.smokeSystems) {
      this.group.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    this.smokeSystems = [];

    // Add smoke for buildings with chimneys
    for (const building of this.registry.getAll()) {
      if (building.mesh && building.mesh.userData.hasChimney && !building.isConstructing) {
        const chimneyLocal = building.mesh.userData.chimneyPos;
        if (chimneyLocal) {
          const worldPos = new THREE.Vector3();
          worldPos.copy(chimneyLocal);
          building.mesh.localToWorld(worldPos);
          this.addSmokeSource(worldPos);
        }
      }
    }
  }
}
