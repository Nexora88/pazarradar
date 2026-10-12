const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Pazar = require("../models/Pazar");
const Tezgah = require("../models/Tezgah");
const User = require("../models/User");
const { app } = require("../server");

test(
  "API entegrasyonu: pazar arama, yakın pazar, etiket filtresi ve fiyat oylaması",
  { skip: process.env.RUN_DB_INTEGRATION !== "true" },
  async () => {
    assert.ok(process.env.MONGO_URI, "MONGO_URI must point to a dedicated test database");
    assert.ok(process.env.JWT_SECRET?.length >= 32, "JWT_SECRET must be set for integration tests");
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    await Pazar.syncIndexes();

    const suffix = `ci-${Date.now()}`;
    let market;
    let user;
    let stall;
    let server;

    try {
      market = await Pazar.create({
        ad: `Test Pazarı ${suffix}`,
        ilce: "Kadıköy",
        adres: "Entegrasyon test adresi",
        gunler: ["Cumartesi"],
        konum: { lat: 41.0082, lng: 29.028 },
        etiketler: ["organik"],
      });
      user = await User.create({
        username: suffix,
        email: `${suffix}@example.invalid`,
        password: await bcrypt.hash("integration-test-password", 10),
      });
      stall = await Tezgah.create({
        pazar: market._id,
        esnaf: user._id,
        tezgahAdi: `Test Tezgâhı ${suffix}`,
        urunler: [
          {
            isim: "Domates",
            birim: "kg",
            guncelFiyat: 30,
            fiyatGecmisi: [{ fiyat: 30 }],
          },
        ],
      });
      server = app.listen(0);
      const address = server.address();
      const base = `http://127.0.0.1:${address.port}`;

      const listResponse = await fetch(`${base}/api/pazar?search=${encodeURIComponent(suffix)}`);
      assert.equal(listResponse.status, 200);
      const listBody = await listResponse.json();
      assert.ok(listBody.data.some((item) => String(item._id) === String(market._id)));

      const tagResponse = await fetch(
        `${base}/api/pazar?etiket=organik&search=${encodeURIComponent(suffix)}`,
      );
      assert.equal(tagResponse.status, 200);
      assert.ok(
        (await tagResponse.json()).data.some((item) => String(item._id) === String(market._id)),
      );

      const nearbyResponse = await fetch(
        `${base}/api/pazar/yakin?lat=41.0082&lng=29.028&radius=1000`,
      );
      assert.equal(nearbyResponse.status, 200);
      const nearbyBody = await nearbyResponse.json();
      assert.ok(nearbyBody.data.some((item) => String(item._id) === String(market._id)));

      const invalidResponse = await fetch(`${base}/api/pazar/yakin?lat=999&lng=29`);
      assert.equal(invalidResponse.status, 400);

      const token = jwt.sign(
        { id: String(user._id), username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "5m", issuer: "pazar-radar" },
      );
      const productId = stall.urunler[0]._id;
      const voteUrl = `${base}/api/tezgah/${stall._id}/urun/${productId}/oy`;
      const vote = (oy) =>
        fetch(voteUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ oy }),
        });

      const correctVote = await vote("dogru");
      assert.equal(correctVote.status, 200);
      assert.equal((await User.findById(user._id)).dogruFiyatOyuSayisi, 1);

      const changedVote = await vote("hatali");
      assert.equal(changedVote.status, 200);
      assert.equal((await User.findById(user._id)).dogruFiyatOyuSayisi, 0);
      const persistedStall = await Tezgah.findById(stall._id);
      assert.equal(persistedStall.urunler[0].oylar.length, 1);
      assert.equal(persistedStall.urunler[0].oylar[0].oy, "hatali");
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      if (stall) await Tezgah.deleteOne({ _id: stall._id });
      if (user) await User.deleteOne({ _id: user._id });
      if (market) await Pazar.deleteOne({ _id: market._id });
      await mongoose.disconnect();
    }
  },
);
