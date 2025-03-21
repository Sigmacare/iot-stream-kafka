const express = require("express");
const router = express.Router();
const { producer } = require("../config/kafka");
const authenticateDevice = require("../middleware/authenticateDevice");


// POST /api/sensor
// Receive sensor data from device
// Access: Protected (only devices with a valid token can send data)
router.post("/",authenticateDevice,async (req, res) => {
  try {
    const { device_code, accelX, accelY, accelZ, gyroX, gyroY, gyroZ, heartRate, oxygen } = req.body;

    if (!device_code || accelX === undefined|| accelY ===undefined || accelZ==undefined || gyroX === undefined || gyroY === undefined || gyroZ ===undefined || heartRate === undefined || oxygen === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Send data to Kafka topic
    await producer.send({
      topic: "sensor-data",
      messages: [{ value: JSON.stringify(req.body) }],
    });

    res.status(202).json({ message: "Data received & queued for processing" });
  } catch (error) {
    console.error("Error receiving sensor data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
