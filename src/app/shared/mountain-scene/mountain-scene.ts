import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { MountainEngine, RouteMarker, SceneTheme, TimeOfDay } from './mountain-engine';

// Real-time 3D flythrough used like a background video. Three.js is only downloaded when the
// scene scrolls into view; until then (and when WebGL isn't available) the fallback image
// passed as content is shown. People who prefer reduced motion get a still frame.
@Component({
  selector: 'app-mountain-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
    <canvas #canvas [class.ready]="ready()" aria-hidden="true"></canvas>
    <div class="fade" [style.opacity]="fade()"></div>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      overflow: hidden;
      display: block;
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 1.2s ease;
    }
    canvas.ready {
      opacity: 1;
    }
    .fade {
      position: absolute;
      inset: 0;
      background: #0f1f3d;
      pointer-events: none;
    }
  `,
  host: { '(document:visibilitychange)': 'onVisibility()' },
})
export class MountainScene {
  readonly theme = input<SceneTheme>('ladakh');
  readonly time = input<TimeOfDay>('dusk');
  readonly markers = input<RouteMarker[] | null>(null);
  // seconds for one pass along the road
  readonly duration = input(48);
  // false = the parent drives playback with play()/pause()/seek()
  readonly autoplay = input(true);

  readonly progress = output<number>();
  readonly loaded = output<boolean>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject(ElementRef<HTMLElement>);
  private engine: MountainEngine | null = null;
  private visible = false;
  private wantPlaying = true;
  private readonly position = signal(0);

  readonly ready = signal(false);
  readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the hero loop dips to dark for a moment where the road starts again
  readonly fade = computed(() => {
    if (this.markers() || !this.ready()) return 0;
    const p = this.position();
    return p > 0.96 ? (p - 0.96) / 0.04 : p < 0.03 ? 1 - p / 0.03 : 0;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.wantPlaying = this.autoplay() && !this.reducedMotion;
      const observer = new IntersectionObserver(
        ([entry]) => {
          this.visible = entry.isIntersecting;
          if (this.visible && !this.engine) void this.load();
          this.updateRunning();
        },
        { rootMargin: '200px' },
      );
      observer.observe(this.host.nativeElement);
      const resize = new ResizeObserver(() => this.resize());
      resize.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        resize.disconnect();
        this.engine?.dispose();
        this.engine = null;
      });
    });
  }

  play(): void {
    this.wantPlaying = true;
    this.engine?.setPlaying(true);
    this.updateRunning();
  }

  pause(): void {
    this.wantPlaying = false;
    this.engine?.setPlaying(false);
    this.updateRunning();
  }

  seek(progress: number): void {
    this.engine?.setProgress(progress);
  }

  onVisibility(): void {
    this.updateRunning();
  }

  private async load(): Promise<void> {
    if (!webglAvailable()) {
      this.loaded.emit(false);
      return;
    }
    const { MountainEngine } = await import('./mountain-engine');
    try {
      this.engine = new MountainEngine(this.canvas().nativeElement, {
        theme: this.theme(),
        time: this.time(),
        markers: this.markers(),
        duration: this.duration(),
        reducedMotion: this.reducedMotion,
        onProgress: (p) => {
          this.position.set(p);
          this.progress.emit(p);
        },
        onContextLost: () => this.ready.set(false),
      });
    } catch (err) {
      console.warn('[scene] 3D view unavailable, showing the image instead', err);
      this.loaded.emit(false);
      return;
    }
    this.engine.setPlaying(this.wantPlaying);
    this.resize();
    this.ready.set(true);
    this.loaded.emit(true);
    this.updateRunning();
  }

  private resize(): void {
    const el = this.host.nativeElement as HTMLElement;
    this.engine?.resize(el.clientWidth, el.clientHeight);
  }

  // only animate while on screen, in a visible tab and playing (reduced motion starts paused,
  // but pressing play is an explicit choice)
  private updateRunning(): void {
    if (!this.engine) return;
    const active = this.visible && document.visibilityState === 'visible';
    if (active && this.wantPlaying) this.engine.start();
    else this.engine.stop();
  }
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
