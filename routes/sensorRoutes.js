const express = require("express");
const router = express.Router();
const { producer } = require("../config/kafka");
const authenticateDevice = require("../middleware/authenticateDevice");
const mqtt = require("mqtt");

// MQTT Client Configuration
const options = {
  host: process.env.HIVEMQ_HOST_SENSOR_DATA,
  port: 8883,
  protocol: 'mqtts',
  username: process.env.HIVEMQ_USER,
  password: process.env.HIVEMQ_PASSWORD,
};

// Initialize the MQTT client
const client = mqtt.connect(options);

client.on("connect", () => {
  console.log("Connected to HiveMQ Sensor Data Cloud via TLS");
  client.subscribe("esp32/test", (err) => {
    if (err) {
      console.error("Failed to subscribe to topic esp32/test:", err);
    } else {
      console.log("Subscribed to topic esp32/test");
    }
  });
});

client.on("message", async (topic, message) => {
  if (topic === "esp32/test") {
    try {
      const { device_code, accelX, accelY, accelZ, gyroX, gyroY, gyroZ, heartRate, oxygen } = JSON.parse(message.toString());
      const longitude = 76.328437;
      const latitude = 10.028688;

      const sensorData = {
        device_code,
        accelX,
        accelY,
        accelZ,
        gyroX,
        gyroY,
        gyroZ,
        heartRate,
        oxygen,
        device_location: { latitude, longitude },
      };
      // Send data to Kafka topic
      await producer.send({
        topic: "sigma-band-data",
        messages: [{ value: JSON.stringify(sensorData) }],
      });


    } catch (error) {
      console.error("Error processing MQTT message:", error);
    }
  }
});

// POST /api/sensor
// Receive sensor data from device
// Access: Protected (only devices with a valid token can send data)
// router.post("/", authenticateDevice, async (req, res) => {
//   try {
//     const longitude = 76.328437;
//     const latitude = 10.028688;

//     const { device_code, accelX, accelY, accelZ, gyroX, gyroY, gyroZ, heartRate, oxygen } = req.body;

//     req.body = {
//       device_code,
//       accelX,
//       accelY,
//       accelZ,
//       gyroX,
//       gyroY,
//       gyroZ,
//       heartRate,
//       oxygen,
//       device_location: { latitude, longitude },
//     };

//     if (!device_code || accelX === undefined || accelY === undefined || accelZ === undefined || gyroX === undefined || gyroY === undefined || gyroZ === undefined || heartRate === undefined || oxygen === undefined) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     // Send data to Kafka topic
//     await producer.send({
//       topic: "sigma-band-data",
//       messages: [{ value: JSON.stringify(req.body) }],
//     });

//     res.status(202).json({ message: "Data received & queued for processing" });
//   } catch (error) {
//     console.error("Error receiving sensor data:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

module.exports = router;
