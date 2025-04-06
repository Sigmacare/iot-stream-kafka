const mqtt = require("mqtt");
const Alert = require("../models/Alert");
const { processingConsumer } = require("../config/kafka");
const { sendCallAlert } = require("../config/twilio");
require("dotenv").config();

// MQTT Client Configuration
const options = {
  host: process.env.HIVEMQ_HOST,
  port: 8883,
  protocol: 'mqtts',
  username: process.env.HIVEMQ_USER,
  password: process.env.HIVEMQ_PASSWORD,
};

// Initialize the MQTT client
const client = mqtt.connect(options);
client.on("connect", () => {
  console.log("Connected to HiveMQ Cloud via TLS");
});

// Detection Constants
const FALL_THRESHOLD = 2.5; // g-force threshold for impact
const FREE_FALL_THRESHOLD = 3; // g-force threshold for free-fall
const POST_FALL_INACTIVITY_PERIOD = 0; // ms of inactivity after fall
const IMPACT_WINDOW = 1000; // ms window between free-fall and impact

// Activity Detection Constants
const ACTIVITY_THRESHOLDS = {
  WALKING: {
    accelVariance: 1.2,
    gyroVariance: 0.5
  },
  RUNNING: {
    accelVariance: 1.8,
    gyroVariance: 0.8
  },
  STANDING: {
    accelVariance: 0.5,
    gyroVariance: 0.1,
    accelZ: [0.8, 1.2]
  },
  SITTING: {
    accelVariance: 0.3,
    gyroVariance: 0.2,
    accelZ: [0.6, 0.9]
  },
  LYING_DOWN: {
    accelVariance: 0.2,
    gyroVariance: 0.05,
    accelZ: [0.1, 0.3]
  },
  SLEEPING: {
    accelVariance: 0.1,
    gyroVariance: 0.02,
    duration: 300000 // 5 minutes
  }
};

// Device State Tracking Map
const deviceStates = new Map();

class DeviceState {
  constructor() {
    // Fall detection properties
    this.lastHighImpactTime = 0;
    this.lastActivityTime = 0;
    this.freeFallDetected = false;
    this.lastFreeFallTime = 0;

    // Activity detection properties
    this.lastStatus = '';
    this.activityBuffer = [];
    this.lastActiveTime = Date.now();
    this.statusChangeTime = Date.now();
  }
}

const detectActivity = (device_code, accelX, accelY, accelZ, gyroX, gyroY, gyroZ) => {
  if (!deviceStates.has(device_code)) {
    deviceStates.set(device_code, new DeviceState());
  }
  const state = deviceStates.get(device_code);

  // Calculate current sensor metrics
  const accelMagnitude = Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2);
  const gyroMagnitude = Math.sqrt(gyroX ** 2 + gyroY ** 2 + gyroZ ** 2);
  const accelVariance = Math.abs(accelMagnitude - 1.0); // Difference from 1g

  // Update activity buffer (last 10 readings)
  state.activityBuffer.push({
    accelVariance,
    gyroMagnitude,
    accelZ,
    timestamp: Date.now()
  });
  if (state.activityBuffer.length > 10) state.activityBuffer.shift();

  // Calculate averages over the buffer
  const avgValues = state.activityBuffer.reduce((acc, reading) => {
    acc.accelVariance += reading.accelVariance;
    acc.gyroMagnitude += reading.gyroMagnitude;
    acc.accelZ += reading.accelZ;
    return acc;
  }, { accelVariance: 0, gyroMagnitude: 0, accelZ: 0 });

  const avgAccelVariance = avgValues.accelVariance / state.activityBuffer.length;
  const avgGyro = avgValues.gyroMagnitude / state.activityBuffer.length;
  const avgAccelZ = avgValues.accelZ / state.activityBuffer.length;

  // Determine current activity state
  let currentStatus;
  const inactiveDuration = Date.now() - state.lastActiveTime;

  // 1. Check for running (highest priority)
  if (avgAccelVariance > ACTIVITY_THRESHOLDS.RUNNING.accelVariance &&
    avgGyro > ACTIVITY_THRESHOLDS.RUNNING.gyroVariance) {
    currentStatus = 'running';
  }
  // 2. Check for walking
  else if (avgAccelVariance > ACTIVITY_THRESHOLDS.WALKING.accelVariance &&
    avgGyro > ACTIVITY_THRESHOLDS.WALKING.gyroVariance) {
    currentStatus = 'walking';
  }
  // 3. Check for sleeping (requires prolonged inactivity)
  else if (avgAccelVariance < ACTIVITY_THRESHOLDS.SLEEPING.accelVariance &&
    avgGyro < ACTIVITY_THRESHOLDS.SLEEPING.gyroVariance &&
    inactiveDuration > ACTIVITY_THRESHOLDS.SLEEPING.duration) {
    currentStatus = 'sleeping';
  }
  // 4. Check standing position
  else if (avgAccelZ > ACTIVITY_THRESHOLDS.STANDING.accelZ[0] &&
    avgAccelZ < ACTIVITY_THRESHOLDS.STANDING.accelZ[1] &&
    avgAccelVariance < ACTIVITY_THRESHOLDS.STANDING.accelVariance) {
    currentStatus = 'standing';
  }
  // 5. Check sitting position
  else if (avgAccelZ > ACTIVITY_THRESHOLDS.SITTING.accelZ[0] &&
    avgAccelZ < ACTIVITY_THRESHOLDS.SITTING.accelZ[1] &&
    avgAccelVariance < ACTIVITY_THRESHOLDS.SITTING.accelVariance) {
    currentStatus = 'sitting';
  }
  // 6. Lying down detection
  else if (avgAccelZ < ACTIVITY_THRESHOLDS.LYING_DOWN.accelZ[1] &&
    avgAccelVariance < ACTIVITY_THRESHOLDS.LYING_DOWN.accelVariance) {
    currentStatus = 'lying down';
  }
  // Default to previous state if unclear
  else {
    currentStatus = state.lastStatus || 'unknown';
  }

  // Update last active time if significant movement detected
  if (avgGyro > 0.3 || avgAccelVariance > 0.5) {
    state.lastActiveTime = Date.now();
  }

  // Log status changes
  if (currentStatus !== state.lastStatus) {
    const duration = (Date.now() - state.statusChangeTime) / 1000;
    console.log(`[${device_code}] Status: ${currentStatus.toUpperCase()} (was ${state.lastStatus || 'unknown'} for ${duration.toFixed(1)}s)`);
    console.debug('Sensor averages:', {
      accelVariance: avgAccelVariance.toFixed(3),
      gyro: avgGyro.toFixed(3),
      accelZ: avgAccelZ.toFixed(3),
      inactive: (inactiveDuration / 1000).toFixed(1) + 's'
    });

    state.lastStatus = currentStatus;
    state.statusChangeTime = Date.now();
  }

  return currentStatus;
};

const detectFall = (device_code, accelX, accelY, accelZ, timestamp) => {

  if (!deviceStates.has(device_code)) {
    deviceStates.set(device_code, new DeviceState());
  }
  const state = deviceStates.get(device_code);

  const accelerationMagnitude = Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2);

  console.log("Acceleration Magnitude:", accelerationMagnitude.toFixed(2), "g");

  // Free fall detection (values near 0g)
  if (accelerationMagnitude < FREE_FALL_THRESHOLD) {
    console.log("Free fall detected for device:", device_code);
    state.freeFallDetected = true;
    state.lastFreeFallTime = timestamp;
    return false;
  }

  // High impact detection (sudden deceleration)
  if (accelerationMagnitude > FALL_THRESHOLD) {
    state.lastHighImpactTime = timestamp;

    if (state.freeFallDetected && (timestamp - state.lastFreeFallTime) < IMPACT_WINDOW) {
      console.log("Fall detected for device:", device_code);
      state.freeFallDetected = false;
      return true;
    }
  }

  // Check for post-fall inactivity
  if (state.lastHighImpactTime > 0 &&
    (timestamp - state.lastHighImpactTime) > POST_FALL_INACTIVITY_PERIOD &&
    accelerationMagnitude < 1.2) {
    state.lastHighImpactTime = 0;
    return true;
  }

  // Reset free fall detection if no impact follows
  if (state.freeFallDetected && (timestamp - state.lastActivityTime) > 1000) {
    state.freeFallDetected = false;
  }

  state.lastActivityTime = timestamp;
  return false;
};

const processSensorData = async () => {
  await processingConsumer.subscribe({ topic: "sigma-band-data", fromBeginning: false });

  await processingConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        // console.debug("Raw sensor data:", data);

        // Detect and log current activity status
        // detectActivity(
        //   data.device_code,
        //   data.accelX, data.accelY, data.accelZ,
        //   data.gyroX || 0, data.gyroY || 0, data.gyroZ || 0
        // );

        // Check for existing unresolved alert
        let alert = await Alert.findOne({
          device_code: data.device_code,
          resolved: false,
        });

        // Fall detection
        const isFall = detectFall(
          data.device_code,
          data.accelX,
          data.accelY,
          data.accelZ,
          Date.now()
        );

        // Emergency conditions
        const isEmergency = isFall

        // Create new alert if emergency detected
        if (!alert && isEmergency) {
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

        // Fall detection alert
        if (isFall && !alert?.alertType.includes("Fall Detected")) {
          console.log("Fall detected for device:", data.device_code);
          alert = alert || new Alert({
            device_code: data.device_code,
            alertType: [],
            alertData: data,
            resolved: false,
            timestamp: new Date(),
          });

          alert.alertType.push("Fall Detected");
          alert.alertData = data;
          alert.timestamp = new Date();
          client.publish("alerts/fall", JSON.stringify(alert));
          modified = true;
        }

        // Abnormal heart rate detection
        if ((data.heartRate > 120 || data.heartRate < 40) && !alert?.alertType.includes("Abnormal Heart Rate")) {
          alert = alert || new Alert({
            device_code: data.device_code,
            alertType: [],
            alertData: data,
            resolved: false,
            timestamp: new Date(),
          });

          alert.alertType.push("Abnormal Heart Rate");
          alert.alertData = data;
          alert.timestamp = new Date();
          client.publish("alerts/heartRate", JSON.stringify(alert));
          modified = true;
        }

        // Low oxygen level detection
        if (data.oxygen < 90 && !alert?.alertType.includes("Low Oxygen Level")) {
          alert = alert || new Alert({
            device_code: data.device_code,
            alertType: [],
            alertData: data,
            resolved: false,
            timestamp: new Date(),
          });

          alert.alertType.push("Low Oxygen Level");
          alert.alertData = data;
          alert.timestamp = new Date();
          client.publish("alerts/oxygen", JSON.stringify(alert));
          modified = true;
        }

        if (modified) {
          await alert.save();
          console.log("Alert saved and published for device:", data.device_code);
        }

      } catch (error) {
        console.error("Error processing sensor data:", error);
      }
    },
  });
};

// Clean up device states periodically
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 60000; // 1 minute

  for (const [device_code, state] of deviceStates) {
    if (now - state.lastActivityTime > staleThreshold) {
      deviceStates.delete(device_code);
      console.log(`Cleaned up stale device state: ${device_code}`);
    }
  }
}, 30000); // Run every 30 seconds

module.exports = processSensorData;