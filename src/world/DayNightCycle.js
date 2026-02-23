import * as THREE from 'three';
import { GRID_SIZE, REAL_SECONDS_PER_GAME_DAY, GAME_HOURS_PER_DAY,
         DAYS_PER_YEAR, DAYS_PER_SEASON, SUN_COLOR, MOON_COLOR,
         AMBIENT_DAY, AMBIENT_NIGHT } from '../utils/constants.js';
import { eventBus } from '../utils/EventBus.js';

export class DayNightCycle {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 10; // Start at morning
    this.gameDays = 0;
    this.totalGameTime = 10; // Start at 10am so terrain is fully lit

    // Sun
    this.sunLight = new THREE.DirectionalLight(SUN_COLOR, 1.5);
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

    // Ambient — brighter base
    this.ambientLight = new THREE.AmbientLight(AMBIENT_DAY, 0.6);
    scene.add(this.ambientLight);

    // Hemisphere light for sky color
    this.hemiLight = new THREE.HemisphereLight(0x8899bb, 0x443322, 0.5);
    scene.add(this.hemiLight);

    // Fog — lighter
    this.scene.fog = new THREE.FogExp2(0x8fa5a5, 0.006);

    this.lastHour = -1;
  }

  update(dt) {
    // Advance time
    const hoursPerRealSecond = GAME_HOURS_PER_DAY / REAL_SECONDS_PER_GAME_DAY;
    this.totalGameTime += dt * hoursPerRealSecond;
    this.timeOfDay = this.totalGameTime % GAME_HOURS_PER_DAY;
    this.gameDays = Math.floor(this.totalGameTime / GAME_HOURS_PER_DAY);

    // Sun position (arc across sky)
    // Map 6am-18pm to 0-PI for the sun arc
    const sunAngle = ((this.timeOfDay - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(sunAngle);
    const sunHoriz = Math.cos(sunAngle);
    const sunX = sunHoriz * 80;
    const sunY = sunHeight * 80;
    const sunZ = sunHoriz * 20;

    this.sunLight.position.set(sunX, Math.max(sunY, -10), sunZ);
    this.sunLight.target.position.set(0, 0, 0);

    // Moon (opposite)
    this.moonLight.position.set(-sunX, Math.max(-sunY, 10), -sunZ);

    // Smooth intensity curve that ramps up at dawn, peaks midday, ramps down at dusk
    let sunIntensity = 0;
    if (this.timeOfDay >= 5 && this.timeOfDay < 7) {
      // Dawn ramp: 0 -> 1.5
      const t = (this.timeOfDay - 5) / 2;
      sunIntensity = t * 1.5;
      this.sunLight.color.setHex(lerpColor(0xff8833, SUN_COLOR, t));
    } else if (this.timeOfDay >= 7 && this.timeOfDay < 18) {
      // Full day
      sunIntensity = 1.5;
      this.sunLight.color.setHex(SUN_COLOR);
    } else if (this.timeOfDay >= 18 && this.timeOfDay < 20) {
      // Dusk ramp: 1.5 -> 0
      const t = (this.timeOfDay - 18) / 2;
      sunIntensity = (1 - t) * 1.5;
      this.sunLight.color.setHex(lerpColor(SUN_COLOR, 0xff5500, t));
    } else {
      // Night
      sunIntensity = 0;
    }

    this.sunLight.intensity = sunIntensity;

    // Moon — bright enough to see silhouettes
    const nightIntensity = sunIntensity < 0.1 ? 0.6 : 0;
    this.moonLight.intensity = nightIntensity;

    // Ambient: smooth transition day/night
    // Use a smooth value based on sun intensity
    const ambientT = Math.min(1, sunIntensity / 1.0);
    this.ambientLight.color.setHex(lerpColor(AMBIENT_NIGHT, AMBIENT_DAY, ambientT));
    this.ambientLight.intensity = 0.35 + ambientT * 0.35;

    // Hemisphere shift — keep some sky glow at night
    this.hemiLight.color.setHex(lerpColor(0x1a2844, 0x99aacc, ambientT));
    this.hemiLight.groundColor.setHex(lerpColor(0x1a1510, 0x554433, ambientT));
    this.hemiLight.intensity = 0.35 + ambientT * 0.25;

    // Fog color shift — dark blue, not pitch black
    this.scene.fog.color.setHex(lerpColor(0x0f1520, 0x8faaaa, ambientT));
    this.scene.fog.density = 0.004 + (1 - ambientT) * 0.002;

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
