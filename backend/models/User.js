const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  userIdHash: { type: String, required: true, unique: true }, // [NEW] SHA-256 Hash for Lookup
  userIdEnc: { type: String, required: true }, // [NEW] AES Encrypted for Recovery
  password: { type: String, required: true }, // Added password
  name: String,
  phone: String,
  role: { type: String, enum: ["patient", "doctor", "pharmacist"], required: true },

  // Hospital-Centric Updates
  hospitalId: { type: String, default: null }, // Linked hospitalId
  hospitalName: { type: String, default: null },
  department: { type: String, default: null },

  // Patient-Centric Tracking
  hospitalsVisited: [{
    hospitalId: String,
    hospitalName: String,
    doctorsConsulted: [{
      doctorId: String,
      doctorName: String,
      doctorSpecialization: String,
      visitDate: String,
      recordId: String
    }]
  }],

  gender: String,
  dob: String,
  bloodGroup: String,
  specialization: String, // e.g. MBBS, MD
  specialist: String, // e.g. Cardiologist (or Department)
  email: String,
  address: String,
  city: String,
  state: String,
  country: String,
  pincode: String,
  registrationNumber: String,
  experienceYears: Number,
  clinicName: String,
  shopName: String,
  workingHours: String,
  consultationFees: Number,
  license: String
});

module.exports = mongoose.model("User", UserSchema);
