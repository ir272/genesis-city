import { createScene } from './scene.js';
import { Grid } from './simulation/Grid.js';
import { Terrain } from './world/Terrain.js';
import { DayNightCycle } from './world/DayNightCycle.js';
import { WeatherSystem } from './world/WeatherSystem.js';
import { RoadGenerator } from './simulation/RoadGenerator.js';
import { BuildingSpawner } from './simulation/BuildingSpawner.js';
import { CitizenManager } from './simulation/CitizenManager.js';
import { DecaySystem } from './simulation/DecaySystem.js';
import { WaveManager } from './simulation/WaveManager.js';
import { BuildingRegistry } from './buildings/BuildingRegistry.js';
import { RoadRenderer } from './rendering/RoadRenderer.js';
import { ParticleSystem } from './rendering/Particles.js';
import { WaterRenderer } from './rendering/WaterRenderer.js';
import { CameraController } from './camera/CameraController.js';
import { CinematicDirector } from './camera/CinematicDirector.js';
import { Overlay } from './ui/Overlay.js';
import { Tooltip } from './ui/Tooltip.js';
import { TimeLapse } from './ui/TimeLapse.js';
import { GRID_SIZE } from './utils/constants.js';
import { eventBus } from './utils/EventBus.js';
import { clearPathCache } from './utils/AStar.js';

class Genesis {
  constructor() {
    this.seed = Math.random() * 10000;
    this.realTimeElapsed = 0;
    this.lastTime = 0;
    this.running = true;
    this.initialized = false;
    this.smokeRefreshTimer = 0;
    this.sceneReady = false;
    this.timeScale = 1;
  }

  boot() {
    // Create renderer/scene once
    const { scene, camera, renderer, postProcessing } = createScene();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.postProcessing = postProcessing;

    // Camera controller — persistent across worlds
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);

    // UI — persistent
    this.overlay = new Overlay();
    this.timeLapse = new TimeLapse(this.renderer);

    // New World button
    document.getElementById('new-world-btn').addEventListener('click', () => {
      this._newWorld();
    });

    // Time controls: Space toggles fast-forward, 1-5 set speed
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.timeScale = this.timeScale === 1 ? 5 : 1;
        this.overlay.showSpeed(this.timeScale);
      } else if (e.key >= '1' && e.key <= '5') {
        this.timeScale = parseInt(e.key);
        this.overlay.showSpeed(this.timeScale);
      }
    });

    this.sceneReady = true;
    this._initWorld();
    this._loop();
  }

  _initWorld() {
    // Core systems
    this.grid = new Grid();
    this.registry = new BuildingRegistry();

    // Terrain
    this.terrain = new Terrain(this.grid, this.seed);
    const terrainGroup = this.terrain.generate();
    this.scene.add(terrainGroup);

    // Day/Night Cycle
    this.dayNight = new DayNightCycle(this.scene);

    // Weather
    this.weather = new WeatherSystem(this.scene);
    this.scene.add(this.weather.group);

    // Road system
    this.roadGenerator = new RoadGenerator(this.grid, this.seed);
    this.roadRenderer = new RoadRenderer(this.scene, this.grid, this.terrain);

    // Initialize road generator with attractors
    const marketPos = { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) };
    this.roadGenerator.init(
      marketPos,
      this.terrain.gatePosition,
      this.terrain.forestClusters,
      this.terrain.riverPoints
    );

    // Building system
    this.buildingSpawner = new BuildingSpawner(this.grid, this.registry, this.scene, this.terrain);

    // Citizens
    this.citizenManager = new CitizenManager(this.grid, this.registry, this.terrain);
    this.scene.add(this.citizenManager.group);

    // Decay
    this.decaySystem = new DecaySystem(this.grid, this.registry);

    // Wave manager (pacing)
    this.waveManager = new WaveManager();

    // Particles
    this.particles = new ParticleSystem(this.scene, this.grid, this.registry, this.terrain);
    this.scene.add(this.particles.group);

    // Water renderer
    this.waterRenderer = new WaterRenderer(this.scene, this.terrain.waterMesh);

    // Cinematic director
    this.cinematicDirector = new CinematicDirector(this.cameraController, this.registry, this.terrain);

    // Tooltip (needs per-world grid/registry)
    this.tooltip = new Tooltip(this.camera, this.grid, this.registry, this.terrain);
    this.tooltip.setGroundMesh(this.terrain.terrainMesh);

    // Reset camera
    this.cameraController.target.set(0, 0, 0);
    this.cameraController.distance = 35;
    this.cameraController.autoRotate = true;

    // Hide loading screen
    const loading = document.getElementById('loading-screen');
    loading.style.opacity = '0';
    setTimeout(() => loading.style.display = 'none', 1500);

    this.initialized = true;
    this.lastTime = performance.now();
  }

  _loop() {
    requestAnimationFrame(() => this._loop());

    if (!this.initialized || !this.running) return;

    const now = performance.now();
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const dt = rawDt * this.timeScale; // Scaled dt for simulation
    this.realTimeElapsed += dt;

    // Update pacing
    this.waveManager.update(this.realTimeElapsed);

    // Update time
    this.dayNight.update(dt);
    const timeOfDay = this.dayNight.getTimeOfDay();
    const gameDays = this.dayNight.getGameDays();
    const season = this.dayNight.getSeason();

    // Road growth
    this.roadGenerator.update(dt, this.realTimeElapsed);
    this.roadRenderer.update(dt, timeOfDay);

    // Building spawning
    this.buildingSpawner.update(dt, gameDays, this.citizenManager.getPopulation());
    this.buildingSpawner.updateWindowGlow(timeOfDay);
    this.buildingSpawner.updateAnimations(dt);

    // Citizens
    if (this.waveManager.canSpawnCitizens()) {
      this.citizenManager.update(dt, timeOfDay, gameDays);

      // Entrepreneur system
      if (Math.random() < 0.001) {
        const spot = this.citizenManager.tryEntrepreneurAction(gameDays);
        if (spot) {
          eventBus.emit('entrepreneurBuild', spot);
        }
      }
    }

    // Decay
    this.decaySystem.update(dt, gameDays);

    // Weather
    this.weather.update(dt, season);

    // Particles
    const citizenPositions = this.citizenManager.citizens
      .filter(c => c.state === 'walking')
      .slice(0, 5)
      .map(c => ({ x: c.worldX, y: c.worldY, z: c.worldZ }));
    this.particles.update(dt, timeOfDay, season, citizenPositions);

    // Refresh smoke sources periodically
    this.smokeRefreshTimer -= dt;
    if (this.smokeRefreshTimer <= 0) {
      this.smokeRefreshTimer = 20;
      this.particles.refreshSmokeSources();
    }

    // Water
    this.waterRenderer.update(dt, timeOfDay);

    // Terrain season colors
    this.terrain.updateSeasonColors(season);

    // Camera (use raw dt so camera speed doesn't change with time scale)
    this.cameraController.update(rawDt);
    this.cinematicDirector.update(rawDt);

    // Scene background tracks sky color
    this.scene.background.copy(this.scene.fog.color);

    // Post-processing time adjustments
    this.postProcessing.updateTimeOfDay(timeOfDay);

    // UI
    this.overlay.update(dt, this.dayNight.getDateString(), this.citizenManager.getPopulation(), season);
    this.timeLapse.update(dt);

    // Render
    this.postProcessing.render();
  }

  _newWorld() {
    this.initialized = false;

    // Dispose scene objects
    this.scene.traverse(child => {
      if (child.isMesh || child.isInstancedMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
      if (child.isLight) {
        // Don't dispose lights — they'll be recreated
      }
    });

    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    // Clear caches and event listeners
    clearPathCache();
    eventBus.clear();

    // New seed, reset time
    this.seed = Math.random() * 10000;
    this.realTimeElapsed = 0;
    this.smokeRefreshTimer = 0;

    // Show loading briefly
    const loading = document.getElementById('loading-screen');
    loading.style.display = 'flex';
    loading.style.opacity = '1';

    setTimeout(() => {
      this._initWorld();
    }, 200);
  }
}

// Boot
const genesis = new Genesis();
window.__genesis = genesis; // Debug access
genesis.boot();
