const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema({
  patientId: String,
  doctorId: String, // SHA-256 Hash of Doctor's ID
  doctorName: String, // Encrypted doctor name
  hospitalId: String,
  hospitalName: String, // Encrypted hospital name
  department: String, // Encrypted department
  appointmentId: { type: String, default: null },

  // Encrypted Fields (Format: iv:authTag:ciphertext)
  visitDate: String,
  visitType: String,

  chiefComplaint: String,
  complaintDuration: String,
  medicalHistory: String,
  disease: String, // Kept for backwards compatibility
  provisionalDiagnosis: String,
  finalDiagnosis: String,
  icdCode: String,
  reason: String,
  medicines: String,
  precautions: String,

  // Vitals and Clinical Data
  bloodPressure: String,
  heartRate: String,
  temperature: String,
  notes: String,

  // File Metadata (Partially Encrypted)
  file: {
    hasFile: { type: Boolean, default: false },
    encryptedOriginalName: String,
    mimeType: String,
    encryptedPath: String,
    fileKey: String,
    iv: String,
    authTag: String
  },

  // Record Master Key (RSA Encrypted)
  recordKey: String,

  hash: { type: String, default: null }, // Integrity Hash

  // Digital Signature Fields
  digitalSignature: { type: String, default: null },
  signedBy: { type: String, default: null },
  signedAt: { type: Date, default: null },

  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Record", RecordSchema);
