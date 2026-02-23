import { SEASON_NAMES, SEASON_ICONS } from '../utils/constants.js';

export class Overlay {
  constructor() {
    this.dateEl = document.getElementById('date-display');
    this.popEl = document.getElementById('population-display');
    this.seasonEl = document.getElementById('season-display');
    this.displayedPop = 0;
    this.targetPop = 0;
    this.popAnimTimer = 0;
  }

  update(dt, dateString, population, season) {
    this.dateEl.textContent = dateString;

    this.targetPop = population;
    if (this.displayedPop !== this.targetPop) {
      this.popAnimTimer += dt;
      if (this.popAnimTimer > 0.05) {
        this.popAnimTimer = 0;
        if (this.displayedPop < this.targetPop) this.displayedPop++;
        else this.displayedPop--;
      }
    }
    this.popEl.textContent = `${this.displayedPop} souls`;

    this.seasonEl.textContent = SEASON_ICONS[season];
    this.seasonEl.title = SEASON_NAMES[season];
  }
}
