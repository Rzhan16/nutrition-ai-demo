import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat as ZXingFormat, DecodeHintType } from '@zxing/library'
import type { BarcodeScanResult, BarcodeFormat as BarcodeFormatType } from '@/lib/types'
import { nowMs, toBarcodeResult } from '../utils'
import type { BarcodeDecodeOptions, BarcodeEngineAdapter } from '../types'

const ENGINE_ID = 'zxing' as const

const formatMap: Record<BarcodeFormatType, ZXingFormat> = {
  EAN13: ZXingFormat.EAN_13,
  EAN8: ZXingFormat.EAN_8,
  UPC: ZXingFormat.UPC_A,
  UPCE: ZXingFormat.UPC_E,
  CODE128: ZXingFormat.CODE_128,
  CODE39: ZXingFormat.CODE_39,
}

const mapFormatsToZXing = (formats: BarcodeFormatType[]): ZXingFormat[] =>
  formats.map((format) => formatMap[format]).filter((value): value is ZXingFormat => Boolean(value))

export class ZXingAdapter implements BarcodeEngineAdapter {
  public readonly id = ENGINE_ID
  private reader: BrowserMultiFormatReader | null = null

  async initialize(): Promise<void> {
    if (this.reader) return
    if (typeof window === 'undefined') {
      throw new Error('ZXing is only available in the browser environment')
    }
    this.reader = new BrowserMultiFormatReader()
  }

  async decodeFromCanvas(
    canvas: HTMLCanvasElement,
    options: BarcodeDecodeOptions,
  ): Promise<BarcodeScanResult | null> {
    if (typeof window === 'undefined') {
      return null
    }
    if (!this.reader) {
      await this.initialize()
    }
    if (!this.reader) {
      return null
    }

    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.TRY_HARDER, true)
    const possibleFormats = mapFormatsToZXing(options.allowedFormats)
    if (possibleFormats.length > 0) {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, possibleFormats)
    }
    try {
      this.reader.setHints(hints)
    } catch (error) {
      console.warn('Unable to set ZXing hints', error)
    }

    const start = nowMs()
    try {
      const result = await this.reader.decodeFromCanvas(canvas)
      const duration = nowMs() - start
      if (!result) return null
      return toBarcodeResult(
        this.id,
        result.getText(),
        result.getBarcodeFormat().toString(),
        1,
        duration,
        result,
      )
    } catch {
      return null
    }
  }

  async decodeFromFile(
    file: File,
    options: BarcodeDecodeOptions,
  ): Promise<BarcodeScanResult | null> {
    if (typeof window === 'undefined') {
      return null
    }
    if (!this.reader) {
      await this.initialize()
    }
    if (!this.reader) {
      return null
    }

    const imageUrl = URL.createObjectURL(file)
    try {
      const image = new Image()
      const start = nowMs()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Failed to load image'))
        image.src = imageUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Canvas context unavailable')
      }
      ctx.drawImage(image, 0, 0)

      const result = await this.decodeFromCanvas(canvas, options)
      if (result) {
        result.durationMs = nowMs() - start
      }
      return result
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  }

  async dispose(): Promise<void> {
    if (!this.reader) {
      return
    }
    const stoppable = this.reader as unknown as { stopContinuousDecode?: () => Promise<void> | void }
    if (typeof stoppable.stopContinuousDecode === 'function') {
      await stoppable.stopContinuousDecode()
    }
    this.reader = null
  }
}
