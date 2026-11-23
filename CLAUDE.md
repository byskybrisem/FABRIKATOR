# CLAUDE.md

## Kod keşfi kuralları

- Kod keşfi için Graphify'ı öncelikli kullan. Önce kod grafiğinde ilgili fonksiyonları, bağımlılıkları ve çağrı ilişkilerini bul (`graphify_find`, `graphify_callers`, `graphify_node`, `graphify_file_neighbors`, `graphify_impact`, `graphify_tests_for`, `query_graph`).
- Yalnızca değişiklik veya doğrulama için gereken dosyaları oku. Gereksiz tam depo taraması yapma.
- İşe başlamadan indeks güncelliğini kontrol et: Graphify sonucundaki `commitSha` ile `git rev-parse HEAD` değerini karşılaştır. Farklıysa, `git diff --stat <commitSha> HEAD` ile o commit'ten sonra değişen dosyaları bul ve bunlar için grafiğe güvenmeyip dosyayı doğrudan oku.
- Graphify sonucu boş, kısmi (`coverage` notu) veya yetersizse normal dosya okumasına/metin aramasına geç. Sabit metinler, yapılandırma değerleri ve indekslenmemiş dosyalar için metin araması kullan.
- Gereksiz araç çağrılarını azalt, ancak test ve güvenlik doğrulamalarını asla atlama.
