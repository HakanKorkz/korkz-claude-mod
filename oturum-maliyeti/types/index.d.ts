export type Limit = {
  kind: string
  percentUsed: number
  resetsAt?: string
  /** Bu hızla %100'e ulaşılacak an (epoch ms); sıfırlanmadan sonraysa yetişir. */
  bitis?: number
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
  /** Araçları görünen (bağlı) MCP sunucuları. */
  mcpServers: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'oturum-maliyeti': { usage: Usage; isHidden: boolean; tools: Tools }
  }
}
