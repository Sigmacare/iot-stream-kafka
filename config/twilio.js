require("dotenv").config();
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = require('twilio')(accountSid, authToken);

const sendCallAlert = (phone) => {
    client.studio.v2.flows(process.env.TWILIO_FLOW_SID)
        .executions
        .create({
            to: phone,
            from: process.env.TWILIO_PHONE_NUMBER,
            parameters: {
                name: 'Abhinav'
            }
        })
        .then(execution => console.log(execution.sid));
}

module.exports = { sendCallAlert }

