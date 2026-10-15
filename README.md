# korkz-claude-mod

[Claude Code](https://claude.com/claude-code) için dört mod.

| Mod | Ne yapar |
|---|---|
| **oturum-maliyeti** | Prompt'un üstünde bir şerit: oturum maliyeti, bağlam doluluğu, token sayıları, araç kullanımı, bağlı MCP sunucuları, 5 saatlik ve haftalık limitler. `/maliyet` ile gizlenir/gösterilir. |
| **tehlike-kalkani** | `rm -rf /`, `mkfs`, `curl … \| bash`, `git push --force`, `git reset --hard`, `DROP DATABASE`, `artisan migrate:fresh` gibi tehlikeli Bash komutlarını çalışmadan engeller. |
| **turkce-cevap** | System prompt'a "her zaman Türkçe yanıt ver" talimatı ekler. |
| **is-bitti** | 60 saniyeden uzun süren bir iş bitince toast ve masaüstü bildirimi gösterir. |

## Kurulum

Claude Code'da, prompt'a yazın (istediğiniz modlar için):

```
/plugin install oturum-maliyeti --marketplace HakanKorkz/korkz-claude-mod
/plugin install tehlike-kalkani --marketplace HakanKorkz/korkz-claude-mod
/plugin install turkce-cevap --marketplace HakanKorkz/korkz-claude-mod
/plugin install is-bitti --marketplace HakanKorkz/korkz-claude-mod
```

Marketplace'i eklemek için `y` deyin, ardından kapsamı (scope) seçin.

Terminalden:

```bash
claude plugin install oturum-maliyeti --marketplace HakanKorkz/korkz-claude-mod
```

## Notlar

- `is-bitti` Linux'ta ses çalmaz; toast ve `preferredNotifChannel` ayarındaki bildirim kanalını kullanır.
- `turkce-cevap`, Claude Code'u kurum olarak yöneten organizasyonlarda yalnızca yönetilen ayarlarda listelenirse çalışır.
