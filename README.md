# **IoT-Stream-Kafka**  
**Real-time IoT Sensor Data Processing & Storage using Kafka, InfluxDB, and MongoDB**  

## **📌 Overview**  
**IoT-Stream-Kafka** is a microservice-based application designed to handle real-time sensor data ingestion, processing, and storage. It leverages **Apache Kafka** for high-throughput data streaming, **InfluxDB** for fast time-series storage, and **MongoDB** for storing processed alerts.

## **🔧 Tech Stack**  
- **Backend:** Node.js (Express.js)  
- **Streaming:** Kafka (KafkaJS)  
- **Database:** InfluxDB (Sensor Data), MongoDB (Alerts)  
- **Message Broker:** Apache Kafka    

---

## **📂 Project Structure**  
```
iot-stream-kafka/
│── consumers/         # Kafka Consumers
│   ├── storageConsumer.js  # Stores sensor data in InfluxDB
│   ├── processingConsumer.js  # Processes data & generates alerts
│
│── config/            # Configurations
│   ├── kafka.js       # Kafka setup
│   ├── influxdb.js    # InfluxDB connection
│   ├── mongodb.js     # MongoDB connection
│
│── routes/            # API Routes
│   ├── sensorRoutes.js # Handles incoming sensor data
│
│── models/            # Mongoose models
│   ├── Alert.js       # Alert schema for MongoDB
│
│── .env               # Environment variables
│── server.js          # Main server file
│── package.json       # Dependencies
│── README.md          # Documentation
```

---

## **🚀 Features**  
✅ High-throughput IoT data ingestion using **Kafka**  
✅ Fast time-series storage with **InfluxDB**  
✅ Real-time processing & alert generation using **Kafka consumers**  
✅ Fault-tolerant **MongoDB** storage for alerts  
✅ **Scalable architecture** for handling millions of IoT events  

---

## **🛠️ Setup & Installation**  

### **1️⃣ Clone the Repository**  
```bash
git clone https://github.com/yourusername/iot-stream-kafka.git
cd iot-stream-kafka
```

### **2️⃣ Install Dependencies**  
```bash
npm install
```

### **3️⃣ Setup Environment Variables**  
Create a `.env` file and add:  
```env
# Server
PORT=5000

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=iot-stream
KAFKA_SENSOR_TOPIC=sensor-data
KAFKA_ALERT_TOPIC=alerts
KAFKA_CONSUMER_GROUP_STORAGE=sensor-storage-group
KAFKA_CONSUMER_GROUP_PROCESSING=sensor-processing-group

# InfluxDB
INFLUX_URL=your_influxdb_url
INFLUX_TOKEN=your_influx_token
INFLUX_ORG=your_org
INFLUX_BUCKET=sensor_data

# MongoDB
MONGO_URI=mongodb://localhost:27017/iot_alerts
```

---

## **📡 Running the Application**  

### **1️⃣ Start Kafka (If not using Aiven Kafka)**  

#### **Using Docker (Recommended)**  
```bash
docker-compose up -d
```

#### **Manual Setup (Without Docker)**  
1. Start **Zookeeper**  
   ```bash
   bin/zookeeper-server-start.sh config/zookeeper.properties
   ```
2. Start **Kafka Broker**  
   ```bash
   bin/kafka-server-start.sh config/server.properties
   ```

---

### **2️⃣ Start the Server**  
```bash
npm start
```
or  
```bash
npm run dev  # For development mode
```

---

## **📝 API Endpoints**  

### **1️⃣ Store Sensor Data**  
**Endpoint:** `POST /sensor`  
**Request Body:**  
```json
{
  "device_code": "1",
  "accelX": 0.02,
  "accelY": -0.03,
  "accelZ": 9.81,
  "gyroX": 0.01,
  "gyroY": -0.02,
  "gyroZ": 0.03,
  "heartRate": 85,
  "oxygen": 98
}
```
**Response:**  
```json
{
  "message": "Data received & queued for processing"
}
```

---

## **📊 Database Schema**  

### **InfluxDB Schema (sensor_data bucket)**  
| Field      | Type    | Description              |
|------------|--------|--------------------------|
| deviceId   | Tag    | Unique sensor ID         |
| accelX     | Float  | Accelerometer X value    |
| accelY     | Float  | Accelerometer Y value    |
| accelZ     | Float  | Accelerometer Z value    |
| gyroX      | Float  | Gyroscope X value        |
| gyroY      | Float  | Gyroscope Y value        |
| gyroZ      | Float  | Gyroscope Z value        |
| heartRate  | Float  | Heart rate of patient    |
| oxygen     | Float  | Oxygen saturation level  |
| timestamp  | Time   | Event timestamp          |

### **MongoDB Schema (Alerts Collection)**  
```js
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  device_code: String,
  alert_type: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Alert", alertSchema);
```

---

## **💡 How Kafka Works in This Project**  

1️⃣ **Producer:** The IoT devices send data to Kafka’s `sensor-data` topic.  
2️⃣ **Consumer Group 1 (Storage):** One consumer saves the data into **InfluxDB**.  
3️⃣ **Consumer Group 2 (Processing):** Another consumer **processes sensor data**, detects anomalies, and stores alerts in **MongoDB**.  
4️⃣ **Alerts:** If abnormal values are detected, an alert is generated and stored in **MongoDB**.  

---

## **🚀 Deployment**  


---

## **📈 Monitoring Data**  

### **Check Data in MongoDB**
```bash
mongosh
use iot_alerts
db.alerts.find().pretty()
```

### **Check Data in InfluxDB**
```bash
influx query 'from(bucket: "sensor_data") |> range(start: -1h)'
```

---

## **📜 License**  
This project is licensed under **MIT License**.

---

## **💬 Contributing**  
Feel free to **fork, improve, and open a PR**! 🚀

---

## **👨‍💻 Authors**  
- **Your Name** Anish Pillai

---

**🚀 Happy Coding!** 🎯🔥
