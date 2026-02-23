import * as THREE from 'three';

// Enhanced water rendering with subtle animation
export class WaterRenderer {
  constructor(scene, waterMesh) {
    this.scene = scene;
    this.waterMesh = waterMesh;
    this.time = 0;
  }

  update(dt, timeOfDay) {
    if (!this.waterMesh) return;
    this.time += dt;

    // Subtle wave motion via vertex offset is too expensive for a full plane.
    // Instead, animate material properties.
    const mat = this.waterMesh.material;

    // Reflect sky color based on time of day
    const isNight = timeOfDay > 20 || timeOfDay < 5;
    const isDusk = timeOfDay >= 18 && timeOfDay < 20;
    const isDawn = timeOfDay >= 5 && timeOfDay < 7;

    if (isNight) {
      mat.color.setHex(0x0a1520);
      mat.opacity = 0.8;
    } else if (isDusk) {
      mat.color.setHex(0x2a2030);
      mat.opacity = 0.7;
    } else if (isDawn) {
      mat.color.setHex(0x3a2a20);
      mat.opacity = 0.7;
    } else {
      mat.color.setHex(0x1a3040);
      mat.opacity = 0.6;
    }

    // Subtle position oscillation for wave illusion
    this.waterMesh.position.y = -0.2 + Math.sin(this.time * 0.5) * 0.02;
  }
}
