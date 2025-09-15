// Type definitions for Quagga.js
declare module 'quagga' {
  interface QuaggaConfig {
    inputStream: {
      name: string;
      type: string;
      target: string | HTMLElement;
      constraints?: {
        width: number;
        height: number;
        facingMode?: string;
      };
    };
    locator: {
      patchSize: string;
      halfSample: boolean;
    };
    numOfWorkers?: number;
    frequency?: number;
    decoder: {
      readers: string[];
    };
    locate: boolean;
  }

  interface QuaggaResult {
    codeResult: {
      code: string;
      format: string;
      decodedCodes?: any[];
    };
    boxes?: any[];
  }

  interface QuaggaDecodeConfig {
    inputStream: {
      name: string;
      type: string;
      target: HTMLCanvasElement;
      constraints: {
        width: number;
        height: number;
      };
    };
    locator: {
      patchSize: string;
      halfSample: boolean;
    };
    decoder: {
      readers: string[];
    };
    locate: boolean;
  }

  const Quagga: {
    init(config: QuaggaConfig, callback: (err: any) => void): void;
    start(): void;
    stop(): void;
    onDetected(callback: (result: QuaggaResult) => void): void;
    onProcessed(callback: (result: QuaggaResult | null) => void): void;
    decodeSingle(
      config: QuaggaDecodeConfig,
      callback: (result: QuaggaResult | null) => void
    ): void;
  };

  export = Quagga;
} 