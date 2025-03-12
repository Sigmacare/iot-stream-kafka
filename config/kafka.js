const { Kafka } = require("kafkajs");
require("dotenv").config();

const kafka = new Kafka({
  clientId: "sensor-service",
  brokers: [process.env.KAFKA_BROKER], // Example: "localhost:9092"
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
