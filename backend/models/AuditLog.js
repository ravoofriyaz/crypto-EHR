const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    doctorId: { type: String, required: true },
    patientId: { type: String, required: true },
    action: { type: String, required: true }, // e.g., "Visit Verification", "Record View"
    hospitalId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String },
    details: { type: String }
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);
