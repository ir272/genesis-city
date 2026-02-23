import * as THREE from 'three';
import { GRID_SIZE } from '../utils/constants.js';

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Orbit parameters
    this.target = new THREE.Vector3(0, 0, 0);
    this.distance = 60;
    this.minDistance = 10;
    this.maxDistance = 120;
    this.phi = Math.PI / 4; // vertical angle (from top)
    this.theta = 0; // horizontal angle
    this.autoRotateSpeed = 0.02; // radians per second
    this.autoRotate = true;

    // Interaction state
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.dampingTheta = 0;
    this.dampingPhi = 0;

    // Cinematic mode
    this.cinematicMode = false;
    this.cinematicTarget = null;
    this.cinematicStartTime = 0;
    this.cinematicDuration = 5;

    this._bindEvents();
    this._updatePosition();
  }

  _bindEvents() {
    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.autoRotate = false;
        this.lastMouse.x = e.clientX;
        this.lastMouse.y = e.clientY;
      }
    });

    this.domElement.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse.x = e.clientX;
      this.lastMouse.y = e.clientY;

      this.theta -= dx * 0.005;
      this.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this.phi - dy * 0.005));
    });

    this.domElement.addEventListener('mouseup', () => {
      this.isDragging = false;
      // Resume auto-rotate after 10 seconds of inactivity
      setTimeout(() => {
        if (!this.isDragging) this.autoRotate = true;
      }, 10000);
    });

    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance *= (1 + e.deltaY * 0.001);
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    }, { passive: false });

    // Prevent context menu
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(dt) {
    if (this.cinematicMode) {
      this._updateCinematic(dt);
    } else {
      if (this.autoRotate) {
        this.theta += this.autoRotateSpeed * dt;
      }
    }

    this._updatePosition();
  }

  _updatePosition() {
    const x = this.target.x + this.distance * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.target.y + this.distance * Math.cos(this.phi);
    const z = this.target.z + this.distance * Math.sin(this.phi) * Math.sin(this.theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  // Fly to a specific building
  flyToBuilding(worldPos, onComplete) {
    this.cinematicMode = true;
    this.cinematicTarget = worldPos.clone();
    this.cinematicStartPos = this.camera.position.clone();
    this.cinematicStartTarget = this.target.clone();
    this.cinematicStartTime = Date.now();
    this.cinematicDuration = 3;
    this.cinematicCallback = onComplete;
    this.autoRotate = false;
  }

  _updateCinematic(dt) {
    const elapsed = (Date.now() - this.cinematicStartTime) / 1000;
    const t = Math.min(1, elapsed / this.cinematicDuration);
    const eased = t * t * (3 - 2 * t); // smooth step

    if (this.cinematicTarget) {
      // Interpolate target
      this.target.lerpVectors(this.cinematicStartTarget, this.cinematicTarget, eased);

      // Pull in closer
      const targetDist = 15;
      this.distance = this.distance + (targetDist - this.distance) * eased * 0.1;

      if (t >= 1) {
        this.cinematicMode = false;
        // Stay for a moment then return
        setTimeout(() => {
          this.target.set(0, 0, 0);
          this.distance = 60;
          this.autoRotate = true;
        }, 4000);
        if (this.cinematicCallback) this.cinematicCallback();
      }
    }
  }

  // Get world position under mouse for raycasting
  getMouseRay(event, camera) {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    return raycaster;
  }
}
