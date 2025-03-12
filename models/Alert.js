const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  device_code: String,
  alertType: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Alert", alertSchema);
