const express = require("express");
const cors = require("cors");
const path = require('path');
const basicAuth = require('express-basic-auth');
const cookieParser = require('cookie-parser');
var crypto = require("crypto");
const envConfig = require("dotenv").config();
const Ably = require("ably");
var fs = require('fs');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;


var util = require('util');
var log_file = fs.createWriteStream('./debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};


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

// Poster list
var allPosters = require('./store.json');

// Update vote count
function findAndReplace(object, value, replacevalue){
  for(var x in object){
    if(typeof object[x] == typeof {}){
      findAndReplace(object[x], value, replacevalue);
    }
    if(object["value"] == value){
      object["votes"] = replacevalue;
    }
  }
}

// A random key for signing the cookie
var key = crypto.randomBytes(20).toString('hex');
app.use(cookieParser(key));

// Test
console.log("Hello World!");
app.get('/state', (req, res) => {
  res.end('NodeJS is running on port ' + PORT + '\n');
});

// End-point on Server
var obj = [];

app.get('/authenticate', (req, res, next) => {
  console.log("authenticate");
  const options = {
    httpOnly: true,
    signed: true,
    activeSession: true,
  };

  fs.readFile('./hasvoted.json', 'utf8', function read(err, data){
    if (err){
      console.log('cannot read purged list');
    } else {
      const voted = data;
      console.log('voted users: ', voted);
      console.log('voter token: ', req.query.password);
      if (tokens.includes(req.query.password)) {
        console.log('user ' + req.query.password + ' exists');
        if (voted.includes(req.query.password)) {
          console.log('user ' + req.query.password + ' has already voted');
          res.cookie('name', 'null', options).send({ type: 'auth' });
        } else {
          console.log('user ' + req.query.password + ' has not voted yet');
          res.cookie('name', req.query.password, options).send({ type: 'user' });
        }
      } else {
        console.log('fake user');
        res.send({ type: 'auth' });
      }
    }
  });
});

app.get('/read-cookie', (req, res) => {
  console.log("read-cookie ", String(req.signedCookies.name));
  if (tokens.includes(req.signedCookies.name)) {
    res.send({ type: 'user' });
  } else {
    res.send({ type: 'auth' });
  }
});

app.get('/clear-cookie', (req, res) => {
  console.log("clear-cookie ", String(req.signedCookies.name));
  res.clearCookie('name').end('clearCookie');
});

app.get('/read-vote', (req, res, next) => {
  var posterName = req.query.name;
  var voteCount = req.query.vote;
  console.log("read-vote: ", String(posterName), String(voteCount));
  var allVotedPosters = require('./voteCount.json');
  findAndReplace(allVotedPosters, posterName, voteCount);
  var json = JSON.stringify(allVotedPosters);
  fd = fs.openSync('./voteCount.json', 'w');
  fs.writeFileSync(fd, json);
  fs.close(fd);
  res.end('read-vote');
});

app.get('/sign-vote', (req, res) => {
  console.log("purging user", String(req.signedCookies.name));
  var obj = JSON.parse(fs.readFileSync('./hasvoted.json', 'utf8'));
  obj.push({user: req.signedCookies.name});
  var json = JSON.stringify(obj);
  fd = fs.openSync('./hasvoted.json', 'w');
  fs.writeFileSync(fd, json);
  fs.close(fd);
  console.log("purgeUser ", String(req.signedCookies.name));
  res.clearCookie('name').end('purgeUser');
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

const listener = app.listen(PORT, () => {
  console.log("Login server is listening on port " + PORT);
});
