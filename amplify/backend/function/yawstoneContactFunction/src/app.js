/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/




const express = require('express')
const bodyParser = require('body-parser')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

// Import AWS SES v3 Client
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const sesClient = new SESClient({ region: process.env.REGION || "us-east-1" });

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});


/**********************
 * Example get method *
 **********************/

app.get('/contact', function(req, res) {
  // Add your code here
  res.json({success: 'get call succeed!', url: req.url});
});

app.get('/contact/*', function(req, res) {
  // Add your code here
  res.json({success: 'get call succeed!', url: req.url});
});

/****************************
* Example post method *
****************************/

app.post('/contact', async function(req, res) {
  try {
    const { name, email, interest, message } = req.body;
    
    const params = {
      Destination: {
        ToAddresses: ["yawson@yawstone.com"] // MUST BE VERIFIED IN SES if in Sandbox
      },
      Message: {
        Body: {
          Text: { Data: `New Contact Inquiry:\n\nName: ${name}\nEmail: ${email}\nInterest: ${interest}\n\nMessage:\n${message}`, Charset: "UTF-8" }
        },
        Subject: { Data: `Yawstone Inquiry from ${name} [${interest}]`, Charset: "UTF-8" }
      },
      // IMPORTANT: This Source email MUST be verified in your AWS SES console
      Source: "yawson@yawstone.com" 
    };

    const command = new SendEmailCommand(params);
    await sesClient.send(command);

    res.json({success: 'Email sent successfully!', body: req.body})
  } catch (error) {
    console.error("SES Error:", error);
    res.status(500).json({ error: error.message, url: req.url });
  }
});

app.post('/contact/*', function(req, res) {
  res.json({success: 'post call succeed!', url: req.url, body: req.body})
});

/****************************
* Example put method *
****************************/

app.put('/contact', function(req, res) {
  // Add your code here
  res.json({success: 'put call succeed!', url: req.url, body: req.body})
});

app.put('/contact/*', function(req, res) {
  // Add your code here
  res.json({success: 'put call succeed!', url: req.url, body: req.body})
});

/****************************
* Example delete method *
****************************/

app.delete('/contact', function(req, res) {
  // Add your code here
  res.json({success: 'delete call succeed!', url: req.url});
});

app.delete('/contact/*', function(req, res) {
  // Add your code here
  res.json({success: 'delete call succeed!', url: req.url});
});

app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
