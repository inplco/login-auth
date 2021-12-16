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

function writeLog() {
  var util = require('util');
  var log_file = fs.createWriteStream('./logs/debug.log', {flags : 'w'});
  var log_stdout = process.stdout;

  console.log = function(d) { //
    log_file.write(util.format(d) + '\n');
    log_stdout.write(util.format(d) + '\n');
  };
}
writeLog();

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

// Find vote count
function findIt(object, value){
  for(var x in object){
    if(object["value"] == value){
      foundVote = object["votes"];
    } else {
      foundVote = 0;
    }
  }
  return foundVote;
}

function getTopN(arr, prop, n) {
    // clone before sorting, to preserve the original array
    var clone = arr.slice(0);
    // sort descending
    clone.sort(function(x, y) {
        if (x[prop] == y[prop]) return 0;
        else if (parseInt(x[prop]) < parseInt(y[prop])) return 1;
        else return -1;
    });

    return clone.slice(0, n || 1);
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
  const options = {
    httpOnly: true,
    signed: true,
    activeSession: true,
  };

  fs.readFile('./hasvoted.json', 'utf8', function read(err, data){
    console.log("USER CALL BEGIN -----------------------");
    console.log("authenticating user " + req.query.password);
    if (err){
      console.log('cannot read purged list');
    } else {
      const voted = data;
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
        console.log('fake user token ' + req.query.password);
        res.send({ type: 'auth' });
      }
    }
    console.log("USER CALL END -------------------------");
  });
});

app.get('/read-cookie', (req, res) => {
  console.log("READ COOKIE BEGIN ---------------------");
  console.log("read-cookie " + req.signedCookies.name);
  if (tokens.includes(req.signedCookies.name)) {
    var hasVoted = JSON.parse(fs.readFileSync('./hasvoted.json', 'utf8'));
    if (hasVoted.includes(req.signedCookies.name)) {
      res.send({ type: 'auth' });
    }
  } else {
    res.send({ type: 'auth' });
  }
  console.log("READ COOKIE END -----------------------");
});

app.get('/clear-cookie', (req, res) => {
  console.log("CLEAR COOKIE BEGIN --------------------");
  console.log("clear-cookie " + req.signedCookies.name);
  res.clearCookie(req.signedCookies.name).end('clearCookie');
  console.log("CLEAR COOKIE END ----------------------");
});

app.get('/read-vote', (req, res, next) => {
  console.log("REGISTER VOTE BEGIN -------------------");
  var stateVoted = JSON.parse(fs.readFileSync('./hasvoted.json', 'utf8'));
  if (stateVoted.includes(req.signedCookies.name)) {
    res.send({ type: 'auth' });
  } else {
    var allVotedPosters = JSON.parse(fs.readFileSync('./voteCount.json', 'utf8'));
    var posterName = req.query.name;
    var voteCount = req.query.vote;
    var oldVote = findIt(allVotedPosters, posterName);
    console.log(oldVote);
    var updatedCount = oldVote + voteCount;
    console.log(updatedCount);
    console.log("read-vote: " + posterName + " (" + voteCount + ")");
    findAndReplace(allVotedPosters, posterName, updatedCount);
    var json = JSON.stringify(allVotedPosters);
    fd = fs.openSync('./voteCount.json', 'w');
    fs.writeFileSync(fd, json);
    fs.close(fd);
    var topScorers = getTopN(allVotedPosters, "votes", 10);
    topScorers.forEach(function(item, index) {
      console.log("Top#" + (index + 1) + ": " + item.name + "(" + item.votes + ")");
    });
  }
  console.log("REGISTER VOTE END ---------------------");
  console.log("PURGE TOKEN BEGIN ---------------------");
  console.log("purging user " + req.signedCookies.name);
  var obj = JSON.parse(fs.readFileSync('./hasvoted.json', 'utf8'));
  obj.push({user: req.signedCookies.name});
  var json = JSON.stringify(obj);
  fd = fs.openSync('./hasvoted.json', 'w');
  fs.writeFileSync(fd, json);
  fs.close(fd);
  console.log("purgeUser " + req.signedCookies.name);
  res.clearCookie(req.signedCookies.name).end('purgeUser');
  console.log("PURGE TOKEN END -----------------------");
});

app.get('/sign-vote', (req, res) => {
  console.log("PURGE TOKEN BEGIN ---------------------");
  console.log("purging user " + req.signedCookies.name);
  var obj = JSON.parse(fs.readFileSync('./hasvoted.json', 'utf8'));
  obj.push({user: req.signedCookies.name});
  var json = JSON.stringify(obj);
  fd = fs.openSync('./hasvoted.json', 'w');
  fs.writeFileSync(fd, json);
  fs.close(fd);
  console.log("purgeUser " + req.signedCookies.name);
  res.clearCookie(req.signedCookies.name).end('purgeUser');
  console.log("PURGE TOKEN END -----------------------");
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
