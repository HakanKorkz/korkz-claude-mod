# korkz-claude-mod

[Claude Code](https://claude.com/claude-code) için altı mod.

| Mod | Ne yapar |
|---|---|
| **oturum-maliyeti** | Prompt'un üstünde bir şerit: kullanılan model (tıklayınca planınızdaki modeller listelenir, birine tıklayınca yalnızca o proje için o modele geçilir), çalışılan git dalı ve worktree (tıklayınca dallar ya da worktree'ler listelenir, birine tıklayınca oraya geçilir), alt ajanlar (hangisi çalışıyor, hangi model, görevi, süresi, araç sayısı, şu an çalışan aracı, token), oturum maliyeti, bağlam doluluğu, token sayıları, araç kullanımı, bağlı MCP sunucuları, 5 saatlik ve haftalık limitler. `/maliyet` ile gizlenir/gösterilir. |
| **tehlike-kalkani** | `rm -rf /`, `mkfs`, `curl … \| bash`, `DROP DATABASE`, `shutdown` gibi yıkıcı Bash komutlarını çalışmadan engeller. `git push --force`, `git reset --hard`, `artisan migrate:fresh`/`db:wipe`, `chmod -R 777`, `docker system prune`, `DROP TABLE`, `TRUNCATE` gibi riskli olanlarda, izin kuralları izin verse bile onay ister. |
| **turkce-cevap** | System prompt'a "her zaman Türkçe yanıt ver" talimatı ekler. |
| **is-bitti** | Uzun süren bir iş bitince (süre prompt'u gönderdiğiniz andan ölçülür) ses çalar, masaüstü bildirimi ve toast gösterir; bildirimde proje adı ve Claude'un cevabının ilk satırı yer alır. Claude izin isterken ya da soru sorarken ayrı bir sesle "onay bekliyor" der. `/is-bitti` ile ayarlanır. |
| **gizli-koruma** | `.env`, `*.pem`, `*.key`, `id_rsa` gibi gizli dosyaların okunmasını (Read, `cat`, `grep`…) ve `git add` ile eklenmesini engeller. Commit'e gizli dosya girmişse durdurur; diff'te API anahtarına, özel anahtara ya da parolaya benzeyen bir şey varsa onay ister. `.env.example` gibi örnek dosyalar serbesttir. |
| **oto-format** | Edit/Write sonrası PHP dosyalarını `vendor/bin/pint`, JS/TS/Vue/CSS dosyalarını `node_modules/.bin/prettier` ile biçimlendirir; yalnızca projede kuruluysa. `/oto-format` ile açılır/kapanır. |

## Kurulum

Claude Code'da, prompt'a yazın (istediğiniz modlar için):

```
/plugin install oturum-maliyeti --marketplace HakanKorkz/korkz-claude-mod
/plugin install tehlike-kalkani --marketplace HakanKorkz/korkz-claude-mod
/plugin install turkce-cevap --marketplace HakanKorkz/korkz-claude-mod
/plugin install is-bitti --marketplace HakanKorkz/korkz-claude-mod
/plugin install gizli-koruma --marketplace HakanKorkz/korkz-claude-mod
/plugin install oto-format --marketplace HakanKorkz/korkz-claude-mod
```

Marketplace'i eklemek için `y` deyin, ardından kapsamı (scope) seçin.

Terminalden:

```bash
claude plugin install oturum-maliyeti --marketplace HakanKorkz/korkz-claude-mod
```

## is-bitti ayarları

```
/is-bitti              şu anki ayarlar
/is-bitti 30           30 saniyeden uzun işlerde haber ver (varsayılan 60)
/is-bitti sustur       ses ve bildirim verme (toast kalır) · /is-bitti aç ile geri açılır
/is-bitti ses kapat    yalnızca bildirim
/is-bitti odak aç      terminal penceresi öndeyken ses ve bildirim verme
/is-bitti sıfırla      varsayılanlara dön
```

`odak` X11 ve XWayland pencerelerinde `xdotool` ile çalışır; yerel Wayland uygulamaları öndeyken yanlış sonuç verebileceği için varsayılan olarak kapalıdır.

## Notlar

- Şeritten seçilen model yalnızca o projenin kök klasörü için geçerlidir ve hiçbir ayar dosyasına yazılmaz; diğer projeler genel modelle (`/model`, `/config`) devam eder. Seçim ana döngünün her model isteğine uygulanır; alt ajanlar kendi modellerinde kalır. `/model` ile model seçerseniz projenin seçimi kalkar.
- Şeritten dal değiştirmek `git switch <dal>` çalıştırır; kaydedilmemiş değişiklikler çakışırsa git'in hatası gösterilir ve dal değişmez. Başka bir worktree'de açık dallar 🌳 ile işaretlidir, tıklayınca o worktree'ye geçilir. Worktree geçişi Claude Code'un `EnterWorktree` aracıyla yapılır ve her seferinde onay ister. Geçişten sonraki ilk mesajınıza Claude için bir not eklenir.
- Model menüsü açılınca her modele 1 token'lık bir deneme isteği gider; planınıza dahil olmayanlar 🔒 ile gösterilir ve seçilemez. Sonuç 12 saat saklanır.
- `turkce-cevap`, Claude Code'u kurum olarak yöneten organizasyonlarda yalnızca yönetilen ayarlarda listelenirse çalışır.
- `tehlike-kalkani` ve `gizli-koruma`nın "onay ister" kuralları auto modda kullanıcıya değil auto mod sınıflandırıcısına sorulur.
