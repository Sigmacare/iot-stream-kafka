const express = require("express");
const Alert = require("../models/Alert");

const router = express.Router();

router.use(express.json());

router.get("/pending-alerts", async (req, res) => {
    try {
        const query = { resolved: false };
        const alerts = await Alert.find(query).sort({ timestamp: -1 });
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/resolve-alert", async (req, res) => {
    try {
        const { device_code, alertType } = req.body;
        const query = { resolved: false };
        if (device_code) {
            query.device_code = device_code;
        }
        if (alertType) {
            query.alertType = alertType;
        }
        const alert = await Alert.findOneAndUpdate(query, { resolved: true });
        if (alert) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Alert not found or already resolved" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;