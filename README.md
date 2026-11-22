# FABRİKATÖR

Türkçe, çevrimdışı bir iOS ve Android atölye simülasyonu. Expo Router ile Ana Panel, Fabrikam, Üretim, Depo, Piyasa ve Finans ekranları arasında gezilir. Oyuncu küçük bir mobilya atölyesi ve 150.000 TL ile başlar.

## İlk on sandalye

1. **Depo** ekranında 4.000 TL karşılığında 20 tahta ve 10 bağlantı seti alın. Kasa 146.000 TL olur.
2. **Fabrikam** ekranında montaj ustasını hatta atayın.
3. **Üretim** ekranında 10 sandalye başlatın. Enerji 300 TL, paketleme 200 TL tutar. Kasa 145.500 TL olur. Bir dakika sonra 10 sandalye otomatik olarak depoya girer. Uygulama kapalıysa bitiş zamanı ilk açılışta işlenir.
4. İlk oyun gününde **Piyasa** ekranındaki toptancıya 10 sandalyeyi 850 TL/adetten satın.
5. **Finans** ekranında brüt gelir 8.500 TL, satılan mal maliyeti 4.500 TL, nakliye 300 TL, oyun vergisi 425 TL ve sabit gider öncesi kazanç 3.275 TL görünür. Kasa 153.275 TL olur.
6. Hattı 3.000 TL birikmiş kazançla ikinci seviyeye yükseltin. İki parti ham maddeyle bir çevrimde 20 sandalye üretebilirsiniz. Süre 30 saniyeye iner.

Bir oyun günü beş gerçek dakikadır. Günlük teklif ve talep beş günlük bir döngü izler. Toptancı, eldeki ve o gün istediği miktarın küçük olanını alır. İlk prototipteki kayıt aktarılırken başlangıç sermayesi farkı eklenir. Eldeki mal ve devam eden işlerin önceki maliyeti korunur.

## iPhone'da deneme

### Bilgisayarsız, GitHub Codespaces ile

1. iPhone'a App Store'dan Expo Go'yu yükleyin. Safari'de [FABRIKATOR deposunu](https://github.com/byskybrisem/FABRIKATOR) açın. Dal menüsünde `feat/ilk-sandalye-partisi` dalını seçip **Code → Codespaces → Create codespace** yolunu izleyin. Menü sığmıyorsa Safari'den **Masaüstü Web Sitesi İste** seçeneğini kullanın.
2. Codespace kurulumu Node.js 24 üzerinde `npm ci`, TypeScript denetimi ve ekonomi testlerini çalıştırır. Kurulum bittiğinde **Terminal → New Terminal** açın. Expo hesabıyla giriş yapmanız istenirse `npx expo login` çalıştırın ve Expo hesabınızı terminalde doğrulayın. Durumu görmek için `npx expo whoami` çalıştırabilirsiniz. Bu projede Expo hesabı oyunun kendi üyeliği değildir.
3. `npx expo start --tunnel --go` çalıştırın. `npm run start:iphone` aynı komutu çalıştırır. `Tunnel ready` mesajından sonra **Metro waiting on** satırındaki `exp://…` bağlantısını kopyalayıp aynı iPhone'da Safari adres çubuğuna yapıştırın ve **Expo Go'da Aç** seçeneğini onaylayın. Terminaldeki bağlantı bir Ports önizleme adresi değildir. Aynı telefonda QR okutmanız gerekmez.
4. Oyunda **Depo → Fabrikam → Üretim → Piyasa → Finans** sırasını izleyin. Test sırasında Codespace ve Metro açık kalmalı. Codespace durursa yeniden başlatıp tünel komutunu tekrar çalıştırın. Terminal yeni bir bağlantı verirse Expo Go'yu onunla açın.

### Yerel bilgisayar ile

Node.js 24+ olan bilgisayarda proje dizininde `npm ci` ve `npm start` çalıştırın. iPhone ile bilgisayarı aynı Wi-Fi ağına bağlayın. iPhone'da Expo SDK 58 destekleyen Expo Go'yu kurun ve bilgisayardaki QR kodunu Kamera ile okutun. Android'de Expo Go'nun QR okuyucusunu kullanın.

Metro sunucusundan bağımsız çevrimdışı deneme için Mac, Xcode ve iOS imzalama yapılandırmasıyla `npx expo run:ios --device --configuration Release` çalıştırın. Üretimi başlatıp uçak modunda uygulamayı tamamen kapatın. Bir dakika sonra açın ve **Depo** ekranında on sandalyeyi doğrulayın. Android için `npx expo run:android --device --variant release` kullanılabilir.

## Geliştirme ve doğrulama

- `src/catalog.ts` oynanabilir sektörü, ürünü, reçeteyi ve temel fiyatları tanımlar.
- `src/workshop.ts` ekonomi kurallarını kuruş cinsinden uygular. Stok maliyetini satış anında giderleştirir. Makine alımını yatırım olarak kaydeder.
- `src/store.ts` her komutu kayıt sürümüyle doğrular ve oyun durumuyla nakit hareketini tek SQLite işlemi içinde yazar.
- `npm test` gerçek SQLite üzerinde ekonomi, tekrar gönderim, çevrimdışı ilerleme, kayıt taşıma ve işlemi geri alma kontrollerini çalıştırır.
- `npm run typecheck` ve `npx expo export --platform all` TypeScript ve iki mobil platform paketini denetler.
