# FABRİKATÖR

Türkçe, çevrimdışı bir iOS ve Android atölye simülasyonu. Expo Router ile Ana Panel, Fabrikam, Üretim, Depo, Piyasa ve Finans ekranları arasında gezilir. Oyuncu küçük bir mobilya atölyesi ve 150.000 TL ile başlar.

## Safari web demosu

GitHub Pages dağıtım adresi [FABRİKATÖR web demosu](https://byskybrisem.github.io/FABRIKATOR/). Safari’de ilk kez internet bağlantısıyla açın. **Paylaş → Ana Ekrana Ekle** ile oyunu kaydedebilirsiniz. İlk yüklemede oyun dosyaları önbelleğe alındıktan sonra çevrimdışı oynanabilir. Tarayıcı veya ana ekran uygulaması kendine ait bir yerel kayıt kullanabilir. Oyuna başladığınız yerden devam edin. Site verilerini temizlemek ilerlemeyi siler.

Web sürümü mobil uygulamayla aynı `src/workshop.ts` ve `src/catalog.ts` kodunu kullanır. Tarayıcıda stok, kasa ve son hareketler tek IndexedDB işlemiyle kaydedilir. Mobil sürüm SQLite kullanır. İki sürüm arasında kayıt aktarımı yoktur.

- Kayıtlar sürüm numarası taşır. Daha yeni bir sürümün kaydı bu sürümde açılmaz ve üzerine yazılmaz.
- Doğrulanamayan kayıt sessizce sıfırlanmaz. Oyuncu onay verirse eski kayıt aynı tarayıcıda `yedek-…` anahtarıyla saklanır ve yeni oyun başlar.
- **Finans → Yeni oyun başlat** onay penceresi açar. Başka sekmede sıfırlamadan önce hazırlanmış işlemler reddedilir.
- `/FABRIKATOR/depo` gibi doğrudan bağlantılar `404.html` üzerinden `#depo` ekranına yönlenir. Sayfa yenilemek 404 vermez.
- Tarayıcı kaydı bulut yedeği değildir. Özel gezinme veya site verilerini silmek kaydı siler.
- Üretim, bitiş zamanı geçtikten sonraki ilk açılışta bir kez tamamlanır. Cihaz saati geri alınırsa sayaç bir çevrimden uzun görünmez. Mobil sürümde olduğu gibi üretim gerçek bitiş zamanını bekler. Tasarım belgesindeki üç günlük çevrimdışı üst sınır ve 10 dakikalık oyun günü henüz motorda yok; motor 5 dakikalık günü kullanır.

**Geliştirme:** Node.js 24 ile `npm ci && npm run build:web` çalıştırın. `dist/site` statik site köküdür. Tarayıcı testleri bu siteyi yalnızca yerel bir sunucunun `/FABRIKATOR/` alt dizininde açar. Python ortamında `pip install playwright==1.62.0`, ardından `python -m playwright install --with-deps webkit chromium` çalıştırın. `python tests/web_browser.py` ve `BROWSER=chromium python tests/web_browser.py` iki motoru ayrı ayrı doğrular. Yayın işi, dağıtımdan sonra canlı adresin oyunu sunduğunu da kontrol eder.

**Yayın:** Tek seferlik olarak GitHub'da **Settings → Pages → Build and deployment → Source → GitHub Actions** seçin. Pages kapalıyken yayın adımı `404 Ensure GitHub Pages has been enabled` hatası verir. `FABRIKATOR Web` iş akışı PR'larda doğrulama yapar. `main` güncellendiğinde doğrulama başarılıysa yalnızca `dist/site` yayımlanır. Pages sonradan açılırsa aynı iş akışı Actions sekmesinden `main` için elle çalıştırılabilir.

## Ürünler ve müşteri siparişleri

- Katalog veridir (`src/catalog.ts`): malzemeler (tahta, bağlantı seti) ve ürünler. Yeni ürün eklemek motor kodu gerektirmez.
- **Ahşap sandalye** baştan açıktır. **Yemek masası** (5'li parti, 120 sn, 2.600 TL) itibar 15'te açılır. **Ahşap raf** (8'li parti, 90 sn, 1.350 TL) makine seviyesi 2'de açılır.
- Malzeme ürün bazında alınır, ortak depoda ortalama maliyetle tutulur. Mamul stoğu ürün bazındadır. Toptancının her ürün için ayrı günlük alım sınırı vardır.
- Her oyun günü kurgusal şirketlerden teklifler gelir. Teklifler oyunun başlangıç zamanı ve günle tohumlanır, internet bağlantısı gerektirmez. İtibar 40'ta üçüncü, 75'te dördüncü teklif gelir. Bazı teklifler zararlıdır. Kartta vergi, nakliye ve üretim maliyeti sonrası tahmini net kazanç görünür.
- **Siparişler** ekranında teklif kabul edilir, reddedilir ya da bir kez %10 yüksek karşı teklif verilir. Müşteri karşı teklifi ya kabul eder ya da çekilir. Aynı anda en fazla 4 sipariş açık olabilir.
- Stok siparişe ayrılabilir. Ayrılan ürün toptancıya satılamaz. Teslimde bedel, %5 vergi ve nakliye ayrı muhasebeleşir, itibar artar. Stokta olmayan ürün teslim edilemez.
- Teslim günü geçen sipariş bir kez iptal olur: bedelin %10'u ceza, itibar kaybı ve ayrılan stoğun serbest kalması. Kasa eksiye düşmez.
- Kasası tükenen atölye, fazla malzemesini kayıtlı maliyetinin %60'ına elden çıkarabilir. Fark "stok değer kaybı" olarak gider yazılır. Bu yol, para ve çalışan kalmadığında oyunun kilitlenmesini önler.
- Kayıt sürüm 3: tek ürünlü web (v1/v2) ve mobil SQLite kayıtları maliyeti kuruşu kuruşuna koruyarak taşınır.

## Banka ve kredi

Kurgusal oyun bankasıdır; gerçek bankacılık hizmeti değildir.

- **Şirketim → Banka**. Kasa ile banka hesabı arasında transfer yapılır; transfer gelir veya gider değildir. Mevduat günlük %0,2 faiz alır. Taksit ve maaş önce kasadan, yetmezse bankadan ödenir.
- **Kredi notu** 0–1000 arasındadır ve kalemleri ekranda görünür. Başlangıç 600'dür. Zamanında ödenen taksit, kârlılık ve teslim edilen sipariş notu yükseltir. Gecikme, borç/varlık oranı ve takipteki kredi notu düşürür. Not faiz oranını ve limiti belirler. 400 altında yeni kredi verilmez.
- **Limit**: özkaynak × (not − 300)/1000 − mevcut borç. Başlangıçta 45.000 TL'dir. En fazla 3 açık kredi olabilir. Geciken taksit varken yeni kredi verilmez.
- Krediler: **kısa vadeli işletme** (5 gün, not 600'de toplam %4), **orta vadeli büyüme** (15 gün, %15, en az 50.000 TL) ve **makine finansmanı** (10 gün, %8). Makine finansmanında bedel doğrudan makineye gider. Kredi, koşulları gösteren onay penceresi kabul edilmeden açılmaz. Koşullar o arada değiştiyse işlem reddedilir.
- Taksit her oyun gününün başında bir kez ödenir: kalan anapara ve kalan faiz, kalan taksitlere eşit bölünür. Ödenemeyen taksit %5 gecikme bedeliyle borca eklenir, vade bir gün uzar ve not düşer. Kapalı geçen süre için en fazla 3 gün işlenir. Erken ödeme kalan faizi siler, cezası yoktur.
- Muhasebe: kasa + banka + stoklar + yarı mamul + makine = özkaynak + borç. Kredi anaparası kâr değildir. Faiz ve gecikme bedeli gider, mevduat faizi gelirdir. Finans ekranı faaliyet kârını ve net kârı ayrı gösterir.
- Kayıt sürüm 4: önceki kayıtlar boş banka hesabı ve kredisiz taşınır.

## Güncellemeler

Yeni yayın service worker tarafından arka planda indirilir ve hemen devralır. Açık oyun zorla yenilenmez; **Güncelleme hazır · Güncelle** bildirimi çıkar. Ana ekrana eklenmiş uygulama bir sonraki açılışta yeni sürümle başlar. Sayfanın altındaki **Sürüm** etiketi derlemenin kimliğidir. Kayıt IndexedDB'de kalır, güncelleme onu silmez.

## Çalışanlar ve montaj hattı

- Atölye bir montaj çalışanıyla açılır. **Fabrikam** ekranında çalışan alınır, hatta atanır, hattan çekilir veya boştaki çalışan çıkarılır. Atölyede en fazla 6 çalışan olabilir.
- Her çalışanın günlük maaşı 450 TL'dir. İşe alırken o günün maaşı peşin ödenir. Sonraki her oyun gününün başında bordrodaki herkesin maaşı kesilir, buna boşta bekleyenler de dahildir. Uygulama uzun süre kapalı kalırsa en fazla 3 günlük maaş kesilir. Kasa maaşa yetmezse ödenemeyen çalışanlar ayrılır, kasa eksiye düşmez.
- Makine seviyesi hattaki koltuk sayısını (seviye + 1) ve bir çevrimde işlenebilecek parti sayısını (seviye) belirler. Her parti için hatta en az bir çalışan gerekir.
- Çevrim süresi = 60 sn × parti ÷ (makine seviyesi × hattaki çalışan). Tek çalışan ve tek partiyle ilk çevrim yine 60 saniyedir.
- Toptancı talebi gün sırasıyla 10, 30, 24, 40, 32 adettir. İlk gün değişmedi. Sonraki günlerin yüksek talebi, ek çalışanı ve makine yatırımını değerli kılar.
- Finans ekranında satış kârı, işçilik gideri ve faaliyet kârı ayrı görünür. Makine yatırımı gider değil, varlıktır.
- Eski kayıtlar (web v1 ve mobil SQLite) açılışta bir çalışanla taşınır. Geçmiş günler için maaş kesilmez.

## İlk on sandalye

1. **Depo** ekranında 4.000 TL karşılığında 20 tahta ve 10 bağlantı seti alın. Kasa 146.000 TL olur.
2. **Fabrikam** ekranında montaj çalışanını hatta atayın.
3. **Üretim** ekranında 10 sandalye başlatın. Enerji 300 TL, paketleme 200 TL tutar. Kasa 145.500 TL olur. Bir dakika sonra 10 sandalye otomatik olarak depoya girer. Uygulama kapalıysa bitiş zamanı ilk açılışta işlenir.
4. İlk oyun gününde **Piyasa** ekranındaki toptancıya 10 sandalyeyi 850 TL/adetten satın.
5. **Finans** ekranında brüt gelir 8.500 TL, satılan mal maliyeti 4.500 TL, nakliye 300 TL, oyun vergisi 425 TL ve sabit gider öncesi kazanç 3.275 TL görünür. Kasa 153.275 TL olur.
6. Hattı 3.000 TL birikmiş kazançla ikinci seviyeye yükseltin. Yeni bir çalışan alıp hatta atayın. İki çalışan ve iki parti ham maddeyle bir çevrimde 20 sandalye 30 saniyede üretilir.

Bir oyun günü beş gerçek dakikadır. Günlük teklif ve talep beş günlük bir döngü izler; her yeni gün maaşlar kesilir. Toptancı, eldeki ve o gün istediği miktarın küçük olanını alır. İlk prototipteki kayıt aktarılırken başlangıç sermayesi farkı eklenir. Eldeki mal ve devam eden işlerin önceki maliyeti korunur.

## iPhone'da deneme

### Bilgisayarsız, GitHub Codespaces ile

1. iPhone'a App Store'dan Expo Go'yu yükleyin. Safari'de [FABRIKATOR deposunu](https://github.com/byskybrisem/FABRIKATOR) açın. Dal menüsünde `feat/ilk-sandalye-partisi` dalını seçip **Code → Codespaces → Create codespace** yolunu izleyin. Menü sığmıyorsa Safari'den **Masaüstü Web Sitesi İste** seçeneğini kullanın.
2. Codespace kurulumu Node.js 24 üzerinde `npm ci`, TypeScript denetimi ve ekonomi testlerini çalıştırır. Kurulum bittiğinde **Terminal → New Terminal** açın. SDK 58'in varsayılan tüneli Expo hesabı ister. `npx expo login` çalıştırın ve kendi Expo hesabınızla giriş yapın. Sonucu `npx expo whoami` ile kontrol edin.
3. `npx expo start --tunnel --go` çalıştırın. `npm run start:iphone` aynı komutu çalıştırır. `Tunnel ready` mesajından sonra **Metro waiting on** satırındaki `exp://…` bağlantısını kopyalayıp aynı iPhone'da Safari adres çubuğuna yapıştırın ve **Expo Go'da Aç** seçeneğini onaylayın. Terminaldeki bağlantı bir Ports önizleme adresi değildir. Aynı telefonda QR okutmanız gerekmez.
4. Oyunda **Depo → Fabrikam → Üretim → Piyasa → Finans** sırasını izleyin. Test sırasında Codespace ve Metro açık kalmalı. Codespace durursa yeniden başlatıp tünel komutunu tekrar çalıştırın. Terminal yeni bir bağlantı verirse Expo Go'yu onunla açın.

### Yerel bilgisayar ile

Node.js 24+ olan bilgisayarda proje dizininde `npm ci` ve `npm start` çalıştırın. iPhone ile bilgisayarı aynı Wi-Fi ağına bağlayın. iPhone'da Expo SDK 58 destekleyen Expo Go'yu kurun ve bilgisayardaki QR kodunu Kamera ile okutun. Android'de Expo Go'nun QR okuyucusunu kullanın.

Metro sunucusundan bağımsız çevrimdışı deneme için Mac, Xcode ve iOS imzalama yapılandırmasıyla `npx expo run:ios --device --configuration Release` çalıştırın. Üretimi başlatıp uçak modunda uygulamayı tamamen kapatın. Bir dakika sonra açın ve **Depo** ekranında on sandalyeyi doğrulayın. Android için `npx expo run:android --device --variant release` kullanılabilir.

## Geliştirme ve doğrulama

- `src/catalog.ts` oynanabilir sektörü, ürünü, reçeteyi ve temel fiyatları tanımlar.
- `src/workshop.ts` ekonomi kurallarını kuruş cinsinden uygular. Stok maliyetini satış anında giderleştirir. Makine alımını yatırım olarak kaydeder.
- `src/store.ts` her komutu kayıt sürümüyle doğrular ve oyun durumuyla nakit hareketini tek SQLite işlemi içinde yazar.
- `npm test` gerçek SQLite üzerinde ekonomi, tekrar gönderim, çevrimdışı ilerleme, kayıt taşıma, işlemi geri alma, sipariş ve uzun rastgele simülasyon kontrollerini çalıştırır.
- `npm run typecheck` ve `npx expo export --platform all` TypeScript ve iki mobil platform paketini denetler.
