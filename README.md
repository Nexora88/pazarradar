# Street Bazaars

İstanbul semt pazarlarını keşfetmek, pazar günlerini ve adreslerini görmek, esnaf tezgâhlarındaki ürün fiyatlarını takip etmek ve toplulukla fiyatları doğrulamak için geliştirilen mobil uyumlu web uygulaması.

> **Veri doğruluğu:** Pazar ve fiyat listeleri veritabanındaki gerçek kayıtlardan beslenir. Veri yoksa uygulama örnek kayıtları gerçekmiş gibi göstermez. Harita yalnızca koordinatı kayıtlı pazarları işaretler.

## Özellikler

- Koyu yeşil, responsive masaüstü/mobil arayüzü
- Pazar adı, ilçe, mahalle, adres, gün, tür etiketi ve bugüne göre filtreleme
- Leaflet/OpenStreetMap haritası, pazar pinleri ve yol tarifi bağlantısı
- Kullanıcı açıkça izin verdiğinde konumuna göre en yakın pazarları bulma
- Kullanıcı kaydı, JWT oturumu, parola değiştirme ve favoriler
- Roller: `user`, `esnaf`, `denetci`, `admin`
- Tezgâh, ürün, fiyat geçmişi ve yorum API'leri
- Kullanıcı başına tek doğru/hatalı fiyat oyu; denetçi doğrulama durumu
- Topluluk rozetleri: **Fiyat Doğrulayıcı**, **Pazar Gurmesi**
- Cloudinary ile isteğe bağlı profil, tezgâh, ürün ve yorum görseli yükleme
- Helmet güvenlik başlıkları, API/auth rate limiting, Joi doğrulaması, Winston/Morgan logları
- MongoDB GeoJSON Point / 2dsphere ve arama indeksleri
- İsteğe bağlı Redis önbelleği
- PWA: yüklenebilir uygulama kabuğu ve daha önce görüntülenen herkese açık pazar/tezgâh yanıtlarının çevrimdışı önbelleği
- Test, ESLint, Prettier ve GitHub Actions CI
- İsteğe bağlı Render deploy workflow'u

## Gereksinimler

- Node.js 20 veya üzeri
- npm
- MongoDB 7+ (yerel servis veya MongoDB Atlas)
- Cloudinary yalnızca görsel yüklemek için
- Redis yalnızca Redis önbelleği kullanmak için

## Yerel kurulum (Windows, macOS ve Linux)

1. Depoyu klonla:

   ```bash
   git clone https://github.com/Nexora88/pazarradar.git
   cd pazarradar
   ```

2. Bağımlılıkları yükle:

   ```bash
   npm ci
   ```

3. Ortam dosyasını kopyala:

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS/Linux:

   ```bash
   cp .env.example .env
   ```

4. `.env` içinde `MONGO_URI` değerini çalışan MongoDB örneğine ayarla. Yerel MongoDB varsayılanı `mongodb://127.0.0.1:27017/pazar_radar` şeklindedir. Atlas için Atlas panelindeki **Connect → Drivers** bölümünden aldığın tam URI'yi kullan. Atlas kümesinin DNS/SRV kaydı çözümlenmiyorsa rastgele hostname üretme; Atlas panelindeki adresi ve ağ izinlerini doğrula.

5. `JWT_SECRET` için en az 32 karakterlik rastgele bir değer belirle. Örneğin Node.js ile:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

6. Geliştirme sunucusunu çalıştır:

   ```bash
   npm run dev
   ```

7. Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini aç. Sağlık kontrolü: [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Komutlar

| Komut                  | Açıklama                                                           |
| ---------------------- | ------------------------------------------------------------------ |
| `npm start`            | Üretim başlangıcı                                                  |
| `npm run dev`          | Node.js watch ile geliştirme                                       |
| `npm run migrate:geo`  | Eski konum kayıtlarını GeoJSON'a dönüştürür ve indeksleri hazırlar |
| `npm test`             | Sözdizimi, birim ve isteğe bağlı API entegrasyon testleri          |
| `npm run lint`         | ESLint                                                             |
| `npm run format`       | Prettier ile biçimlendirme                                         |
| `npm run format:check` | Biçim kontrolü                                                     |
| `npm run check`        | JavaScript sözdizimi kontrolü                                      |

API entegrasyon testini MongoDB üzerinde çalıştırmak için **yalnızca test veritabanı** kullan:

```powershell
$env:RUN_DB_INTEGRATION="true"
npm test
```

`RUN_DB_INTEGRATION` ayarı kapalıysa MongoDB kullanan API entegrasyon testi atlanır.

## Ortam değişkenleri

| Değişken                | Gerekli mi?         | Açıklama                                                                   |
| ----------------------- | ------------------- | -------------------------------------------------------------------------- |
| `PORT`                  | Hayır               | HTTP portu, varsayılan 3000                                                |
| `MONGO_URI`             | Evet                | MongoDB bağlantı adresi                                                    |
| `JWT_SECRET`            | Evet                | En az 32 karakterlik imzalama anahtarı                                     |
| `JWT_EXPIRES_IN`        | Hayır               | Token ömrü, varsayılan `7d`                                                |
| `CORS_ORIGIN`           | Harici istemci için | Virgülle ayrılmış izinli origin listesi                                    |
| `API_RATE_LIMIT`        | Hayır               | Genel API için IP başına 15 dakikalık limit, varsayılan 180                |
| `AUTH_RATE_LIMIT`       | Hayır               | Giriş/kayıt için IP başına 15 dakikalık limit, varsayılan 20               |
| `DB_TIMEOUT_MS`         | Hayır               | MongoDB seçim zaman aşımı                                                  |
| `LOG_LEVEL`             | Hayır               | Winston log seviyesi                                                       |
| `REDIS_URL`             | Hayır               | Tanımlanırsa herkese açık pazar listeleri için kısa süreli Redis önbelleği |
| `CLOUDINARY_CLOUD_NAME` | Görsel için         | Cloudinary bulut adı                                                       |
| `CLOUDINARY_API_KEY`    | Görsel için         | Cloudinary API anahtarı                                                    |
| `CLOUDINARY_API_SECRET` | Görsel için         | Cloudinary gizli anahtarı                                                  |

Gizli anahtarları Git'e ekleme. `.env` Git tarafından yok sayılır; yalnızca `.env.example` paylaşılır.

## API özeti

Tüm yanıtlar JSON'dur. Korumalı uç noktalarda `Authorization: Bearer <token>` gerekir.

### Sistem ve pazarlar — `/api`

| Metot  | Uç nokta                                     | Açıklama                                    |
| ------ | -------------------------------------------- | ------------------------------------------- |
| GET    | `/health`                                    | HTTP/DB sağlık durumu; DB hazır değilse 503 |
| GET    | `/pazar?page=1&limit=20`                     | Aktif pazarlar                              |
| GET    | `/pazar?ilce=Kadıköy&gun=Cuma&search=...`    | İlçe/gün/metin filtreleri                   |
| GET    | `/pazar?bugun=true&etiket=organik`           | Bugün kurulan veya etiketi eşleşen pazarlar |
| GET    | `/pazar/yakin?lat=41.0&lng=29.0&radius=5000` | En yakın 50 pazar, mesafe metre             |
| GET    | `/pazar/populer/list`                        | Öne çıkan pazarlar                          |
| GET    | `/pazar/favoriler/listem`                    | Giriş yapan kullanıcının favorileri         |
| GET    | `/pazar/:id`                                 | Pazar ayrıntısı                             |
| POST   | `/pazar`                                     | Admin: pazar oluştur                        |
| PUT    | `/pazar/:id`                                 | Admin: pazar güncelle                       |
| DELETE | `/pazar/:id`                                 | Admin: yayından kaldır                      |
| POST   | `/pazar/:id/favori`                          | Favoriye ekle/çıkar                         |

### Kimlik doğrulama — `/api/auth`

| Metot | Uç nokta           | Açıklama                                       |
| ----- | ------------------ | ---------------------------------------------- |
| POST  | `/register`        | `username`, `email`, `password` ile kayıt      |
| POST  | `/login`           | JWT ile giriş                                  |
| GET   | `/me`              | Giriş yapan kullanıcı ve rozetler              |
| PUT   | `/change-password` | Parola değiştir                                |
| PATCH | `/users/:id/role`  | Admin: rol ata; kişi kendi rolünü değiştiremez |
| POST  | `/logout`          | İstemcinin token'ı silmesi için yanıt          |

### Tezgâhlar — `/api/tezgah`

| Metot  | Uç nokta                     | Açıklama                                                           |
| ------ | ---------------------------- | ------------------------------------------------------------------ |
| GET    | `/?pazar=<id>&search=...`    | Aktif tezgâhlar                                                    |
| GET    | `/:id`                       | Tezgâh ve pazar bilgisi                                            |
| POST   | `/`                          | Esnaf: tezgâh oluştur                                              |
| POST   | `/:id/urun`                  | Esnaf: ürün ve ilk fiyatı ekle                                     |
| PUT    | `/:tezgahId/urun/:urunId`    | Esnaf: fiyat güncelle, geçmişe ekle                                |
| GET    | `/:id/urun/:urunId/fiyatlar` | Fiyat geçmişi                                                      |
| POST   | `/:id/urun/:urunId/oy`       | Giriş yapan kullanıcı: doğru/hatalı oyu                            |
| POST   | `/:id/urun/:urunId/denetle`  | Denetçi/admin: doğrulama durumunu güncelle                         |
| POST   | `/:id/yorum`                 | Giriş yapan kullanıcı: 1–5 puan, yorum ve en fazla 3 görsel URL'si |
| GET    | `/:id/yorumlar`              | Yorumlar ve puan ortalaması                                        |
| DELETE | `/:id`                       | Sahibi/admin: tezgâhı yayından kaldır                              |

### Görsel yükleme — `/api/upload`

`POST /profile`, `POST /tezgah`, `POST /urun` ve `POST /yorum` uç noktaları multipart/form-data içinde `image` alanını kabul eder. JPG, PNG ve WEBP kabul edilir; dosya sınırı 5 MB'dır. Cloudinary değişkenleri tanımlı değilse yükleme açık bir 503 yapılandırma hatası döndürür. Yorum kaydında yalnızca Cloudinary URL'leri kabul edilir.

## Roller ve ilk admin

- **user:** pazarları görüntüleme, favori ve yorum
- **esnaf:** kendi tezgâhı/ürün/fiyat kayıtları
- **denetci:** fiyat denetim durumunu yönetme
- **admin:** pazar kayıtlarını ve kullanıcı rollerini yönetme

Kayıt isteğinden rol yükseltmesi kabul edilmez. İlk admin hesabı, güvenilir yönetici tarafından veritabanında bir kez atanmalıdır; sonrasında admin `PATCH /api/auth/users/:id/role` ile rol atayabilir. Kimlik doğrulama middleware'i her korumalı istekte hesabın aktifliğini ve güncel rolünü veritabanından kontrol eder.

## CI/CD

GitHub Actions her push/PR'da testleri, lint ve format kontrolünü çalıştırır. CI, izole bir MongoDB hizmeti kullanarak pazar listeleme ve yakın pazar API entegrasyon testlerini de çalıştırır.

Render dağıtımı için Render Web Service'i depoya bağla, gereken ortam değişkenlerini Render paneline ekle ve GitHub'da:

1. Repository Secret `RENDER_DEPLOY_HOOK` oluştur.
2. Repository Variable `RENDER_DEPLOY_ENABLED=true` ayarla.

Bu bilgiler yoksa otomatik deploy çalışmaz. Hiçbir gizli anahtar depoya commit edilmemelidir.

## PWA, harita ve önbellek

- Service worker uygulama kabuğunu ve daha önce görüntülenen herkese açık pazar/tezgâh GET yanıtlarını saklar. Çevrimdışı veriler eski olabilir; çevrimdışı fiyatlar güncel kabul edilmemelidir.
- Harita yalnızca koordinatı kayıtlı pazarları gösterir. Konum izni isteğe bağlıdır; reddedilirse pazarlar normal arama ile kullanılabilir.
- Redis isteğe bağlıdır. `REDIS_URL` boşsa önbellek devre dışıdır ve uygulama MongoDB'den çalışır.
- Cloudinary isteğe bağlıdır; yerel geliştirmede görsel yüklemek için Cloudinary kimlik bilgileri gerekir.

## Katkı, issue ve lisans

- Geliştirme standartları: [CONTRIBUTING.md](CONTRIBUTING.md)
- Hata/özellik formları: `.github/ISSUE_TEMPLATE/`
- MIT lisansı: [LICENSE](LICENSE)

## Güvenlik notları

- Üretimde HTTPS kullan; JWT ve DB parolalarını düzenli yenile.
- MongoDB hesabına yalnızca gerekli veritabanı izinlerini ver.
- Üretim veritabanında test çalıştırma; CI ve entegrasyon testleri için ayrı bir test veritabanı kullan.
- Pazar ve fiyatlar topluluk/esnaf bildirimlerine dayanır; oy sayısı tek başına resmi doğrulama anlamına gelmez.

## İstanbul veri paketi

İlk bölge yalnızca İstanbul'dur. Resmî T.C. Ticaret Bakanlığı Hal Kayıt Sistemi listesinden 538 pazar kaydı içeren `data/istanbul-markets.json` snapshot'ı oluşturulur. Ad, ilçe, semt, adres ve kuruluş günleri kaynak kayıtlarından alınır. Kaynakta bulunmayan koordinatlar ve ürün fiyatları uydurulmaz.

- Kaynak: https://www.hal.gov.tr/Sayfalar/Pazar-Yerleri.aspx?sid=34
- `npm run data:sync:istanbul`: Resmî kaynaktan snapshot'ı yeniler (internet gerekir).
- `npm run data:seed`: Snapshot'ı MongoDB'ye aktarır (harici kaynak bağlantısı gerektirmez).
- GitHub Actions veri iş akışı push sonrasında ve haftalık olarak snapshot'ı yeniler.

## Docker ile hızlı başlangıç

1. `.env.example` dosyasını `.env` olarak kopyala ve `JWT_SECRET` değerini rastgele, uzun bir değerle değiştir.
2. Windows'ta `start-street-bazaars.bat` dosyasını çalıştır veya terminalde `docker compose up --build -d` komutunu kullan.
3. `http://localhost:3000` adresini aç. Docker Compose MongoDB'yi başlatır, verileri yerel snapshot'tan yükler ve veritabanını kalıcı volume'da saklar.
4. Durdurmak için `docker compose down`; verileri de silmek için ayrıca volume silme işlemi gerekir.

## İndirilebilir paket

Kaynak kodu GitHub deposunda **Code → Download ZIP** yoluyla indirebilirsin. CI iş akışı ayrıca Actions sayfasında indirilebilir `street-bazaars-source` ZIP çıktısı üretir. Uygulama PWA olarak desteklenen tarayıcılarda yüklenebilir.
