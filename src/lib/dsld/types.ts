// Dev Note: DSLD shared types. Example usage: import { DsldSearchResult } from '@/lib/dsld/types'; toggle NEXT_PUBLIC_DSLD_ENABLED='true' to enable enrichment.
export type DsldSearchHit = {
  _id?: string
  _score?: number
  _source?: Record<string, unknown>
}

export type DsldSearchResult = {
  hits?: DsldSearchHit[]
  stats?: Record<string, unknown>
  total?: unknown
  max_score?: number
}

export type DsldLabel = Record<string, unknown>

export type DsldSearchMode = 'generic' | 'precise'

export type DsldSearchMeta = {
  mode?: DsldSearchMode
  size?: number
  from?: number
  status?: string | number
  total?: number
  receivedQ?: string
  sentQ?: string
  attemptedPrecise?: boolean
  preciseBrand?: string
  preciseProduct?: string
  preciseFallback?: boolean
}
