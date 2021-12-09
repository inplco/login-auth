const express = require("express");
const cors = require("cors");
const bodyparser = require('body-parser');
const fileupload = require('express-fileupload');


const app = express();
app.use(cors());
app.use(bodyparser.json());
app.use(fileupload());
app.use('/uploads', express.static('uploads'));

const database = {
    token: 'test123'
}

app.get("/login-auth", (request, response) => {
  response.json(database);
});

app.listen();
