import { SEED_PHASE_END, EARLY_ROADS_END, EXPANSION_PHASE_END } from '../utils/constants.js';

// Controls growth pacing across phases
export class WaveManager {
  constructor() {
    this.phase = 'seed';
    this.phaseStartTime = 0;
  }

  update(realTimeElapsed) {
    if (realTimeElapsed < SEED_PHASE_END) {
      this.phase = 'seed';
    } else if (realTimeElapsed < EARLY_ROADS_END) {
      this.phase = 'earlyRoads';
    } else if (realTimeElapsed < EXPANSION_PHASE_END) {
      this.phase = 'expansion';
    } else {
      this.phase = 'maturity';
    }
  }

  getPhase() {
    return this.phase;
  }

  // How fast roads should grow (cells per second)
  getRoadGrowthRate() {
    switch (this.phase) {
      case 'seed': return 0;
      case 'earlyRoads': return 3;
      case 'expansion': return 2;
      case 'maturity': return 1;
      default: return 1;
    }
  }

  // How often buildings should spawn (seconds between spawns)
  getBuildingSpawnInterval() {
    switch (this.phase) {
      case 'seed': return Infinity;
      case 'earlyRoads': return 8;
      case 'expansion': return 4;
      case 'maturity': return 6;
      default: return 6;
    }
  }

  // Whether citizens should start spawning
  canSpawnCitizens() {
    return this.phase === 'expansion' || this.phase === 'maturity';
  }

  // Road branching interval
  getRoadBranchInterval() {
    switch (this.phase) {
      case 'earlyRoads': return 45;
      case 'expansion': return 25;
      case 'maturity': return 40;
      default: return 60;
    }
  }
}
