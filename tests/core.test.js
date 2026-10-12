const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Pazar = require("../models/Pazar");
const Tezgah = require("../models/Tezgah");
const User = require("../models/User");

test("Pazar konumu GeoJSON Point biçimine çevrilir ve boylam önce gelir", async () => {
  const market = new Pazar({
    ad: "Test Pazarı",
    ilce: "Kadıköy",
    adres: "Test adresi",
    konum: { lat: 40.99, lng: 29.03 },
  });
  await market.validate();
  assert.deepEqual(market.location.toObject(), {
    type: "Point",
    coordinates: [29.03, 40.99],
  });
});

test("geçersiz koordinat kabul edilmez", async () => {
  const market = new Pazar({
    ad: "Test Pazarı",
    ilce: "Kadıköy",
    adres: "Test adresi",
    konum: { lat: 120, lng: 29.03 },
  });
  await assert.rejects(market.validate(), (error) => error.name === "ValidationError");
});

test("fiyat geçmişi ve fiyat doğrulama oyları ürün şemasında tutulur", async () => {
  const stall = new Tezgah({
    pazar: new mongoose.Types.ObjectId(),
    esnaf: new mongoose.Types.ObjectId(),
    tezgahAdi: "Test tezgâhı",
    urunler: [
      {
        isim: "Domates",
        birim: "kg",
        guncelFiyat: 35,
        fiyatGecmisi: [{ fiyat: 30 }, { fiyat: 35 }],
        oylar: [{ kullanici: new mongoose.Types.ObjectId(), oy: "dogru" }],
      },
    ],
  });
  await stall.validate();
  assert.equal(stall.urunler[0].fiyatGecmisi.length, 2);
  assert.equal(stall.urunler[0].oylar[0].oy, "dogru");
});

test("rol modeli denetçi rolünü ve topluluk rozetlerini destekler", async () => {
  const user = new User({
    username: "testuser",
    email: "test@example.invalid",
    password: "not-a-real-password",
    role: "denetci",
    rozetler: ["Fiyat Doğrulayıcı"],
  });
  await user.validate();
  assert.equal(user.role, "denetci");
  assert.ok(user.rozetler.includes("Fiyat Doğrulayıcı"));
});

test("uygulama sağlık ucu veritabanı bağlantısı yokken bile yanıt verir", async () => {
  const { app } = require("../server");
  const server = app.listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const body = await response.json();
    assert.ok([200, 503].includes(response.status));
    assert.equal(body.app, "Street Bazaars");
    assert.ok(
      ["connected", "disconnected", "connecting", "disconnecting", "unknown"].includes(
        body.database,
      ),
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
