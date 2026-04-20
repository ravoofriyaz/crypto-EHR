const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
    hospitalId: { type: String, required: true },
    hospitalName: { type: String, required: true },
    department: { type: String, required: true },
    doctorId: { type: String, required: true }, // SHA-256 Hash of Doctor ID
    doctorName: { type: String, required: true },
    patientId: { type: String, required: true }, // SHA-256 Hash of Patient ID
    patientName: { type: String, required: true },
    appointmentDate: { type: String, required: true }, // YYYY-MM-DD
    timeSlot: { type: String, required: true }, // e.g. "09:00 AM - 09:30 AM"
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", "Completed"],
        default: "Pending"
    },
    // Visit Code Feature
    visitCode: { type: String, default: null },
    visitCodeExpiry: { type: Date, default: null },
    visitCodeUsed: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Appointment", AppointmentSchema);
