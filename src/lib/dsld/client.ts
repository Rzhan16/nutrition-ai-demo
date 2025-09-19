// Dev Note: Browser-safe DSLD helpers. Example: await dsldSearch('Vitamin C'); toggle NEXT_PUBLIC_DSLD_ENABLED='true' to enable usage in SmartScan.
import type { DsldLabel, DsldSearchMeta, DsldSearchMode, DsldSearchResult } from './types'

type DsldSearchPayload = {
  source: 'dsld'
  mode?: DsldSearchMode
  meta?: DsldSearchMeta
  data: DsldSearchResult
}

type DsldLabelPayload = {
  source: 'dsld'
  id: string
  data: DsldLabel
}

export type SearchDsldParams = {
  q: string
  size?: number
  from?: number
}

export type SearchDsldResult = {
  hits: DsldSearchResult['hits']
  total: number
  mode: DsldSearchMode
  meta: DsldSearchMeta
  payload: DsldSearchPayload
}

const parseMode = (value: unknown, headerValue: string | null): DsldSearchMode => {
  if (value === 'precise' || headerValue === 'precise') return 'precise'
  return 'generic'
}

export async function searchDsld({ q, size = 20, from = 0 }: SearchDsldParams, init?: RequestInit): Promise<SearchDsldResult> {
  const params = new URLSearchParams({ q, size: String(size), from: String(from) })
  const response = await fetch(`/api/dsld/search?${params.toString()}`, { method: 'GET', ...init })
  if (!response.ok) {
    throw new Error(`DSLD search failed: ${response.status}`)
  }

  const payload = (await response.json()) as DsldSearchPayload
  const mode = parseMode(payload.mode, response.headers.get('x-dsld-mode'))
  const hits = Array.isArray(payload.data?.hits) ? payload.data.hits : []
  const meta = payload.meta ?? { mode }
  meta.mode = mode
  const totalRaw = meta.total ?? payload.data?.total
  let total = Array.isArray((payload.data as any)?.hits) ? (payload.data as any).hits.length : hits.length
  if (typeof totalRaw === 'number') {
    total = totalRaw
  } else if (typeof totalRaw === 'string') {
    const parsed = Number.parseInt(totalRaw, 10)
    if (Number.isFinite(parsed)) {
      total = parsed
    }
  }

  return {
    hits,
    total,
    mode,
    meta,
    payload,
  }
}

export async function dsldSearch(q: string, init?: RequestInit): Promise<DsldSearchPayload> {
  const { payload } = await searchDsld({ q }, init)
  return payload
}

export async function dsldGetLabel(id: string, init?: RequestInit): Promise<DsldLabelPayload> {
  const response = await fetch(`/api/dsld/label/${encodeURIComponent(id)}`, { method: 'GET', ...init })
  if (!response.ok) {
    throw new Error(`DSLD label failed: ${response.status}`)
  }
  return response.json() as Promise<DsldLabelPayload>
}
