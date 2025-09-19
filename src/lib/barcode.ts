export type { BarcodeScanResult, BarcodeScanResult as BarcodeResult, BarcodeProductInfo } from '@/lib/types';
export { getBarcodeConfig } from './barcode/config';
export type { BarcodeRuntimeConfig, BarcodeEngineOption, BarcodeFormat } from './barcode/config';
export type { BarcodeEngineAdapter } from './barcode/types';
export { BarcodeService, barcodeService, type BarcodeServiceOptions } from './barcode/service';
export {
  BarcodeCameraController,
  listVideoDevices,
} from './barcode/camera';
export type {
  CameraStartOptions,
  CameraDevice,
  TorchState,
  RoiOptions,
} from './barcode/camera';
export { BarcodeDecodeLoop } from './barcode/decoder';
export type { DecodeLoopOptions } from './barcode/decoder';
