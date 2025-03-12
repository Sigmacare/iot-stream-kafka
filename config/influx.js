const { InfluxDB, Point } = require("@influxdata/influxdb-client");
require("dotenv").config();

const influx = new InfluxDB({
  url: process.env.INFLUX_URL,
  token: process.env.INFLUX_TOKEN,
});

const writeApi = influx.getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET, "ns");

module.exports = { writeApi, Point };
