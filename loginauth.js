const express = require("express");
const cors = require("cors");
const path = require('path');
const basicAuth = require('express-basic-auth');
const cookieParser = require('cookie-parser');
var crypto = require("crypto");
const envConfig = require("dotenv").config();
const Ably = require("ably");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;

const realTimeAuth = (tokenParams, response) => {
  realtime.auth.createTokenRequest(tokenParams, function (err, tokenRequest) {
    if (err) {
      response
        .status(500)
        .send("Error requesting token: " + JSON.stringify(err));
    } else {
      // return the token request to the front-end client
      response.json(tokenRequest);
    }
  });
};

const realtime = Ably.Realtime({
  key: process.env.ABLY_API_KEY,
});

// User list
var allUsers = require('./init.json');
var tokens = allUsers.map(function(item)
{
    return item.user;
});

console.log(tokens)

// A random key for signing the cookie
var key = crypto.randomBytes(20).toString('hex');
app.use(cookieParser(key));

const listener = app.listen(PORT, () => {
  console.log("Login server is listening on port " + listener.address().port);
});

// Test
console.log("Hello World!");
app.get('/state', (req, res) => {
  res.end('NodeJS is running on port ' + listener.address().port + '\n');
});

// End-point on Server
app.get('/authenticate', (req, res, next) => {
  console.log("authenticate");
  const options = {
    httpOnly: true,
    signed: true,
  };

  console.log(tokens);
  console.log(req.query.password);

  if (tokens.includes(req.query.password)) {
    console.log('user exists');
    res.cookie('name', 'user', options).send({ type: 'user' });
  } else {
    console.log('fake user');
    res.send({ type: 'auth' });
  }

});

app.get('/read-cookie', (req, res) => {
  console.log("read-cookie");
  console.log(req.signedCookies.name);
  if (req.signedCookies.name === 'user') {
    res.send({ type: 'user' });
  } else {
    res.send({ type: 'auth' });
  }
});

app.get('/clear-cookie', (req, res) => {
  console.log("clear-cookie");
  res.clearCookie('name').end('clearCookie');
});

app.get('/publish', (request, response) => {
  const tokenParams = {
    capability: '{"*":["publish"]}',
  };
  realTimeAuth(tokenParams, response);
});

app.get('/subscribe', (request, response) => {
  const tokenParams = {
    capability: '{"*":["subscribe"]}',
  };
  realTimeAuth(tokenParams, response);
});
