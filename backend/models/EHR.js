const mongoose = require("mongoose");

const ehrSchema = new mongoose.Schema({
  patientId: String,
  record: String,
  recordHash: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("EHR", ehrSchema);
