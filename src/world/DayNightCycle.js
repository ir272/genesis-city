import * as THREE from 'three';
import { GRID_SIZE, REAL_SECONDS_PER_GAME_DAY, GAME_HOURS_PER_DAY,
         DAYS_PER_YEAR, DAYS_PER_SEASON, SUN_COLOR, MOON_COLOR,
         AMBIENT_DAY, AMBIENT_NIGHT } from '../utils/constants.js';
import { eventBus } from '../utils/EventBus.js';

export class DayNightCycle {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 8; // Start at morning
    this.gameDays = 0;
    this.totalGameTime = 0;

    // Sun
    this.sunLight = new THREE.DirectionalLight(SUN_COLOR, 1.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.bias = -0.001;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Moon
    this.moonLight = new THREE.DirectionalLight(MOON_COLOR, 0);
    this.moonLight.castShadow = false;
    scene.add(this.moonLight);

    // Ambient
    this.ambientLight = new THREE.AmbientLight(AMBIENT_DAY, 0.4);
    scene.add(this.ambientLight);

    // Hemisphere light for sky color
    this.hemiLight = new THREE.HemisphereLight(0x8899bb, 0x443322, 0.3);
    scene.add(this.hemiLight);

    // Fog
    this.scene.fog = new THREE.FogExp2(0x8fa5a5, 0.008);

    this.lastHour = -1;
  }

  update(dt) {
    // Advance time
    const hoursPerRealSecond = GAME_HOURS_PER_DAY / REAL_SECONDS_PER_GAME_DAY;
    this.totalGameTime += dt * hoursPerRealSecond;
    this.timeOfDay = this.totalGameTime % GAME_HOURS_PER_DAY;
    this.gameDays = Math.floor(this.totalGameTime / GAME_HOURS_PER_DAY);

    // Sun position (arc across sky)
    const sunAngle = ((this.timeOfDay - 6) / 12) * Math.PI; // 6am = 0, 6pm = PI
    const sunHeight = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 80;
    const sunY = sunHeight * 60;
    const sunZ = Math.sin(sunAngle * 0.5) * 30;

    this.sunLight.position.set(sunX, Math.max(sunY, -10), sunZ);
    this.sunLight.target.position.set(0, 0, 0);

    // Moon (opposite)
    this.moonLight.position.set(-sunX, Math.max(-sunY, 5), -sunZ);

    // Intensity based on time of day
    const dayIntensity = Math.max(0, sunHeight);
    const nightIntensity = Math.max(0, -sunHeight) * 0.3;

    this.sunLight.intensity = dayIntensity * 1.2;
    this.moonLight.intensity = nightIntensity;

    // Color temperature shifts
    if (this.timeOfDay >= 5 && this.timeOfDay < 7) {
      // Dawn: warm amber
      const t = (this.timeOfDay - 5) / 2;
      this.sunLight.color.setHex(lerpColor(0xff8833, SUN_COLOR, t));
      this.sunLight.intensity = t * 1.0;
    } else if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
      // Dusk: deep orange
      const t = (this.timeOfDay - 18) / 2;
      this.sunLight.color.setHex(lerpColor(SUN_COLOR, 0xff5500, t));
      this.sunLight.intensity = (1 - t) * 1.0;
    } else if (this.timeOfDay >= 20 || this.timeOfDay < 5) {
      // Night
      this.sunLight.intensity = 0;
    }

    // Ambient color shift
    const ambientT = Math.max(0, Math.min(1, dayIntensity));
    this.ambientLight.color.setHex(lerpColor(AMBIENT_NIGHT, AMBIENT_DAY, ambientT));
    this.ambientLight.intensity = 0.2 + ambientT * 0.3;

    // Hemisphere shift
    const skyT = ambientT;
    this.hemiLight.color.setHex(lerpColor(0x111122, 0x8899bb, skyT));
    this.hemiLight.groundColor.setHex(lerpColor(0x111111, 0x443322, skyT));

    // Fog color shift
    this.scene.fog.color.setHex(lerpColor(0x0a0f1a, 0x8fa5a5, ambientT));
    this.scene.fog.density = 0.008 + (1 - ambientT) * 0.005;

    // Emit time events
    const currentHour = Math.floor(this.timeOfDay);
    if (currentHour !== this.lastHour) {
      this.lastHour = currentHour;
      eventBus.emit('hourChanged', { hour: currentHour, day: this.gameDays });
    }
  }

  getTimeOfDay() { return this.timeOfDay; }
  getGameDays() { return this.gameDays; }
  getYear() { return Math.floor(this.gameDays / DAYS_PER_YEAR) + 1; }
  getDayOfYear() { return this.gameDays % DAYS_PER_YEAR; }
  getSeason() { return Math.floor(this.getDayOfYear() / DAYS_PER_SEASON); }

  getTimeLabel() {
    const hour = Math.floor(this.timeOfDay);
    if (hour >= 5 && hour < 7) return 'Dawn';
    if (hour >= 7 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 14) return 'Midday';
    if (hour >= 14 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 20) return 'Dusk';
    return 'Night';
  }

  getDateString() {
    const year = this.getYear();
    const dayOfYear = this.getDayOfYear() + 1;
    return `Year ${year}, Day ${dayOfYear} \u2014 ${this.getTimeLabel()}`;
  }
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
