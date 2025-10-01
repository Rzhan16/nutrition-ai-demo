import type { BarcodeScanResult, BarcodeEngineOption, BarcodeFormat } from '@/lib/types';
import { getBarcodeConfig } from './config';
import { BarcodeService, resolveEngines } from './service';
import { nowMs } from './utils';
import { BarcodeCameraController, type CameraStartOptions, type RoiOptions } from './camera';

export interface DecodeLoopOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  overlay?: HTMLCanvasElement;
  engine?: BarcodeEngineOption;
  allowedFormats?: BarcodeFormat[];
  framesPerSecond?: number;
  consensusThreshold?: number;
  timeoutMs?: number;
  onProgress?: (meta: {
    framesTried: number;
    lastResult?: BarcodeScanResult | null;
    elapsedMs: number;
  }) => void;
  onResult: (result: BarcodeScanResult) => void;
  onError?: (error: Error) => void;
  roi?: RoiOptions;
}

interface FrameVote {
  code: string;
  confidence: number;
  count: number;
}

export class BarcodeDecodeLoop {
  private rafId: number | null = null;
  private running = false;
  private framesTried = 0;
  private lastTimestamp = 0;
  private readonly consensus: FrameVote[] = [];
  private readonly service: BarcodeService;
  private readonly camera: BarcodeCameraController;
  private readonly config = getBarcodeConfig();
  private readonly engineOrder: ReturnType<typeof resolveEngines>;

  constructor(private readonly options: DecodeLoopOptions) {
    this.service = new BarcodeService({
      engine: options.engine,
      allowedFormats: options.allowedFormats,
      framesPerSecond: options.framesPerSecond,
      consensusThreshold: options.consensusThreshold,
      timeoutMs: options.timeoutMs,
    });
    this.camera = new BarcodeCameraController(options.roi);
    const engineOption = options.engine ?? this.config.engine;
    this.engineOrder = resolveEngines(engineOption);
    if (this.engineOrder.length === 0) {
      this.engineOrder.push('quagga');
    }
  }

  async startCamera(cameraOptions: Omit<CameraStartOptions, 'overlayCanvas' | 'videoElement'> & {
    overlayCanvas?: HTMLCanvasElement;
  }): Promise<void> {
    await this.camera.start({
      ...cameraOptions,
      videoElement: this.options.video,
      overlayCanvas: cameraOptions.overlayCanvas ?? this.options.overlay,
    });
  }

  stopCamera(): void {
    void this.camera.stop();
  }

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const timeout = this.options.timeoutMs ?? this.config.timeoutMs;
    const start = nowMs();

    const loop = async (): Promise<void> => {
      if (!this.running) return;

      const elapsed = nowMs() - start;
      if (elapsed > timeout) {
        this.finishWithError('timeout');
        return;
      }

      const delta = nowMs() - this.lastTimestamp;
      const frameInterval = 1000 / (this.options.framesPerSecond ?? this.config.framesPerSecond);
      if (delta >= frameInterval) {
        this.lastTimestamp = nowMs();
        await this.processFrame();
      }

      this.options.onProgress?.({
        framesTried: this.framesTried,
        lastResult: this.getBestVoteResult() ?? null,
        elapsedMs: elapsed,
      });
    };

    const schedule = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(async () => {
        await loop();
        schedule();
      });
    };

    schedule();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    void this.service.dispose();
    this.consensus.length = 0;
    this.framesTried = 0;
  }

  private async processFrame(): Promise<void> {
    try {
      const ctx = this.options.canvas.getContext('2d');
      const video = this.options.video;
      if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return;

      this.options.canvas.width = video.videoWidth;
      this.options.canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      const decodeStart = nowMs();
      const result = await this.service.decodeCanvas(this.options.canvas);
      const decodeDuration = nowMs() - decodeStart;
      this.framesTried += 1;

      if (result.ok && result.code) {
        result.durationMs = result.durationMs ?? decodeDuration;
        if (this.registerVote(result)) {
          this.finishWithResult(result);
        }
      }
    } catch (error) {
      console.warn('Frame processing failed', error);
    }
  }

  private registerVote(result: BarcodeScanResult): boolean {
    const threshold = this.options.consensusThreshold ?? this.config.consensusThreshold;
    const entry = this.consensus.find((vote) => vote.code === result.code);
    if (entry) {
      entry.count += 1;
      entry.confidence = Math.max(entry.confidence, result.confidence ?? 0);
      if (entry.count >= threshold) {
        return true;
      }
    } else {
      this.consensus.push({
        code: result.code ?? '',
        confidence: result.confidence ?? 0,
        count: 1,
      });
      if (result.confidence !== undefined && result.confidence >= 0.9) {
        return true;
      }
    }
    return false;
  }

  private getBestVoteResult(): BarcodeScanResult | undefined {
    if (this.consensus.length === 0) return undefined;
    const best = [...this.consensus].sort((a, b) => b.count - a.count || (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (!best) return undefined;
    return {
      ok: true,
      code: best.code,
      confidence: best.confidence,
      durationMs: 0,
      engine: this.engineOrder[0],
    };
  }

  private finishWithResult(result: BarcodeScanResult): void {
    this.stop();
    this.options.onResult(result);
  }

  private finishWithError(errorCode: BarcodeScanResult['errorCode']): void {
    this.stop();
    const duration = this.options.timeoutMs ?? this.config.timeoutMs;
    const errorResult: BarcodeScanResult = {
      ok: false,
      durationMs: duration,
      engine: this.engineOrder[0],
      errorCode,
    };
    this.options.onError?.(new Error(errorCode ?? 'barcode_error'));
    this.options.onResult(errorResult);
  }
}
