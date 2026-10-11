# Futbol Widget

Takip ettiğin takımların canlı skorlarını, fikstürünü, son sonuçlarını ve oyuncu ratinglerini gösteren küçük bir masaüstü widget'ı.

Ekranın köşesinde küçük bir simge durur. Üzerine gelince panel açılır. Favori takımlarından biri maçtaysa skor simgenin üstünde görünür.

> **Durum: tarayıcı demosu.** Ekranlar tarayıcıda çalışıyor. Sonraki adım, uygulamayı Tauri ile gerçek bir Windows uygulamasına çevirmek (her zaman üstte duran şeffaf pencere ve tepsi simgesi).

## Özellikler

- **Favorilerim:** Her takım için canlı maç, sıradaki maç, son maç ve son 5 maçın formu (G/B/M)
- **Bugün:** Seçilen liglerde günün maçları, gün değiştirme ve "sadece canlı" filtresi
- **Takım:** Yaklaşan ve geçmiş maçlar; kadro ve oyuncuların sezon ortalama ratingi (lig/turnuva seçilebilir)
- **Maç:** Skor, canlı dakika, goller ve kırmızı kartlar, iki takımın kadrosu ve maç ratingleri, maçın oyuncusu
- **Ayarlar:** Takım arama, favori ekleme/sıralama, "Bugün" sekmesi için lig seçimi
- Açık ve koyu tema (sistem ayarını izler)

## Çalıştırma

Gereken: Windows ve Node.js 20+.

```sh
npm install
npm run dev
```

Ardından http://localhost:5180 adresini aç.

## Veri kaynağı

Veriler Sofascore'un herkese açık ama **resmi olarak belgelenmemiş** API'sinden gelir. Bu uygulama Sofascore ile bağlantılı değildir. API haber verilmeden değişebilir. Kişisel kullanım içindir.

Sofascore, tarayıcıdan ve Node/OpenSSL'den gelen istekleri engelliyor ama Windows'un kendi TLS katmanını (Schannel) kabul ediyor. Bu yüzden:

- **Geliştirme ortamında** Vite sunucusu `/sofa/*` isteklerini Windows'un `curl.exe` aracı üzerinden iletir ([dev/sofaProxy.ts](dev/sofaProxy.ts)) ve yanıtları kısa süreliğine önbelleğe alır.
- **Tauri sürümünde** aynı istekler Rust tarafından `native-tls` ile atılacak.

İstek sayısı düşük tutulur: favori takımın maçı yokken veriler 5 dakikada bir, maç sırasında 20 saniyede bir yenilenir.

## Teknoloji

Preact + TypeScript + Vite. Tauri'ye geçince arayüz kodu aynen kullanılacak.

```
src/
  api/        Sofascore istekleri ve tipler
  lib/        tarih/dakika biçimlendirme, ayarlar, veri çekme hook'u
  components/ maç satırı, logo, rating rozeti
  views/      Favorilerim, Bugün, Takım, Maç, Ayarlar
dev/          geliştirme proxy'si
```
