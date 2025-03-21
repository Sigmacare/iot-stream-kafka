require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");


const sensorRoutes = require("./routes/sensorRoutes");
const { initKafka } = require("./config/kafka");
const storeSensorData  = require("./consumers/storeConsumer");
const processSensorData = require("./consumers/processConsumer");

const app = express();
app.use(express.json());
app.use("/sensor", sensorRoutes);

//Connect to Mongo DB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));


const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initKafka();
  await storeSensorData();
  await processSensorData();
});
