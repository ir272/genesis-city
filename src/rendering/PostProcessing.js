import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
  KernelSize
} from 'postprocessing';

export class PostProcessingStack {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // Bloom — warm light sources glow softly
    this.bloom = new BloomEffect({
      intensity: 0.4,
      luminanceThreshold: 0.7,
      luminanceSmoothing: 0.3,
      kernelSize: KernelSize.MEDIUM
    });

    // Film grain — subtle
    this.noise = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: true
    });
    this.noise.blendMode.opacity.value = 0.06;

    // Vignette — subtle
    this.vignette = new VignetteEffect({
      darkness: 0.3,
      offset: 0.4
    });

    // Combine effects in one pass
    const effectPass = new EffectPass(camera, this.bloom, this.noise, this.vignette);
    this.composer.addPass(effectPass);
  }

  updateTimeOfDay(timeOfDay) {
    const isDawn = timeOfDay >= 5 && timeOfDay < 7;
    const isDusk = timeOfDay >= 18 && timeOfDay < 20;
    const isNight = timeOfDay > 20 || timeOfDay < 5;

    if (isDawn || isDusk) {
      this.bloom.intensity = 1.0;
      this.vignette.uniforms.get('darkness').value = 0.3;
    } else if (isNight) {
      this.bloom.intensity = 1.2; // Window glow + torches bloom bright
      this.vignette.uniforms.get('darkness').value = 0.35;
    } else {
      this.bloom.intensity = 0.3;
      this.vignette.uniforms.get('darkness').value = 0.25;
    }
  }

  render() {
    this.composer.render();
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
  }
}
