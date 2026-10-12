require("dotenv").config();

const mongoose = require("mongoose");
const Pazar = require("../models/Pazar");

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI tanımlanmalı.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: Number(process.env.DB_TIMEOUT_MS) || 10000,
  });

  const result = await Pazar.collection.updateMany(
    {
      "konum.lat": { $type: "number", $gte: -90, $lte: 90 },
      "konum.lng": { $type: "number", $gte: -180, $lte: 180 },
    },
    [
      {
        $set: {
          location: {
            type: "Point",
            coordinates: ["$konum.lng", "$konum.lat"],
          },
        },
      },
    ],
  );

  await Pazar.createIndexes();
  console.log(
    JSON.stringify({
      matched: result.matchedCount,
      geojsonUpdated: result.modifiedCount,
      indexesReady: true,
    }),
  );
}

main()
  .catch((error) => {
    console.error("GeoJSON migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
