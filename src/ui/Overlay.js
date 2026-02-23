import { SEASON_NAMES, SEASON_ICONS } from '../utils/constants.js';

export class Overlay {
  constructor() {
    this.dateEl = document.getElementById('date-display');
    this.popEl = document.getElementById('population-display');
    this.seasonEl = document.getElementById('season-display');
    this.displayedPop = 0;
    this.targetPop = 0;
    this.popAnimTimer = 0;
    this.speedHideTimer = 0;

    // Create speed indicator
    this.speedEl = document.createElement('div');
    this.speedEl.id = 'speed-display';
    this.speedEl.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: Georgia, serif; font-size: 24px; color: rgba(255,244,224,0.8);
      pointer-events: none; opacity: 0; transition: opacity 0.3s;
      text-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(this.speedEl);
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

    // Fade speed indicator
    if (this.speedHideTimer > 0) {
      this.speedHideTimer -= dt;
      if (this.speedHideTimer <= 0) {
        this.speedEl.style.opacity = '0';
      }
    }
  }

  showSpeed(scale) {
    if (scale === 1) {
      this.speedEl.textContent = '\u25b6';
    } else {
      this.speedEl.textContent = `\u25b6\u25b6 ${scale}x`;
    }
    this.speedEl.style.opacity = '1';
    this.speedHideTimer = 2;
  }
}
