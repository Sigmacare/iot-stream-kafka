const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  caretaker_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  medical_conditions: { type: [String], default: [] },
  device_id: { type: String} // ✅ Ensure it's NOT unique
}, { timestamps: true });

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
