export type Limit = {
  kind: string
  percentUsed: number
  resetsAt?: string
  /** Bu hızla %100'e ulaşılacak an (epoch ms); sıfırlanmadan sonraysa yetişir. */
  bitis?: number
}

/** Bir modelin plandaki durumu: deneme isteği yanıt verdi, vermedi ya da sürüyor. */
export type Erisim = 'var' | 'yok' | 'bakiliyor'

export type Usage = {
  usd: number | null
  contextTokens: number | null
  contextWindow: number | null
  contextPercent: number | null
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  turns: number
  limits: Limit[]
}

export type Tools = {
  /** Tamamlanan çağrı sayısı, araç adına göre (MCP araçları `mcp__sunucu__araç`). */
  calls: Record<string, number>
  /** Şu an çalışan çağrı sayısı, araç adına göre. */
  running: Record<string, number>
  /** Hata ya da ret ile biten çağrılar. */
  errors: number
}

export type Plugins = {
  /** Ayarlarda açık olan plugin'ler (`enabledPlugins`), `@marketplace` olmadan. */
  active: string[]
  /** Plugin'in araç, skill ya da ajan kullanım sayısı. */
  calls: Record<string, number>
  /** Şu an çalışan kullanım sayısı. */
  running: Record<string, number>
  /** Bu turda kullanılan plugin'ler. */
  thisTurn: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'oturum-maliyeti': {
      usage: Usage
      isHidden: boolean
      tools: Tools
      plugins: Plugins
      /** Oturumun şu anki modeli (`claude-opus-5-5`). */
      model: string | null
      /** `/config` Model satırının seçenekleri (`sonnet`, `opus[1m]`…). */
      modelOptions: string[]
      isModelMenuOpen: boolean
      /** Bu projede seçili model (`sonnet`, `opus[1m]`); null ise genel ayar. */
      projeModeli: string | null
      /** Menüdeki modellerin plandaki durumu. */
      erisim: Record<string, Erisim>
    }
  }
}
