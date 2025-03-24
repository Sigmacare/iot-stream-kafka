const { storeConsumer } = require("../config/kafka");
const { writeApi, Point } = require("../config/influx");

const storeSensorData = async () => {
  await storeConsumer.subscribe({ topic: "sensor-data", fromBeginning: false });

  await storeConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        console.log("Processing sensor data:", data);

        const point = new Point(process.env.INFLUX_MEASUREMENT)
          .tag("deviceId", data.device_code)
          .floatField("accelX", data.accelX)
          .floatField("accelY", data.accelY)
          .floatField("accelZ", data.accelZ)
          .floatField("gyroX", data.gyroX)
          .floatField("gyroY", data.gyroY)
          .floatField("gyroZ", data.gyroZ)
          .floatField("heartRate", data.heartRate)
          .floatField("oxygen", data.oxygen)
          .timestamp(new Date());

        writeApi.writePoint(point);
        await writeApi.flush();
        console.log("Stored sensor data in InfluxDB");
      } catch (error) {
        console.error("Error writing to InfluxDB:", error);
      }
    },
  });
};

module.exports = storeSensorData;
