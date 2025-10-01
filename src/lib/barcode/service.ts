import type {
  BarcodeScanResult,
  BarcodeEngineOption,
  BarcodeEngine,
  BarcodeFormat,
} from '@/lib/types';
import { getBarcodeConfig } from './config';
import type { BarcodeEngineAdapter, BarcodeDecodeOptions } from './types';
import { QuaggaAdapter } from './adapters/quagga';
import { ZXingAdapter } from './adapters/zxing';
import { Html5QrcodeAdapter } from './adapters/html5-qrcode';
import { buildErrorResult, nowMs, isBrowser } from './utils';

const ENGINE_PRIORITY: BarcodeEngine[] = ['quagga', 'zxing', 'html5-qrcode'];

const isMobileDevice = (): boolean =>
  typeof navigator !== 'undefined' &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent ?? '');

export const resolveEngines = (
  option: BarcodeEngineOption
): BarcodeEngine[] => {
  if (option === 'auto') {
    return ENGINE_PRIORITY;
  }
  return [option as BarcodeEngine].filter((engine): engine is BarcodeEngine =>
    ENGINE_PRIORITY.includes(engine)
  );
};

const createAdapter = (engine: BarcodeEngine): BarcodeEngineAdapter => {
  switch (engine) {
    case 'quagga':
      return new QuaggaAdapter();
    case 'zxing':
      return new ZXingAdapter();
    case 'html5-qrcode':
      return new Html5QrcodeAdapter();
    default:
      throw new Error(`Unsupported barcode engine: ${engine}`);
  }
};

export interface BarcodeServiceOptions {
  engine?: BarcodeEngineOption;
  allowedFormats?: BarcodeFormat[];
  framesPerSecond?: number;
  consensusThreshold?: number;
  timeoutMs?: number;
}

type ScannerSession = {
  video: HTMLVideoElement;
  stream: MediaStream | null;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rafId: number | null;
  timeoutId: number | null;
  running: boolean;
  decodePending: boolean;
  lastFrameTs: number;
  frequencyMs: number;
  allowedFormats: BarcodeFormat[];
  providedVideo: boolean;
  container?: HTMLElement | null;
  detections: Map<string, number>;
  consensusThreshold: number;
  facingMode: 'environment' | 'user';
  deviceId?: string | null;
  startedAt: number;
};

const ALIAS_FORMAT_MAP: Record<string, BarcodeFormat> = {
  EAN13: 'EAN13',
  EAN_13: 'EAN13',
  'EAN-13': 'EAN13',
  EAN8: 'EAN8',
  EAN_8: 'EAN8',
  'EAN-8': 'EAN8',
  UPC: 'UPC',
  UPC_A: 'UPC',
  'UPC-A': 'UPC',
  UPCE: 'UPCE',
  UPC_E: 'UPCE',
  'UPC-E': 'UPCE',
  CODE128: 'CODE128',
  CODE_128: 'CODE128',
  'CODE-128': 'CODE128',
  CODE39: 'CODE39',
  CODE_39: 'CODE39',
  'CODE-39': 'CODE39',
  EAN_READER: 'EAN13',
  'EAN-READER': 'EAN13',
  EAN_13_READER: 'EAN13',
  EAN13_READER: 'EAN13',
  EAN_8_READER: 'EAN8',
  EAN8_READER: 'EAN8',
  UPC_A_READER: 'UPC',
  UPCA_READER: 'UPC',
  UPC_E_READER: 'UPCE',
  UPCE_READER: 'UPCE',
  CODE_128_READER: 'CODE128',
  CODE128_READER: 'CODE128',
  CODE_39_READER: 'CODE39',
  CODE39_READER: 'CODE39',
};

export class BarcodeService {
  private readonly adapters = new Map<BarcodeEngine, BarcodeEngineAdapter>();
  private readonly config = getBarcodeConfig();
  private scanSession: ScannerSession | null = null;

  constructor(private readonly overrides: BarcodeServiceOptions = {}) {}

  private getAllowedFormats(): BarcodeFormat[] {
    return this.overrides.allowedFormats?.length
      ? this.overrides.allowedFormats
      : this.config.allowedFormats;
  }

  private getEngineOrder(): BarcodeEngine[] {
    const requested = this.overrides.engine ?? this.config.engine;
    return resolveEngines(requested);
  }

  private async getAdapter(
    engine: BarcodeEngine
  ): Promise<BarcodeEngineAdapter> {
    let adapter = this.adapters.get(engine);
    if (!adapter) {
      adapter = createAdapter(engine);
      this.adapters.set(engine, adapter);
    }
    await adapter.initialize();
    return adapter;
  }

  private buildOptions(): BarcodeDecodeOptions {
    return { allowedFormats: this.getAllowedFormats() };
  }

  private normalizeFormats(rawFormats?: string[]): BarcodeFormat[] {
    if (!rawFormats || rawFormats.length === 0) {
      return this.getAllowedFormats();
    }

    const normalized = rawFormats
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => value.toUpperCase())
      .map(value => ALIAS_FORMAT_MAP[value] ?? (value as BarcodeFormat))
      .filter(
        (value): value is BarcodeFormat =>
          Boolean(value) && this.config.allowedFormats.includes(value)
      );

    return normalized.length > 0 ? normalized : this.getAllowedFormats();
  }

  private resolveFrequency(frequency?: number): number {
    const baseFps =
      this.overrides.framesPerSecond ?? this.config.framesPerSecond;
    const requested = frequency ?? baseFps;
    const clamped = Math.max(1, Math.min(requested, 30));
    return Math.round(1000 / clamped);
  }

  private buildVideoConstraints(
    session: ScannerSession,
    options: { deviceId?: string | null; facingMode?: 'environment' | 'user' }
  ): MediaStreamConstraints {
    const mobile = isMobileDevice();
    const frameRate = Math.min(
      30,
      Math.max(5, Math.round(1000 / session.frequencyMs))
    );
    const widthIdeal = mobile ? 1280 : 1920;
    const heightIdeal = mobile ? 720 : 1080;

    const constraints: MediaTrackConstraints = {
      frameRate: { ideal: frameRate, max: 60 },
      width: { ideal: widthIdeal, max: mobile ? 1920 : 2560 },
      height: { ideal: heightIdeal, max: mobile ? 1080 : 1440 },
    };

    const preferredDeviceId = options.deviceId ?? session.deviceId ?? undefined;
    const preferredFacingMode =
      options.facingMode ?? session.facingMode ?? 'environment';

    if (preferredDeviceId) {
      constraints.deviceId = { exact: preferredDeviceId };
    } else if (preferredFacingMode) {
      constraints.facingMode = { ideal: preferredFacingMode };
    }

    return { video: constraints };
  }

  private ensureScannerSession(
    options: {
      target?: HTMLElement | null;
      formats?: string[];
      frequency?: number;
      deviceId?: string | null;
      facingMode?: 'environment' | 'user';
    } = {}
  ): ScannerSession {
    if (!isBrowser()) {
      throw new Error('Barcode scanning is only available in the browser.');
    }

    const { target, formats, frequency, deviceId, facingMode } = options;

    let videoElement: HTMLVideoElement | null = null;
    let providedVideo = false;
    let container: HTMLElement | null | undefined = undefined;

    if (target instanceof HTMLVideoElement) {
      videoElement = target;
      providedVideo = true;
    } else if (target instanceof HTMLElement) {
      container = target;
      const existingVideo = Array.from(container.children).find(
        child => child instanceof HTMLVideoElement
      ) as HTMLVideoElement | undefined;
      videoElement = existingVideo ?? null;
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.className = 'barcode-video';
        container.innerHTML = '';
        container.appendChild(videoElement);
      }
    }

    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.style.display = 'none';
      document.body.appendChild(videoElement);
      container = videoElement.parentElement;
    }

    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.autoplay = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Unable to acquire canvas context for barcode scanning.');
    }

    const allowedFormats = this.normalizeFormats(formats);
    const frequencyMs = this.resolveFrequency(frequency);
    const consensusThreshold = Math.max(
      1,
      this.overrides.consensusThreshold ?? this.config.consensusThreshold
    );
    const activeFacingMode = facingMode ?? 'environment';
    const activeDeviceId = deviceId ?? null;

    this.scanSession = {
      video: videoElement,
      stream: null,
      canvas,
      ctx,
      rafId: null,
      timeoutId: null,
      running: false,
      decodePending: false,
      lastFrameTs: 0,
      frequencyMs,
      allowedFormats,
      providedVideo,
      container,
      detections: new Map(),
      consensusThreshold,
      facingMode: activeFacingMode,
      deviceId: activeDeviceId,
      startedAt: nowMs(),
    };

    return this.scanSession;
  }

  async decodeFile(file: File): Promise<BarcodeScanResult> {
    if (!isBrowser()) {
      return buildErrorResult(
        'quagga',
        0,
        'unsupported',
        'Barcode decoding is only available in the browser.'
      );
    }
    const engines = this.getEngineOrder();
    if (engines.length === 0) {
      return buildErrorResult(
        'quagga',
        0,
        'unsupported',
        'No barcode engines are enabled'
      );
    }

    const options = this.buildOptions();
    const start = nowMs();
    for (const engine of engines) {
      try {
        const adapter = await this.getAdapter(engine);
        const result = await adapter.decodeFromFile(file, options);
        if (result) {
          result.engine = engine;
          result.durationMs = result.durationMs ?? nowMs() - start;
          return result;
        }
      } catch (error) {
        console.warn(`Barcode engine ${engine} failed:`, error);
      }
    }

    const duration = nowMs() - start;
    return buildErrorResult(engines[0], duration, 'not_found');
  }

  async decodeCanvas(canvas: HTMLCanvasElement): Promise<BarcodeScanResult> {
    if (!isBrowser()) {
      return buildErrorResult(
        'quagga',
        0,
        'unsupported',
        'Barcode decoding is only available in the browser.'
      );
    }
    const engines = this.getEngineOrder();
    const options = this.buildOptions();
    const start = nowMs();

    for (const engine of engines) {
      try {
        const adapter = await this.getAdapter(engine);
        const result = await adapter.decodeFromCanvas(canvas, options);
        if (result) {
          result.engine = engine;
          result.durationMs = result.durationMs ?? nowMs() - start;
          return result;
        }
      } catch (error) {
        console.warn(`Barcode engine ${engine} failed:`, error);
      }
    }

    const duration = nowMs() - start;
    return buildErrorResult(engines[0], duration, 'not_found');
  }

  async dispose(): Promise<void> {
    this.stopScanning();
    await Promise.all(
      Array.from(this.adapters.values()).map(adapter => adapter.dispose())
    );
    this.adapters.clear();
  }

  // Legacy compatibility APIs – will be replaced in upcoming phases
  async scanFromImage(file: File): Promise<BarcodeScanResult[]> {
    const result = await this.decodeFile(file);
    return result.ok ? [result] : [];
  }

  async checkCameraPermission(): Promise<boolean> {
    if (!isBrowser()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async initializeScanner(
    options: {
      target?: HTMLElement | null;
      formats?: string[];
      frequency?: number;
      deviceId?: string | null;
      facingMode?: 'environment' | 'user';
    } = {}
  ): Promise<void> {
    if (!isBrowser()) {
      throw new Error('Barcode scanning is only available in the browser.');
    }

    this.stopScanning();
    this.ensureScannerSession(options);
  }

  async startScanning(
    onDetected: (result: BarcodeScanResult) => void,
    onError?: (error: Error) => void,
    options: {
      video?: HTMLVideoElement | null;
      frequency?: number;
      deviceId?: string | null;
      facingMode?: 'environment' | 'user';
    } = {}
  ): Promise<void> {
    if (!isBrowser()) {
      onError?.(
        new Error('Barcode scanning is only available in the browser.')
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error('Camera access is not supported on this device.'));
      return;
    }

    try {
      if (
        !this.scanSession ||
        (options.video && this.scanSession.video !== options.video)
      ) {
        this.ensureScannerSession({
          target: options.video ?? undefined,
          frequency: options.frequency,
          deviceId: options.deviceId ?? null,
          facingMode: options.facingMode,
        });
      } else {
        if (options.frequency !== undefined) {
          this.scanSession.frequencyMs = this.resolveFrequency(
            options.frequency
          );
        }
        if (typeof options.deviceId !== 'undefined') {
          this.scanSession.deviceId = options.deviceId;
        }
        if (options.facingMode) {
          this.scanSession.facingMode = options.facingMode;
        }
      }
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error('Failed to initialize barcode scanner.')
      );
      return;
    }

    const session = this.scanSession;
    if (!session) {
      onError?.(new Error('Barcode scanner not initialized.'));
      return;
    }

    if (session.running) {
      return;
    }

    session.consensusThreshold = Math.max(
      1,
      this.overrides.consensusThreshold ?? this.config.consensusThreshold
    );
    if (typeof options.deviceId !== 'undefined') {
      session.deviceId = options.deviceId;
    }
    if (options.facingMode) {
      session.facingMode = options.facingMode;
    }
    session.detections.clear();

    const engines = this.getEngineOrder();
    if (engines.length === 0) {
      onError?.(new Error('No barcode engines are enabled.'));
      return;
    }

    try {
      const constraints = this.buildVideoConstraints(session, {
        deviceId: options.deviceId ?? null,
        facingMode: options.facingMode,
      });
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!this.scanSession || this.scanSession !== session) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      session.stream = stream;
      const { video } = session;
      video.srcObject = stream;

      const ensurePlayback = async () => {
        try {
          await video.play();
        } catch (error) {
          console.warn('Video playback could not start automatically:', error);
        }
      };

      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        await ensurePlayback();
      } else {
        await new Promise<void>((resolve, reject) => {
          const handleLoaded = async () => {
            video.removeEventListener('loadedmetadata', handleLoaded);
            video.removeEventListener('error', handleError);
            await ensurePlayback();
            resolve();
          };
          const handleError = (event: Event) => {
            video.removeEventListener('loadedmetadata', handleLoaded);
            video.removeEventListener('error', handleError);
            reject(
              event instanceof ErrorEvent
                ? (event.error ?? new Error('Video error'))
                : new Error('Video error')
            );
          };

          video.addEventListener('loadedmetadata', handleLoaded, {
            once: true,
          });
          video.addEventListener('error', handleError, { once: true });
        });
      }

      const adapters = await Promise.all(
        engines.map(async engine => ({
          engine,
          adapter: await this.getAdapter(engine),
        }))
      );

      session.allowedFormats =
        session.allowedFormats.length > 0
          ? session.allowedFormats
          : this.getAllowedFormats();

      const timeoutMs = this.overrides.timeoutMs ?? this.config.timeoutMs;
      const deadline = Date.now() + timeoutMs;

      const scheduleTimeoutCheck = () => {
        if (!session.running) return;
        session.timeoutId = window.setTimeout(() => {
          if (!session.running) return;
          if (Date.now() >= deadline) {
            this.stopScanning();
            onError?.(new Error('Barcode scanning timed out.'));
          } else {
            scheduleTimeoutCheck();
          }
        }, 500);
      };

      const scanLoop = async () => {
        if (!this.scanSession || this.scanSession !== session) {
          return;
        }

        if (!session.running) return;

        if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          session.rafId = requestAnimationFrame(() => {
            void scanLoop();
          });
          return;
        }

        const now = performance.now();
        if (
          session.decodePending ||
          now - session.lastFrameTs < session.frequencyMs
        ) {
          session.rafId = requestAnimationFrame(() => {
            void scanLoop();
          });
          return;
        }

        session.decodePending = true;
        session.lastFrameTs = now;

        try {
          session.canvas.width = video.videoWidth;
          session.canvas.height = video.videoHeight;
          session.ctx.drawImage(
            video,
            0,
            0,
            session.canvas.width,
            session.canvas.height
          );

          for (const { engine, adapter } of adapters) {
            try {
              const result = await adapter.decodeFromCanvas(session.canvas, {
                allowedFormats: session.allowedFormats,
              });

              if (result && result.ok !== false) {
                const key =
                  [result.code ?? '', result.format ?? '']
                    .filter(Boolean)
                    .join('|') || 'unknown';
                const currentCount = (session.detections.get(key) ?? 0) + 1;
                session.detections.set(key, currentCount);

                session.detections.forEach((value, detectionKey) => {
                  if (detectionKey !== key) {
                    const nextValue = value > 1 ? value - 1 : 0;
                    if (nextValue <= 0) {
                      session.detections.delete(detectionKey);
                    } else {
                      session.detections.set(detectionKey, nextValue);
                    }
                  }
                });

                if (currentCount >= session.consensusThreshold) {
                  const detectionDuration = nowMs() - session.startedAt;
                  const resolvedResult: BarcodeScanResult = {
                    ...result,
                    engine,
                    durationMs: result.durationMs ?? detectionDuration,
                    framesTried: (result.framesTried ?? 0) + currentCount,
                    confidence: result.confidence ?? 1,
                  };
                  session.detections.clear();
                  this.stopScanning();
                  onDetected(resolvedResult);
                  return;
                }
              }
            } catch (engineError) {
              console.warn(
                `Barcode engine ${engine} failed during live scan:`,
                engineError
              );
            }
          }
        } catch (loopError) {
          console.error('Barcode scan loop error:', loopError);
        } finally {
          session.decodePending = false;
        }

        if (session.running) {
          session.detections.forEach((value, key) => {
            if (value <= 1) {
              session.detections.delete(key);
            } else {
              session.detections.set(key, value - 1);
            }
          });
          session.rafId = requestAnimationFrame(() => {
            void scanLoop();
          });
        }
      };

      session.running = true;
      session.startedAt = nowMs();
      session.lastFrameTs = 0;
      scheduleTimeoutCheck();
      session.rafId = requestAnimationFrame(() => {
        void scanLoop();
      });
    } catch (error) {
      this.stopScanning();
      onError?.(
        error instanceof Error
          ? error
          : new Error('Failed to start barcode scanner.')
      );
    }
  }

  stopScanning(): void {
    const session = this.scanSession;
    if (!session) return;

    session.running = false;

    if (session.rafId !== null) {
      cancelAnimationFrame(session.rafId);
      session.rafId = null;
    }

    if (session.timeoutId !== null) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
    }

    if (session.stream) {
      session.stream.getTracks().forEach(track => track.stop());
      session.stream = null;
    }

    const { video } = session;
    try {
      video.pause();
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    } catch (error) {
      console.warn('Unable to reset barcode video element:', error);
    }

    if (!session.providedVideo && video.parentElement) {
      video.parentElement.removeChild(video);
    }

    session.detections.clear();
    this.scanSession = null;
  }

  cleanup(): void {
    this.stopScanning();
  }
}

export const barcodeService = new BarcodeService();
