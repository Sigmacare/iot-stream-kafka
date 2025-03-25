const { Kafka } = require("kafkajs");
require("dotenv").config();

const KAFKA_BROKER = process.env.KAFKA_BROKER;
const KAFKA_USERNAME = process.env.KAFKA_USERNAME;
const KAFKA_PASSWORD = process.env.KAFKA_PASSWORD;
const TOPIC_NAME = process.env.TOPIC_NAME || 'sigma-band-data';
const CA_PEM = process.env.CA_PEM || 'ca.pem';


const kafka = new Kafka({
  clientId: 'kafka-proxy',
  brokers: [KAFKA_BROKER],
  ssl: {
      ca: [CA_PEM],
  },
  sasl: {
      mechanism: 'plain',
      username: KAFKA_USERNAME,
      password: KAFKA_PASSWORD,
  },
  retry: {
      initialRetryTime: 100,
      retries: 8,
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
