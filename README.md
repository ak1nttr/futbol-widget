# Futbol Widget

Takip ettiğin takımların canlı skorlarını, fikstürünü, son sonuçlarını ve oyuncu ratinglerini gösteren küçük bir Windows masaüstü widget'ı.

Ekranın sağ üst köşesinde küçük bir top simgesi durur. Üzerine gelince panel açılır, fare çekilince kapanır. Favori takımlarından biri maçtaysa skor simgenin üstünde görünür. Uygulama bilgisayar açılınca kendiliğinden başlar.

## Özellikler

- **Favorilerim:** Her takım için canlı maç, sıradaki maç, son maç ve son 5 maçın formu (G/B/M)
- **Bugün:** Seçilen liglerde günün maçları, gün değiştirme ve "sadece canlı" filtresi
- **Takım:** Yaklaşan ve geçmiş maçlar; kadro ve oyuncuların sezon ortalama ratingi (lig/turnuva seçilebilir)
- **Maç:** Skor, canlı dakika, goller ve kırmızı kartlar, iki takımın kadrosu ve maç ratingleri, maçın oyuncusu
- **Ayarlar:** Takım arama, favori ekleme/sıralama, "Bugün" sekmesi için lig seçimi
- Açık ve koyu tema (sistem ayarını izler)

## Kullanım

- **Paneli açmak:** Sağ üstteki simgenin üzerine gel. Paneldeki iğne simgesine basarsan fareyi çeksen de açık kalır.
- **Tepsi simgesi** (saatin yanındaki top): Sol tık simgeyi gizler veya gösterir. Sağ tık menüsünde şunlar var:
  - **Göster / Gizle**
  - **Bilgisayar açılınca başlat:** Varsayılan olarak açık.
  - **Kapat:** Uygulamayı tamamen kapatır.

## Kurulum

[Releases](https://github.com/ak1nttr/futbol-widget/releases) sayfasındaki `Futbol-Widget_x.y.z_x64-setup.exe` dosyasını indirip çalıştır. Yönetici izni gerekmez.

## Geliştirme

Gereken: Windows, Node.js 20+, Rust ve Microsoft C++ Build Tools.

```sh
npm install
npm run tauri dev     # masaüstü uygulaması, canlı yenileme ile
npm run tauri build   # kurulum dosyası: src-tauri/target/release/bundle/nsis/
npm run dev           # sadece tarayıcı demosu: http://localhost:5180
```

## Veri kaynağı

Veriler Sofascore'un herkese açık ama **resmi olarak belgelenmemiş** API'sinden gelir. Bu uygulama Sofascore ile bağlantılı değildir. API haber verilmeden değişebilir. Kişisel kullanım içindir.

Sofascore, tarayıcıdan ve Node/OpenSSL'den gelen istekleri engelliyor ama Windows'un kendi TLS katmanını (Schannel) kabul ediyor. Bu yüzden istekler arayüzden doğrudan değil, bir aracı üzerinden gider:

- **Masaüstü uygulamasında** arayüz `http://sofa.localhost/...` adresine istek atar. Bu adresi Rust tarafı karşılar ([src-tauri/src/sofa.rs](src-tauri/src/sofa.rs)), isteği `native-tls` (Schannel) ile Sofascore'a iletir ve yanıtları kısa süre önbellekte tutar.
- **Tarayıcı demosunda** aynı işi Vite sunucusu Windows'un `curl.exe` aracıyla yapar ([dev/sofaProxy.ts](dev/sofaProxy.ts)).

İstek sayısı düşük tutulur: favori takımın maçı yokken veriler 5 dakikada bir, maç sırasında 20 saniyede bir yenilenir.

## Teknoloji

Tauri 2 (Rust) + Preact + TypeScript + Vite.

```
src/          arayüz (Preact)
  api/        Sofascore istekleri ve tipler
  lib/        tarih/dakika biçimlendirme, ayarlar, veri çekme, masaüstü köprüsü
  components/ maç satırı, logo, rating rozeti
  views/      Favorilerim, Bugün, Takım, Maç, Ayarlar
src-tauri/    masaüstü kabuğu: pencere, tepsi, otomatik başlatma, Sofascore proxy'si
dev/          tarayıcı demosu için proxy
```
