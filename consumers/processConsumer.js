const mqtt = require("mqtt");
const Alert = require("../models/Alert");
const { processingConsumer } = require("../config/kafka");
const { sendCallAlert } = require("../config/twilio");
require("dotenv").config();

const FALL_IMPACT_THRESHOLD = -11; // Adjust for impact detection
const FALL_INACTIVITY_THRESHOLD = 10000; // 10s inactivity after fall

var options = {
  host: process.env.HIVEMQ_HOST,
  port: 8883,
  protocol: 'mqtts',
  username: process.env.HIVEMQ_USER,
  password: process.env.HIVEMQ_PASSWORD,
};

var client = mqtt.connect(options);

client.on("connect", () => {
  console.log("Connected to HiveMQ Cloud via TLS");
});

const fallRecords = new Map(); // Track last movement timestamp

const processSensorData = async () => {
  await processingConsumer.subscribe({ topic: "sigma-band-data", fromBeginning: false });

  await processingConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        console.log("Processing sensor data:", data);

        let alert = await Alert.findOne({
          device_code: data.device_code,
          resolved: false,
        });

        if (!alert) {
          alert = new Alert({
            device_code: data.device_code,
            alertType: [],
            alertData: data,
            resolved: false,
            timestamp: new Date(),
          });
        }

        let modified = false;
        const currentTime = Date.now();

        // Fall detection: Impact followed by inactivity
        if (data.accelZ < FALL_IMPACT_THRESHOLD) {
          fallRecords.set(data.device_code, currentTime);
          console.log(`Possible fall detected for device ${data.device_code}, monitoring inactivity...`);
        }

        if (
          fallRecords.has(data.device_code) &&
          currentTime - fallRecords.get(data.device_code) > FALL_INACTIVITY_THRESHOLD &&
          !alert.alertType.includes("Fall Detected")
        ) {
          alert.alertType.push("Fall Detected");
          alert.alertData = data;
          alert.timestamp = new Date();
          client.publish("alerts/fall", JSON.stringify(alert));
          modified = true;
          sendCallAlert(process.env.EMERGENCY_CONTACT);
          console.log(`Fall confirmed for device ${data.device_code}`);
          fallRecords.delete(data.device_code);
        }

        // Abnormal heart rate detection
        if ((data.heartRate > 120 || data.heartRate < 40) && !alert.alertType.includes("Abnormal Heart Rate")) {
          alert.alertType.push("Abnormal Heart Rate");
          modified = true;
        }

        // Low oxygen level detection
        if (data.oxygen < 90 && !alert.alertType.includes("Low Oxygen Level")) {
          alert.alertType.push("Low Oxygen Level");
          modified = true;
        }

        if (modified) {
          alert.alertData = data;
          alert.timestamp = new Date();
          await alert.save();
          console.log("Alert Saved & Published!");
        }
      } catch (error) {
        console.error("Error processing sensor data:", error);
      }
    },
  });
};

module.exports = processSensorData;
