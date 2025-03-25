const { processingConsumer } = require("../config/kafka");
const Alert = require("../models/Alert");

const processSensorData  = async () => {
  await processingConsumer.subscribe({ topic: "sigma-band-data", fromBeginning: false });

  await processingConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());

        // Fall detection logic (example)
        if (data.accelZ < -9.8) {
          const alert = new Alert({ device_code: data.device_code, alertType: "Fall Detected", timestamp: new Date() });
          await alert.save();
          console.log("Fall Alert Saved!");
        }

        // Abnormal heart rate detection
        if (data.heartRate > 120 || data.heartRate < 40) {
          const alert = new Alert({ device_code: data.device_code, alertType: "Abnormal Heart Rate", timestamp: new Date() });
          await alert.save();
          console.log("Heart Rate Alert Saved!");
        }

        // Low oxygen level detection
        if (data.oxygen < 90) {
          const alert = new Alert({ device_code: data.device_code, alertType: "Low Oxygen Level", timestamp: new Date() });
          await alert.save();
          console.log("Oxygen Alert Saved!");
        }

      } catch (error) {
        console.error("Error processing sensor data:", error);
      }
    },
  });
};

module.exports = processSensorData ;
