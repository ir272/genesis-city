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

class Genesis {
  constructor() {
    this.seed = Math.random() * 10000;
    this.realTimeElapsed = 0;
    this.lastTime = 0;
    this.running = true;
    this.initialized = false;
    this.smokeRefreshTimer = 0;
  }

  async init() {
    // Scene
    const { scene, camera, renderer, postProcessing } = createScene();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.postProcessing = postProcessing;

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

    // Camera
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);
    this.cinematicDirector = new CinematicDirector(this.cameraController, this.registry, this.terrain);

    // UI
    this.overlay = new Overlay();
    this.tooltip = new Tooltip(this.camera, this.grid, this.registry, this.terrain);
    this.tooltip.setGroundMesh(this.terrain.terrainMesh);
    this.timeLapse = new TimeLapse(this.renderer);

    // New World button
    document.getElementById('new-world-btn').addEventListener('click', () => {
      this._newWorld();
    });

    // Hide loading screen
    const loading = document.getElementById('loading-screen');
    loading.style.opacity = '0';
    setTimeout(() => loading.style.display = 'none', 1500);

    this.initialized = true;
    this.lastTime = performance.now();

    // Start game loop
    this._loop();
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap delta
    this.lastTime = now;
    this.realTimeElapsed += dt;

    if (!this.initialized) return;

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

    // Camera
    this.cameraController.update(dt);
    this.cinematicDirector.update(dt);

    // Post-processing time adjustments
    this.postProcessing.updateTimeOfDay(timeOfDay);

    // UI
    this.overlay.update(dt, this.dayNight.getDateString(), this.citizenManager.getPopulation(), season);
    this.timeLapse.update(dt);

    // Render
    this.postProcessing.render();
  }

  _newWorld() {
    // Clean up and restart
    this.running = false;
    this.initialized = false;

    // Remove old scene children except camera-related
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      this.scene.remove(child);
    }

    // New seed
    this.seed = Math.random() * 10000;
    this.realTimeElapsed = 0;

    // Re-init
    setTimeout(() => {
      this.running = true;
      this.init();
    }, 100);
  }
}

// Boot
const genesis = new Genesis();
genesis.init().catch(console.error);
