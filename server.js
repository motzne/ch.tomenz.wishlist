const express = require("express");
const path = require("path");
const contentPath = path.join(__dirname, "/www/content");
const revealPath = path.join(__dirname, "/www/reveal");
const assetsPath = path.join(__dirname, "/www/assets");
const port = process.env.PORT || 3000;
const pug = require("pug");
require("dotenv").config();

var app = express();

app.use("/content", express.static(contentPath));
app.use("/reveal", express.static(revealPath));
app.use("/assets", express.static(assetsPath));
app.set("view engine", "pug");

app.get("/", function (req, res) {
  res.render(path.join(__dirname + "/src/templates/index.pug"), {
    title: "Nice2Know Session | LUKB DEVCADEMY",
    sessionID: process.env.CLIENT_SESSION_ID,
    masterSecret: null,
  });
});

app.get("/master/:masterID?", function (req, res) {
  if (req.params.masterID) {
    var masterSecret = req.params.masterID;
  } else {
    var masterSecret = null;
  }
  res.render(path.join(__dirname + "/src/templates/index.pug"), {
    title: "🔥 - Nice2Know Session | LUKB DEVCADEMY",
    sessionID: process.env.CLIENT_SESSION_ID,
    masterSecret: masterSecret,
  });
});

app.get("/connect", function (req, res) {
  res.render(path.join(__dirname + "/src/templates/connect.pug"), {});
});

app.get("/bad", (request, response) => {
  response.send({ error: "Bad Request" });
});
app.listen(port, () => {
  console.log(`Server is running on Port http://localhost:${port}`);
  console.log(__dirname);
});
