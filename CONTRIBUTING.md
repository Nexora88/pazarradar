# Katkı Rehberi

Pazar Radar'a katkı verdiğin için teşekkürler! Bu rehber, hata düzeltmelerinin ve yeni özelliklerin tutarlı ilerlemesi için hazırlanmıştır.

## Geliştirme ortamı

1. Depoyu fork edip klonla.
2. Node.js 20+ ve npm kur.
3. `npm ci` komutunu çalıştır.
4. `.env.example` dosyasını `.env` olarak kopyala; çalışan MongoDB adresini ve en az 32 karakterlik rastgele `JWT_SECRET` değerini ayarla.
5. `npm run dev` ile uygulamayı başlat.

## Çalışma akışı

- Her iş için açıklayıcı branch aç: `feat/nearby-markets`, `fix/mongo-connection`, `docs/contributing`.
- Değişikliği küçük, tek amaca odaklı commit'lere böl.
- Mevcut API sözleşmelerini ve Türkçe arayüzü koru.
- Gerçek kullanıcı verisi, parola, token, `.env` veya API anahtarı commit etme.
- Örnek verileri canlı/gerçek veri olarak sunma.
- API girişlerini sunucu tarafında doğrula; rol kontrollerini yalnızca arayüzde bırakma.
- Yeni endpoint'ler için test, dokümantasyon ve gerekiyorsa indeks ekle.

## Kontroller

```bash
npm test
npm run lint
npm run format:check
git diff --check
```

MongoDB kullanan entegrasyon testleri için yerel/test veritabanı kullan; üretim veritabanında test çalıştırma.

## Commit ve Pull Request

Commit mesajları kısa ve eylem odaklı olsun; ör. `fix: validate market coordinates`. PR açıklamasında amaç, değişiklikler, test çıktısı, API/şema etkisi ve ekran görüntüsü (UI değiştiyse) bulunmalı. Güvenlik açığını herkese açık issue olarak paylaşma; önce depo sahibine özel bildir.
