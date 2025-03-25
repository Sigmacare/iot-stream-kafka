const mqtt = require("mqtt");
const Alert = require("../models/Alert");
const { processingConsumer } = require("../config/kafka");
const { sendCallAlert } = require("../config/twilio");
const Patient = require("../models/Patient");
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

const processSensorData = async () => {
  await processingConsumer.subscribe({ topic: "sigma-band-data", fromBeginning: false });
  // In-memory storage
  const alerts = new Map(); // device_code -> alert document
  const deviceStates = new Map(); // device_code -> { sensorHistory, conditionTimes }

  // Threshold configuration
  const getThresholds = (userAge) => ({
    MAX_HR: 220 - (userAge || 50), // Default to 50yo if unknown
    MIN_HR: 40,
    SPO2: 90,
    FALL_IMPACT: 2.5 * 9.8,
    FALL_INACTIVITY: 0.8 * 9.8
  });

  // Sensor data processing
  const updateDeviceState = (deviceCode, data) => {
    const state = deviceStates.get(deviceCode) || {
      sensorHistory: [],
      conditionTimes: {}
    };

    // Add new entry and maintain 30-second window
    state.sensorHistory = [
      ...state.sensorHistory.filter(({ timestamp }) =>
        Date.now() - timestamp < 30000
      ),
      { timestamp: Date.now(), ...data }
    ];

    deviceStates.set(deviceCode, state);
    return state;
  };

  // Fall detection logic
  const checkFall = (deviceCode) => {
    const state = deviceStates.get(deviceCode);
    if (!state) return false;

    const currentAccel = state.sensorHistory.slice(-1)[0];
    const accelMag = Math.sqrt(
      currentAccel.accelX ** 2 +
      currentAccel.accelY ** 2 +
      currentAccel.accelZ ** 2
    );

    // Impact detection
    if (accelMag > getThresholds().FALL_IMPACT && !state.conditionTimes.fallImpact) {
      state.conditionTimes.fallImpact = Date.now();
      return false; // Wait for confirmation
    }

    // Post-impact verification
    if (state.conditionTimes.fallImpact) {
      const impactDuration = Date.now() - state.conditionTimes.fallImpact;
      const recentMovement = state.sensorHistory
        .slice(-10) // Last 10 readings
        .every(entry =>
          Math.sqrt(entry.accelX ** 2 + entry.accelY ** 2 + entry.accelZ ** 2) <
          getThresholds().FALL_INACTIVITY
        );

      if (impactDuration > 10000 && recentMovement) {
        delete state.conditionTimes.fallImpact;
        return true;
      }
    }
    return false;
  };

  // Heart rate analysis
  const checkHeartRate = (deviceCode) => {
    const state = deviceStates.get(deviceCode);
    if (!state) return false;

    const hrReadings = state.sensorHistory
      .filter(({ timestamp }) => Date.now() - timestamp < 30000)
      .map(entry => entry.heartRate);

    if (hrReadings.length < 5) return false; // Need minimum readings

    const abnormal = hrReadings.filter(hr =>
      hr > getThresholds().MAX_HR || hr < getThresholds().MIN_HR
    );
    return abnormal.length / hrReadings.length > 0.7; // 70% abnormal
  };

  // Oxygen analysis
  const checkOxygen = (deviceCode) => {
    const state = deviceStates.get(deviceCode);
    if (!state) return false;

    const spo2Readings = state.sensorHistory
      .filter(({ timestamp }) => Date.now() - timestamp < 10000)
      .map(entry => entry.oxygen);

    return spo2Readings.length > 3 &&
      Math.min(...spo2Readings) < getThresholds().SPO2;
  };

  // Main processing function
  const processData = (data, userAge) => {
    const existingAlert = alerts.get(data.device_code);
    const thresholds = getThresholds(userAge);

    // Update device state with new data
    updateDeviceState(data.device_code, {
      accelX: data.accelX,
      accelY: data.accelY,
      accelZ: data.accelZ,
      heartRate: data.heartRate,
      oxygen: data.oxygen
    });

    // Check conditions
    const conditions = {
      fall: checkFall(data.device_code),
      abnormalHR: checkHeartRate(data.device_code),
      lowOxygen: checkOxygen(data.device_code)
    };

    // Determine if we need to create/update alert
    let alertUpdated = false;
    const newAlertTypes = [];

    if (!existingAlert) {
      // New alert creation
      const alertTypes = [];
      if (conditions.fall) alertTypes.push("Fall Detected");
      if (conditions.abnormalHR) alertTypes.push("Abnormal Heart Rate");
      if (conditions.lowOxygen) alertTypes.push("Low Oxygen Level");

      if (alertTypes.length > 0) {
        alerts.set(data.device_code, {
          device_code: data.device_code,
          alertType: alertTypes,
          alertData: data,
          resolved: false,
          timestamp: new Date()
        });
        sendCallAlert(process.env.EMERGENCY_CONTACT);
        alertUpdated = true;
        newAlertTypes.push(...alertTypes);
      }
    } else {
      // Existing alert update
      const updatedTypes = [...existingAlert.alertType];

<<<<<<< Updated upstream
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
=======
      if (conditions.fall && !updatedTypes.includes("Fall Detected")) {
        updatedTypes.push("Fall Detected");
        newAlertTypes.push("Fall Detected");
      }
      if (conditions.abnormalHR && !updatedTypes.includes("Abnormal Heart Rate")) {
        updatedTypes.push("Abnormal Heart Rate");
        newAlertTypes.push("Abnormal Heart Rate");
      }
      if (conditions.lowOxygen && !updatedTypes.includes("Low Oxygen Level")) {
        updatedTypes.push("Low Oxygen Level");
        newAlertTypes.push("Low Oxygen Level");
      }

      if (newAlertTypes.length > 0) {
        alerts.set(data.device_code, {
          ...existingAlert,
          alertType: updatedTypes,
          alertData: data,
          timestamp: new Date()
        });
        alertUpdated = true;
      }
    }

    // Publish new alerts
    if (alertUpdated) {
      const alert = alerts.get(data.device_code);
      newAlertTypes.forEach(type => {
        const channel = `alerts/${type.toLowerCase().replace(/ /g, '_')}`;
        client.publish(channel, JSON.stringify(alert));
      });
    }
  };
>>>>>>> Stashed changes

      // Consumer implementation
      await processingConsumer.run({
        eachMessage: async ({ message }) => {
          try {
            const data = JSON.parse(message.value.toString());
            const user = await Patient.findOne({ device_code: data.device_code });
            processData(data, user?.age);
          } catch (error) {
            console.error("Processing error:", error);
          }
        }
      });
    };

    module.exports = processSensorData;