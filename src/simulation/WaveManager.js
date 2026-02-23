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

  getRoadGrowthRate() {
    switch (this.phase) {
      case 'seed': return 6;        // Roads start growing immediately
      case 'earlyRoads': return 5;
      case 'expansion': return 3;
      case 'maturity': return 1.5;
      default: return 1;
    }
  }

  getBuildingSpawnInterval() {
    switch (this.phase) {
      case 'seed': return Infinity;
      case 'earlyRoads': return 5;   // Buildings start earlier
      case 'expansion': return 3;
      case 'maturity': return 5;
      default: return 5;
    }
  }

  canSpawnCitizens() {
    return this.phase === 'earlyRoads' || this.phase === 'expansion' || this.phase === 'maturity';
  }

  getRoadBranchInterval() {
    switch (this.phase) {
      case 'seed': return 10;
      case 'earlyRoads': return 20;
      case 'expansion': return 15;
      case 'maturity': return 30;
      default: return 30;
    }
  }
}
