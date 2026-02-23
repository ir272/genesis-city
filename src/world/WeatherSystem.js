import * as THREE from 'three';
import { SEASONS, GRID_SIZE } from '../utils/constants.js';

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.isRaining = false;
    this.rainIntensity = 0;
    this.rainParticles = null;
    this.snowParticles = null;
    this.season = SEASONS.SUMMER;
    this.weatherTimer = 0;
    this.weatherDuration = 0;
    this.group = new THREE.Group();
    this.group.name = 'weather';

    this._createRainSystem();
    this._createSnowSystem();
  }

  _createRainSystem() {
    const count = 2000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * GRID_SIZE;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE;
      velocities[i] = 15 + Math.random() * 10;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: 0x8899aa,
      size: 0.1,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true
    });

    this.rainParticles = new THREE.Points(geo, mat);
    this.rainParticles.visible = false;
    this.group.add(this.rainParticles);
  }

  _createSnowSystem() {
    const count = 1000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * GRID_SIZE;
      positions[i * 3 + 1] = Math.random() * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE;
      velocities[i * 3] = (Math.random() - 0.5) * 0.5; // drift x
      velocities[i * 3 + 1] = 1 + Math.random() * 1.5; // fall speed
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5; // drift z
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.snowVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true
    });

    this.snowParticles = new THREE.Points(geo, mat);
    this.snowParticles.visible = false;
    this.group.add(this.snowParticles);
  }

  update(dt, season) {
    this.season = season;

    // Randomly trigger weather
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 120 + Math.random() * 300; // 2-7 minutes
      this.weatherDuration = 30 + Math.random() * 60; // 30-90 seconds of weather
      this.isRaining = Math.random() < 0.3;
    }

    if (this.weatherDuration > 0) {
      this.weatherDuration -= dt;
    } else {
      this.isRaining = false;
    }

    // Snow only in winter
    const isSnowing = this.season === SEASONS.WINTER && this.isRaining;
    const isRaining = this.season !== SEASONS.WINTER && this.isRaining;

    this.rainParticles.visible = isRaining;
    this.snowParticles.visible = isSnowing;

    if (isRaining) this._updateRain(dt);
    if (isSnowing) this._updateSnow(dt);
  }

  _updateRain(dt) {
    const positions = this.rainParticles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3 + 1] -= this.rainVelocities[i] * dt;
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 25 + Math.random() * 5;
        positions[i * 3] = (Math.random() - 0.5) * GRID_SIZE;
        positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE;
      }
    }
    this.rainParticles.geometry.attributes.position.needsUpdate = true;
  }

  _updateSnow(dt) {
    const positions = this.snowParticles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.01;
      positions[i * 3 + 1] -= this.snowVelocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += Math.cos(Date.now() * 0.0008 + i) * 0.01;
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 20 + Math.random() * 5;
        positions[i * 3] = (Math.random() - 0.5) * GRID_SIZE;
        positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE;
      }
    }
    this.snowParticles.geometry.attributes.position.needsUpdate = true;
  }

  isWeatherActive() {
    return this.isRaining;
  }
}
