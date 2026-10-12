# İstanbul pazar verisi

`istanbul-markets.json`, T.C. Ticaret Bakanlığı Hal Kayıt Sistemi'nin İstanbul pazar listesi üzerinden oluşturulan indirilebilir veri kopyasıdır.

- Kaynak: https://www.hal.gov.tr/Sayfalar/Pazar-Yerleri.aspx?sid=34
- Snapshot: otomatik güncellenir
- Alanlar: pazar adı, ilçe, semt, adres, kuruluş günleri ve kaynak bilgisi
- Kaynakta olmayan koordinatlar ve fiyatlar üretilmez.
- Pazar fiyatları resmî listeden gelmez; kullanıcı/esnaf tarafından paylaşılır ve doğrulanmalıdır.

Veriyi güncellemek için `npm run data:sync:istanbul`, ardından veritabanına aktarmak için `npm run data:seed` çalıştır.
