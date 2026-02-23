import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  DepthOfFieldEffect,
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
      intensity: 0.5,
      luminanceThreshold: 0.6,
      luminanceSmoothing: 0.3,
      kernelSize: KernelSize.MEDIUM
    });

    // Depth of field — soft edges
    this.dof = new DepthOfFieldEffect(camera, {
      focusDistance: 0.05,
      focalLength: 0.08,
      bokehScale: 2.0
    });

    // Film grain
    this.noise = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: true
    });
    this.noise.blendMode.opacity.value = 0.08;

    // Vignette
    this.vignette = new VignetteEffect({
      darkness: 0.5,
      offset: 0.3
    });

    // Combine effects
    const effectPass = new EffectPass(camera, this.bloom, this.noise, this.vignette);
    this.composer.addPass(effectPass);

    // Separate DOF pass for better control
    const dofPass = new EffectPass(camera, this.dof);
    this.composer.addPass(dofPass);
  }

  updateTimeOfDay(timeOfDay) {
    // Stronger bloom at dawn/dusk for god ray feel
    const isDawn = timeOfDay >= 5 && timeOfDay < 7;
    const isDusk = timeOfDay >= 18 && timeOfDay < 20;
    const isNight = timeOfDay > 20 || timeOfDay < 5;

    if (isDawn || isDusk) {
      this.bloom.intensity = 1.2;
    } else if (isNight) {
      this.bloom.intensity = 0.8;
      this.vignette.uniforms.get('darkness').value = 0.7;
    } else {
      this.bloom.intensity = 0.4;
      this.vignette.uniforms.get('darkness').value = 0.4;
    }
  }

  render() {
    this.composer.render();
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
  }
}
