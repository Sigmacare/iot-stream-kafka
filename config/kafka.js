const { Kafka } = require("kafkajs");
const fs = require("fs");
require("dotenv").config();

// const kafka = new Kafka({
//   clientId: "sensor-service",
//   brokers: [process.env.KAFKA_BROKER], // Example: "localhost:9092"
// });

const kafka = new Kafka({
  clientId: 'kafka-proxy',
  brokers: [process.env.KAFKA_BROKER],
  ssl: {
    ca: [process.env.CA_PEM],
  },
  sasl: {
    mechanism: 'plain',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

// Kafka Producer
const producer = kafka.producer();
const storeConsumer = kafka.consumer({ groupId: "store-group" });
const processingConsumer = kafka.consumer({ groupId: "processing-group" });

const initKafka = async () => {
  await producer.connect();
  await storeConsumer.connect();
  await processingConsumer.connect();
  console.log("Kafka Producer & Consumer Connected");
};

module.exports = { kafka, producer, storeConsumer, processingConsumer, initKafka };
