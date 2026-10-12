# Pazar Radar

İstanbul'un semt pazarlarını keşfetmek, pazar günlerini ve adreslerini görüntülemek, esnaf tezgâhlarındaki ürün fiyatlarını takip etmek için geliştirilen web uygulaması.

**Durum:** Temel arayüz ve API entegrasyonu geliştirildi. Gerçek veriler için MongoDB, kullanıcı girişi için JWT ve fotoğraf yüklemeleri için isteğe bağlı Cloudinary yapılandırması gerekir.

## Özellikler

- Koyu temalı, mobil ve masaüstü uyumlu Pazar Radar arayüzü
- Pazarları ada, ilçe, mahalle ve adrese göre arama
- İlçe ve pazar günü filtreleri; ada, puana veya ilçeye göre sıralama
- Pazar detayları, çalışma saatleri ve koordinat varsa harita bağlantısı
- Kullanıcı kaydı, oturum açma, profil görüntüleme ve parola değiştirme
- Kullanıcının pazar favorilerini kaydetmesi
- Esnaf tezgâhları, ürünler ve ürün fiyat geçmişi API'leri
- Tezgâh yorumları ve puan ortalaması
- Admin rolü ile pazar ekleme, güncelleme ve yayından kaldırma
- İsteğe bağlı Cloudinary görsel yükleme
- Helmet güvenlik başlıkları, istek sınırı, giriş doğrulama ve sunucu günlükleri
- /api/health ile sunucu/veritabanı sağlık kontrolü

## Gereksinimler

- Node.js 20 veya üzeri
- npm
- MongoDB (yerel veya MongoDB Atlas)
- Görsel yüklemek için isteğe bağlı Cloudinary hesabı

## Yerel kurulum

1. Depoyu klonlayın ve proje klasörüne girin:

   ```bash
   git clone https://github.com/Nexora88/pazarradar.git
   cd pazarradar
   ```

2. Bağımlılıkları kurun:

   ```bash
   npm install
   ```

3. Ortam dosyası oluşturun. Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS/Linux:

   ```bash
   cp .env.example .env
   ```

4. .env dosyasında MONGO_URI değerini çalışan MongoDB örneğinize göre ayarlayın. JWT_SECRET için en az 32 karakterli, benzersiz ve rastgele bir gizli değer kullanın. Gerçek anahtarları kaynak koduna veya GitHub'a eklemeyin.

5. Geliştirme sunucusunu başlatın:

   ```bash
   npm run dev
   ```

   Alternatif: npm start

6. Tarayıcıda http://localhost:3000 adresini açın. API sağlığını http://localhost:3000/api/health üzerinden kontrol edin.

## Ortam değişkenleri

| Değişken | Gerekli mi? | Açıklama |
| --- | --- | --- |
| PORT | Hayır | HTTP portu; varsayılan 3000 |
| MONGO_URI | Evet | MongoDB bağlantı adresi |
| JWT_SECRET | Evet | En az 32 karakterli imzalama anahtarı |
| JWT_EXPIRES_IN | Hayır | JWT süresi; varsayılan 7d |
| CORS_ORIGIN | Harici istemci için | İzinli origin adresleri; birden çok adres virgülle ayrılır |
| CLOUDINARY_CLOUD_NAME | Görsel yükleme için | Cloudinary bulut adı |
| CLOUDINARY_API_KEY | Görsel yükleme için | Cloudinary API anahtarı |
| CLOUDINARY_API_SECRET | Görsel yükleme için | Cloudinary gizli anahtarı |
| API_RATE_LIMIT | Hayır | IP başına 15 dakikadaki API istek sınırı |
| DB_TIMEOUT_MS | Hayır | MongoDB bağlantı zaman aşımı |
| LOG_LEVEL | Hayır | Winston günlük seviyesi |

## API özeti

Tüm API yanıtları JSON biçimindedir. Korumalı uç noktalarda Authorization: Bearer <token> başlığı gerekir.

### Sistem

| Metot | Uç nokta | Açıklama |
| --- | --- | --- |
| GET | /api/health | Sunucu ve MongoDB sağlık durumu |

### Kimlik doğrulama — /api/auth

| Metot | Uç nokta | Açıklama |
| --- | --- | --- |
| POST | /register | Hesap oluşturma: username, email, password |
| POST | /login | Oturum açma; JWT döndürür |
| GET | /me | Giriş yapan kullanıcı |
| PUT | /change-password | oldPassword ve newPassword ile parola değişimi |
| POST | /logout | İstemcinin token'ı silmesi için çıkış yanıtı |

### Pazarlar — /api/pazar

| Metot | Uç nokta | Açıklama |
| --- | --- | --- |
| GET | /?page=1&limit=20 | Aktif pazarlar |
| GET | /?ilce=Kadıköy&gun=Cuma&search=... | İlçe, gün ve metin filtreleri |
| GET | /populer/list | Puan ve yorum sayısına göre öne çıkanlar |
| GET | /favoriler/listem | Giriş yapan kullanıcının favorileri |
| GET | /:id | Pazar detayı |
| POST | / | Admin: pazar ekle |
| PUT | /:id | Admin: pazar bilgilerini güncelle |
| DELETE | /:id | Admin: pazarı silmeden yayından kaldır |
| POST | /:id/favori | Favoriye ekle/çıkar |

### Tezgâhlar — /api/tezgah

| Metot | Uç nokta | Açıklama |
| --- | --- | --- |
| GET | /?pazar=<id>&search=... | Aktif tezgâhlar |
| GET | /:id | Tezgâh ve pazar bilgisi |
| POST | / | Esnaf: tezgâh oluştur |
| POST | /:id/urun | Esnaf: ürünü ve ilk fiyatı ekle |
| PUT | /:tezgahId/urun/:urunId | Esnaf: fiyatı güncelle ve geçmişe ekle |
| GET | /:id/urun/:urunId/fiyatlar | Ürün fiyat geçmişi |
| POST | /:id/yorum | Giriş yapan kullanıcı: 1–5 puan ve yorum; günde en fazla 3 |
| GET | /:id/yorumlar | Tezgâh yorumları |
| DELETE | /:id | Sahibi/admin: tezgâhı yayından kaldır |

### Görsel yükleme — /api/upload

| Metot | Uç nokta | Açıklama |
| --- | --- | --- |
| POST | /profile | Kullanıcı profil fotoğrafı |
| POST | /tezgah | Tezgâh görseli |
| POST | /urun | Ürün görseli |

Görsel istekleri multipart/form-data içinde image alanını kullanır. JPG, PNG ve WEBP kabul edilir; dosya sınırı 5 MB'dır. Görsel uç noktaları için Cloudinary değişkenleri yapılandırılmalıdır.

## Roller

- **user:** pazarları görüntüleme, favori ekleme ve yorum yazma
- **esnaf:** kendi tezgâhını ve ürün/fiyat kayıtlarını yönetme
- **admin:** pazar kayıtlarını yönetme

Yeni kayıtlar güvenli biçimde user rolüyle oluşturulur. Esnaf/admin rolü yalnızca yetkili yönetici tarafından güvenli bir yönetim süreciyle atanmalıdır; istemciden gönderilen rol bilgisi kabul edilmez.

## Kontroller

```bash
npm test
npm run check
```

Bu komutlar JavaScript dosyalarının sözdizimini denetler. Gerçek API entegrasyon testi için çalışan MongoDB ve yapılandırılmış .env gerekir.

## Yayına alma

1. Node.js 20+ destekleyen bir Node.js servisi seçin.
2. MongoDB Atlas veya erişilebilir bir MongoDB sağlayıcısı hazırlayın.
3. Ortam değişkenlerini barındırma platformunun güvenli değişkenler bölümüne ekleyin; .env dosyasını yüklemeyin.
4. Build komutu gerekmez; başlangıç komutu npm start şeklindedir.
5. Sağlık kontrolü için /api/health yolunu kullanın.
6. Harici bir web istemcisi kullanılacaksa CORS_ORIGIN değişkenini gerçek alan adıyla sınırlandırın.
7. Cloudinary isteğe bağlıdır; anahtarlar yoksa görsel yükleme uç noktaları açık bir yapılandırma hatası döndürür.

## Veri doğruluğu

Pazar listesi ve fiyatlar veritabanındaki kayıtlar üzerinden gösterilir. Uygulama, veri yokken örnek pazarları veya doğrulanmamış fiyatları gerçekmiş gibi sunmaz. Fiyatlar kullanıcı/esnaf bildirimlerine dayanır; güncellik ve doğruluk teyidi gerektirir.

## Güvenlik notları

- .env, token'lar ve Cloudinary anahtarları Git'e eklenmemelidir.
- Üretimde HTTPS kullanın ve gizli anahtarları düzenli olarak yenileyin.
- MongoDB kullanıcı hesabına yalnızca gerekli veritabanı izinlerini verin.
- Gerçek kullanıcı verisiyle yayına almadan önce entegrasyon, yetkilendirme ve yedekleme kontrollerini tamamlayın.

## Lisans

MIT
