const mongoose = require("mongoose");

const AccessSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    type: { type: String, default: "regular" }, // regular or emergency
    expiresAt: { type: Date, default: null }, // for time-limited access
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Access", AccessSchema);
