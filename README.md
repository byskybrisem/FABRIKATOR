# FABRİKATÖR

Türkçe, tek oyunculu bir mobil atölye oyunu. İlk aşamada tek ürün olan ahşap sandalyeyi onarlı partilerle üretip satarsınız. Ekrandaki izometrik atölye, malzeme ve mamul stoklarına göre değişir. Kasa, stok, gerçekleşen satış kârı ve üretimin biteceği zaman cihazdaki SQLite dosyasında tutulur.

## Bir parti oynayın

1. 2.000 TL başlangıç sermayesinden 1.000 TL ödeyerek 20 tahta ve 10 bağlantı seti alın.
2. 300 TL işçilik ödeyerek üretimi başlatın. Montaj 60 saniye sürer. Uygulama kapalıyken de cihaz saatine göre süre ilerler.
3. Hazır olan 10 sandalyeyi depoya alın. Sandalye başına maliyet 130 TL'dir.
4. Partiyi 1.800 TL'ye satın. Kasa 2.500 TL, gerçekleşen kâr 500 TL olur. Sonraki partiyi aynı atölyede başlatabilirsiniz.

Reçete ve denge değerleri ilk prototip için seçilmiştir. Kaynak tasarım belgeleri teslim edildiğinde karşılaştırılacak değerler `src/workshop.ts` içindedir.

## iPhone ve Android

Bilgisayarda Node.js 24 veya daha yenisiyle proje dizininde `npm ci` ve `npm start` çalıştırın. Telefon ile bilgisayar aynı Wi-Fi ağında olsun. Expo SDK 58 destekleyen Expo Go sürümünü kullanın. iPhone kamerasıyla terminaldeki QR kodu okutun; Android'de Expo Go içindeki QR okuyucusunu kullanın. İlk geliştirme paketi bilgisayardan yüklenir.

iPhone'da çevrimdışı soğuk açılışı doğrulamak için Mac'te Xcode ve iOS imzalama hesabıyla `npx expo run:ios --device --configuration Release` çalıştırın. Uygulamada üretimi başlatın, uçak moduna geçin ve uygulamayı tamamen kapatın. Bir dakika sonra yeniden açıp sandalyeleri depoya alın ve satın. Android cihazda Android SDK ile `npx expo run:android --device --variant release` kullanılabilir. Uygulamanın silinmesi yerel kaydı da silebilir.

## Otomatik kontroller

- `npm test` Node'un yerleşik SQLite motorunda oyun komutlarını ve diskten geri yüklemeyi sınar.
- `npm run typecheck` TypeScript denetimini çalıştırır.
- `npx expo export --platform all` iki mobil platform için dağıtım paketlerini oluşturur.
