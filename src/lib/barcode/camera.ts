import { isBrowser } from './utils';

declare global {
  interface MediaTrackConstraintSet {
    torch?: boolean;
  }

  interface MediaTrackCapabilities {
    torch?: boolean;
  }
}

export interface CameraDevice {
  id: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface CameraStartOptions {
  videoElement: HTMLVideoElement;
  overlayCanvas?: HTMLCanvasElement;
  preferRearCamera?: boolean;
  idealResolution?: {
    width?: number;
    height?: number;
  };
  deviceId?: string;
  onDeviceChange?: (device: MediaDeviceInfo | null) => void;
}

export interface TorchState {
  supported: boolean;
  enabled: boolean;
}

export interface RoiOptions {
  xRatio?: number;
  yRatio?: number;
  widthRatio?: number;
  heightRatio?: number;
  borderColor?: string;
  borderWidth?: number;
}

const waitForVideoReady = (video: HTMLVideoElement): Promise<void> =>
  new Promise((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }
    const onLoaded = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      resolve();
    };
    video.addEventListener('loadedmetadata', onLoaded, { once: true });
  });

const pickEnvironmentDevice = (devices: MediaDeviceInfo[]): MediaDeviceInfo | null => {
  const byLabel = devices.find((device) => /back|rear|environment/i.test(device.label));
  return byLabel ?? devices[0] ?? null;
};

export const listVideoDevices = async (): Promise<CameraDevice[]> => {
  if (!isBrowser()) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device) => ({
      id: device.deviceId,
      label: device.label,
      kind: device.kind,
    }));
};

export class BarcodeCameraController {
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private torchState: TorchState = { supported: false, enabled: false };
  private videoElement: HTMLVideoElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;

  constructor(private readonly roi: RoiOptions = {}) {}

  getTorchState(): TorchState {
    return this.torchState;
  }

  async start(options: CameraStartOptions): Promise<void> {
    if (!isBrowser()) {
      throw new Error('Camera access is only available in the browser.');
    }

    await this.stop();

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');

    let chosenDevice: MediaDeviceInfo | null = null;

    if (options.deviceId) {
      chosenDevice = videoDevices.find((device) => device.deviceId === options.deviceId) || null;
    }

    if (!chosenDevice && options.preferRearCamera !== false) {
      chosenDevice = pickEnvironmentDevice(videoDevices);
    }

    if (!chosenDevice) {
      chosenDevice = videoDevices[0] ?? null;
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        deviceId: chosenDevice ? { exact: chosenDevice.deviceId } : undefined,
        facingMode: chosenDevice ? undefined : { ideal: 'environment' },
        width: { ideal: options.idealResolution?.width ?? 1280 },
        height: { ideal: options.idealResolution?.height ?? 720 },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.warn('Primary camera request failed, falling back to generic constraints', error);
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    if (!this.stream) {
      throw new Error('Unable to acquire camera stream');
    }

    this.track = this.stream.getVideoTracks()[0] ?? null;
    this.torchState = this.computeTorchState();

    options.videoElement.srcObject = this.stream;
    await waitForVideoReady(options.videoElement);
    await options.videoElement.play();
    this.videoElement = options.videoElement;

    if (options.overlayCanvas) {
      this.prepareOverlay(options.videoElement, options.overlayCanvas);
      this.drawRoi(options.overlayCanvas, this.roi);
      this.overlayCtx = options.overlayCanvas.getContext('2d');
      this.overlayCanvas = options.overlayCanvas;
    }

    options.onDeviceChange?.(chosenDevice);
  }

  async stop(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.track) {
      this.track.stop();
      this.track = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    if (this.overlayCtx && this.overlayCanvas) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
      this.overlayCtx = null;
      this.overlayCanvas = null;
    }
    this.torchState = { supported: false, enabled: false };
  }

  async setTorch(enabled: boolean): Promise<void> {
    if (!this.track) return;
    const capabilities = this.track.getCapabilities?.();
    if (!capabilities || !('torch' in capabilities)) {
      this.torchState = { supported: false, enabled: false };
      return;
    }

    try {
      await this.track.applyConstraints({ advanced: [{ torch: enabled }] });
      this.torchState = { supported: true, enabled };
    } catch (error) {
      console.warn('Failed to toggle torch', error);
      this.torchState = { supported: true, enabled: false };
    }
  }

  drawRoi(canvas: HTMLCanvasElement, overrides: RoiOptions = {}): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    void overrides;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private prepareOverlay(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
    const updateCanvasSize = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
    updateCanvasSize();
  }

  private computeTorchState(): TorchState {
    if (!this.track?.getCapabilities) {
      return { supported: false, enabled: false };
    }
    const capabilities = this.track.getCapabilities();
    const supported = Boolean(capabilities && 'torch' in capabilities);
    return { supported, enabled: false };
  }
}
