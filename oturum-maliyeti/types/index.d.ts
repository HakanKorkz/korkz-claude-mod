export type Limit = {
  kind: string
  percentUsed: number
  resetsAt?: string
  /** Bu hızla %100'e ulaşılacak an (epoch ms); sıfırlanmadan sonraysa yetişir. */
  bitis?: number
}

/** Bir modelin plandaki durumu: deneme isteği yanıt verdi, vermedi ya da sürüyor. */
export type Erisim = 'var' | 'yok' | 'bakiliyor'

export type Git = {
  /** Dal adı; ayrık HEAD'de null. */
  branch: string | null
  /** Ayrık HEAD'de kısa commit. */
  commit: string | null
  /** Çalışma ağacının klasör adı. */
  tree: string
  /** Bağlı bir worktree mi (ana çalışma ağacı değil). */
  isWorktree: boolean
  /** Ana deponun klasör adı. */
  repo: string
}

export type Dal = {
  ad: string
  /** Dal başka bir worktree'de açıksa onun yolu. */
  worktree: string | null
}

export type Worktree = {
  yol: string
  ad: string
  /** Açık dal; ayrık HEAD'de null. */
  dal: string | null
  /** Ana çalışma ağacı mı. */
  ana: boolean
}

export type AltAjan = {
  id: string
  /** Ajan türü (`Explore`, `general-purpose`, `plugin:ajan`). */
  tur: string
  /** Agent çağrısının görev açıklaması. */
  aciklama: string
  /** Son model isteğinin modeli. */
  model: string | null
  durum: 'calisiyor' | 'bitti' | 'hata' | 'durdu'
  basladi: number
  bitti: number | null
  /** Tamamlanan araç çağrısı sayısı. */
  arac: number
  /** Şu an çalışan araç. */
  sonArac: string | null
  token: number
  /** Onu başlatan alt ajan; ana döngüden başladıysa null. */
  ustId: string | null
}

export type LimitDurumu = {
  /** Limitlerin ölçüldüğü an (epoch ms); hiç ölçülmediyse 0. */
  at: number
  /** Nereden geldi: bu oturumun isteği, başka bir oturum, /usage. */
  kaynak: 'oturum' | 'paylasim' | 'usage' | null
  yenileniyor: boolean
}

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
      /** Oturumun çalıştığı git dalı ve worktree; depo dışında null. */
      git: Git | null
      /** Açık git menüsü. */
      gitMenu: 'dal' | 'worktree' | null
      dallar: Dal[]
      worktreeler: Worktree[]
      /** Bu oturumdaki alt ajanlar, başlama sırasıyla. */
      ajanlar: AltAjan[]
      /** Çalışan ajanların süresini ilerletmek için son saat. */
      saat: number
      limitDurumu: LimitDurumu
    }
  }
}
