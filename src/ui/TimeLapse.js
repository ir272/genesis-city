import { SNAPSHOT_INTERVAL_SEC, MAX_SNAPSHOTS } from '../utils/constants.js';

export class TimeLapse {
  constructor(renderer) {
    this.renderer = renderer;
    this.snapshots = [];
    this.timer = 0;
    this.bar = document.getElementById('timelapse-bar');
    this.progress = document.getElementById('timelapse-progress');

    if (this.bar) {
      this.bar.addEventListener('click', (e) => this._onScrub(e));
    }
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= SNAPSHOT_INTERVAL_SEC) {
      this.timer = 0;
      this._takeSnapshot();
    }

    // Update progress bar width
    if (this.progress && this.snapshots.length > 0) {
      this.progress.style.width = '100%';
    }
  }

  _takeSnapshot() {
    try {
      const canvas = this.renderer.domElement;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      this.snapshots.push({
        data: dataUrl,
        timestamp: Date.now()
      });

      // Limit snapshots
      if (this.snapshots.length > MAX_SNAPSHOTS) {
        this.snapshots.shift();
      }

      // Save to localStorage (just metadata, not full images for perf)
      try {
        localStorage.setItem('genesis_snapshot_count', this.snapshots.length.toString());
        localStorage.setItem('genesis_last_session', Date.now().toString());
      } catch (e) {
        // localStorage full, ignore
      }
    } catch (e) {
      // Canvas toDataURL failed, ignore
    }
  }

  _onScrub(e) {
    if (this.snapshots.length === 0) return;
    const rect = this.bar.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    const index = Math.floor(t * (this.snapshots.length - 1));
    // Could display the snapshot in an overlay — for now just log
    console.log(`Time-lapse: viewing snapshot ${index + 1} of ${this.snapshots.length}`);
  }

  getSnapshotCount() {
    return this.snapshots.length;
  }

  hasPreviousSession() {
    const last = localStorage.getItem('genesis_last_session');
    if (!last) return false;
    const elapsed = Date.now() - parseInt(last);
    return elapsed < 24 * 60 * 60 * 1000; // within last 24 hours
  }
}
