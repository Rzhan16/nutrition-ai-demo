import Tesseract, { type RecognizeResult, type LoggerMessage, PSM, OEM } from 'tesseract.js'

type OcrImageSource = Blob | HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData

export interface OcrImageMeta {
  width: number
  height: number
  pixelCount: number
}

export interface OcrPreprocessOptions {
  maxSide?: number
  threshold?: boolean
}

export interface OcrPreprocessResult {
  canvas: HTMLCanvasElement
  meta: OcrImageMeta & { thresholdOn: boolean }
}

const DEFAULT_MAX_SIDE = 1400

const isCanvas = (source: OcrImageSource): source is HTMLCanvasElement =>
  typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement

const isImageElement = (source: OcrImageSource): source is HTMLImageElement =>
  typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement

const isImageData = (source: OcrImageSource): source is ImageData =>
  typeof ImageData !== 'undefined' && source instanceof ImageData

const isBlob = (source: OcrImageSource): source is Blob => source instanceof Blob

const isImageBitmap = (source: OcrImageSource): source is ImageBitmap => {
  if (typeof ImageBitmap === 'undefined') {
    return false
  }
  try {
    return source instanceof ImageBitmap
  } catch {
    const candidate = source as ImageBitmap | undefined
    return (
      typeof candidate?.width === 'number' &&
      typeof candidate?.height === 'number' &&
      typeof candidate?.close === 'function'
    )
  }
}

const ensureBrowserCanvas = (width: number, height: number): HTMLCanvasElement => {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is not available in this environment')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const getContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null
  if (!context) {
    throw new Error('Canvas context unavailable')
  }
  return context
}

const cloneCanvas = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const canvas = ensureBrowserCanvas(source.width, source.height)
  getContext(canvas).drawImage(source, 0, 0)
  return canvas
}

const canvasFromBitmap = (bitmap: ImageBitmap): HTMLCanvasElement => {
  const canvas = ensureBrowserCanvas(bitmap.width, bitmap.height)
  getContext(canvas).drawImage(bitmap, 0, 0)
  return canvas
}

const canvasFromImage = (image: HTMLImageElement): HTMLCanvasElement => {
  const canvas = ensureBrowserCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height)
  getContext(canvas).drawImage(image, 0, 0)
  return canvas
}

const canvasFromImageData = (data: ImageData): HTMLCanvasElement => {
  const canvas = ensureBrowserCanvas(data.width, data.height)
  getContext(canvas).putImageData(data, 0, 0)
  return canvas
}

const resizeCanvasIfNeeded = (source: HTMLCanvasElement, maxSide: number): HTMLCanvasElement => {
  const longestSide = Math.max(source.width, source.height)
  if (!maxSide || longestSide <= maxSide) {
    return cloneCanvas(source)
  }

  const scale = maxSide / longestSide
  const targetWidth = Math.round(source.width * scale)
  const targetHeight = Math.round(source.height * scale)
  const canvas = ensureBrowserCanvas(targetWidth, targetHeight)
  getContext(canvas).drawImage(source, 0, 0, targetWidth, targetHeight)
  return canvas
}

const applyGrayscale = (imageData: ImageData, grayscaleValues: Uint8ClampedArray): number => {
  let sum = 0
  for (let i = 0, pixelIndex = 0; i < imageData.data.length; i += 4, pixelIndex += 1) {
    const red = imageData.data[i]
    const green = imageData.data[i + 1]
    const blue = imageData.data[i + 2]
    const gray = Math.round(red * 0.299 + green * 0.587 + blue * 0.114)
    imageData.data[i] = gray
    imageData.data[i + 1] = gray
    imageData.data[i + 2] = gray
    grayscaleValues[pixelIndex] = gray
    sum += gray
  }
  return sum
}

const applyThreshold = (imageData: ImageData, grayscaleValues: Uint8ClampedArray, average: number): void => {
  const threshold = average * 0.92
  for (let i = 0, pixelIndex = 0; i < imageData.data.length; i += 4, pixelIndex += 1) {
    const value = grayscaleValues[pixelIndex] >= threshold ? 255 : 0
    imageData.data[i] = value
    imageData.data[i + 1] = value
    imageData.data[i + 2] = value
  }
}

const enhanceCanvasContrast = (canvas: HTMLCanvasElement, thresholdOn: boolean): void => {
  const context = getContext(canvas)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const grayscaleValues = new Uint8ClampedArray(imageData.data.length / 4)
  const sum = applyGrayscale(imageData, grayscaleValues)

  if (thresholdOn && grayscaleValues.length > 0) {
    const average = sum / grayscaleValues.length
    applyThreshold(imageData, grayscaleValues, average)
  }

  context.putImageData(imageData, 0, 0)
}

const blobToImage = async (blob: Blob): Promise<HTMLImageElement> => {
  if (typeof window === 'undefined') {
    throw new Error('Image loading is not available in this environment')
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    if (typeof image.decode === 'function') {
      try {
        await image.decode()
        return image
      } catch {
        // Fallback to load events below
      }
    }

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to load image'))
    })
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

const ensureCanvasFromSource = async (source: OcrImageSource): Promise<HTMLCanvasElement> => {
  if (isCanvas(source)) {
    return cloneCanvas(source)
  }

  if (isImageBitmap(source)) {
    const canvas = canvasFromBitmap(source)
    if (typeof source.close === 'function') {
      source.close()
    }
    return canvas
  }

  if (isImageElement(source)) {
    return canvasFromImage(source)
  }

  if (isImageData(source)) {
    return canvasFromImageData(source)
  }

  if (isBlob(source)) {
    const image = await blobToImage(source)
    return canvasFromImage(image)
  }

  throw new Error('Unsupported OCR source input')
}

export const preprocessOcrSource = async (
  source: OcrImageSource,
  options: OcrPreprocessOptions = {}
): Promise<OcrPreprocessResult> => {
  const thresholdOn = options.threshold !== false
  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE
  const baseCanvas = await ensureCanvasFromSource(source)
  const processedCanvas = resizeCanvasIfNeeded(baseCanvas, maxSide)
  enhanceCanvasContrast(processedCanvas, thresholdOn)

  return {
    canvas: processedCanvas,
    meta: {
      width: processedCanvas.width,
      height: processedCanvas.height,
      pixelCount: processedCanvas.width * processedCanvas.height,
      thresholdOn,
    },
  }
}

export const choosePSM = (meta: OcrImageMeta): PSM => {
  const { width, height, pixelCount } = meta
  const aspectRatio = width && height ? width / height : 1
  const area = pixelCount || width * height
  const isWideShort = aspectRatio >= 2.5 && height < 720
  const isDense = area >= 1_200_000 && aspectRatio < 2 && height > 600

  if (isWideShort) {
    return PSM.SINGLE_LINE
  }

  if (isDense) {
    return PSM.SPARSE_TEXT
  }

  return PSM.AUTO
}

export const applyDynamicPageSegMode = async (
  workerInstance: Tesseract.Worker,
  meta: OcrImageMeta
): Promise<PSM> => {
  const nextMode = choosePSM(meta)
  await workerInstance.setParameters({ tessedit_pageseg_mode: nextMode })
  return nextMode
}

export type TesseractLoggerMessage = LoggerMessage
export type TesseractRecognizeResult = RecognizeResult

let worker: Tesseract.Worker | null = null

async function pickCorePath(): Promise<string> {
  const candidates = ['/tesseract/tesseract-core.wasm.js', '/tesseract/tesseract-core.wasm']

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { method: 'HEAD' })
      if (response.ok) {
        return candidate
      }
    } catch (error) {
      console.warn('Failed to probe Tesseract core path', candidate, error)
    }
  }

  throw new Error('Unable to locate Tesseract core assets. Please run npm run stage:tess and retry.')
}

export async function getOcrWorker(
  logger?: (message: TesseractLoggerMessage) => void
): Promise<Tesseract.Worker> {
  if (worker) {
    return worker
  }

  const corePath = await pickCorePath()
  const options: Partial<Tesseract.WorkerOptions> = {
    workerPath: '/tesseract/worker.min.js',
    corePath,
    langPath: '/tesseract',
  }

  worker = await Tesseract.createWorker('eng', OEM.LSTM_ONLY, options)

  await worker.reinitialize('eng', OEM.LSTM_ONLY)

  if (logger && typeof worker.setLogger === 'function') {
    worker.setLogger(logger)
  }

  await worker.setParameters({
    // tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%()-+µ/ ',
    preserve_interword_spaces: '1',
    tessedit_pageseg_mode: PSM.AUTO,
  })

  return worker
}

export async function terminateOcrWorker(): Promise<void> {
  if (!worker) return
  await worker.terminate()
  worker = null
}
