const mongoose = require('mongoose');
const Record = require('./models/Record');

// Use 127.0.0.1 as in db.js
const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function run() {
  try {
    console.log("Connecting to MongoDB at", MONGO_URI, "...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    const count = await Record.countDocuments();
    console.log(`\nFound ${count} records in the database.\n`);

    if (count === 0) {
      console.log("No records found. Please add a record via the Doctor Dashboard first.");
    } else {
      const records = await Record.find().limit(3);

      records.forEach((rec, index) => {
        console.log(`--- Record #${index + 1} (ID: ${rec._id}) ---`);
        console.log("Patient ID:      ", rec.patientId);
        console.log("Timestamp:       ", rec.timestamp);
        console.log("Encrypted Data:  ", rec.encryptedData ? (rec.encryptedData.substring(0, 50) + "...") : "N/A");
        console.log("Encrypted AES Key:", rec.encryptedAesKey ? (rec.encryptedAesKey.substring(0, 30) + "...") : "N/A");
        console.log("IV:              ", rec.iv);
        console.log("Auth Tag:        ", rec.authTag);
        console.log("Integrity Hash:  ", rec.hash);
        console.log("--------------------------------------------------\n");
      });

      console.log("NOTE: The 'Encrypted Data' and 'Encrypted AES Key' fields contain the actual ciphertext.");
      console.log("Without the RSA Private Key and the AES algorithm, this data is unreadable.");
    }

  } catch (err) {
    console.error("Script Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
