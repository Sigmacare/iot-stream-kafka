const mqtt = require("mqtt");
const Alert = require("../models/Alert");
const { processingConsumer } = require("../config/kafka");
const { sendCallAlert } = require("../config/twilio");
require("dotenv").config();

var options = {
  host: process.env.HIVEMQ_HOST,
  port: 8883,
  protocol: 'mqtts',
  username: process.env.HIVEMQ_USER,
  password: process.env.HIVEMQ_PASSWORD,
}

// initialize the MQTT client
var client = mqtt.connect(options);

client.on("connect", () => {
  console.log("Connected to HiveMQ Cloud via TLS");
});

const processSensorData  = async () => {
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

        if (!alert && (data.accelZ < -9.8 || data.heartRate > 120 || data.heartRate < 40 || data.oxygen < 90)) {
          sendCallAlert(process.env.EMERGENCY_CONTACT);
          alert = new Alert({
            device_code: data.device_code,
            alertType: [],
            alertData: data,
            resolved: false,
            timestamp: new Date(),
          });
        }

        let modified = false;

        // Fall detection
        if (data.accelZ < -9.8 && !alert.alertType.includes("Fall Detected")) {
          alert.alertType.push("Fall Detected");
          alert.alertData = data;
          alert.timestamp = new Date();
          client.publish("alerts/fall", JSON.stringify(alert));
          modified = true;
        }

        // Abnormal heart rate detection
        if ((data.heartRate > 120 || data.heartRate < 40) && !alert.alertType.includes("Abnormal Heart Rate")) {
          alert.alertType.push("Abnormal Heart Rate");
          alert.alertData = data;
          alert.timestamp = new Date();
          client.publish("alerts/heartRate", JSON.stringify(alert));
          modified = true;
        }

        // Low oxygen level detection
        if (data.oxygen < 90 && !alert.alertType.includes("Low Oxygen Level")) {
          alert.alertType.push("Low Oxygen Level");
          alert.alertData = data;
          alert.timestamp = new Date();
          client.publish("alerts/oxygen", JSON.stringify(alert));
          modified = true;
        }

        if (modified) {
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