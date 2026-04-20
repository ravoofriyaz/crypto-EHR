const mongoose = require("mongoose");

const HospitalSchema = new mongoose.Schema({
    hospitalId: { type: String, required: true, unique: true },
    hospitalName: { type: String, required: true },
    address: String,
    city: String,
    state: String,
    contactNumber: String,
    specializations: [String], // Array of specialization names
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Hospital", HospitalSchema);
