// app.js
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());
const port = 3000;

// API Credentials
const API_BASE_URL = "https://bot.gs-robot.com/gas/api/v1alpha1";
const CLIENT_ID = "dQp1NnNnoKIVSG86bY5FbT9UI";
const CLIENT_SECRET = "CUrBbypSQLpVqOzi5FKWm5SnIaSpdEMqnlMzfPMf8z4YYAMahuUxLgY";
const ACCESS_KEY = "d3324ffa240db2efd3dda79947c55921";

let accessToken = null;
let tokenExpiry = null;

// Set EJS as view engine and serve static files
app.set("view engine", "ejs");
app.use(express.static("public"));

// Token management endpoint
app.get("/get-token", async (req, res) => {
  try {
    if (accessToken && Date.now() < tokenExpiry) {
      return res.json({ access_token: accessToken });
    }

    const response = await axios.post(
      `${API_BASE_URL}/oauth/token`,
      {
        grant_type: "urn:gaussian:params:oauth:grant-type:open-access-token",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        open_access_key: ACCESS_KEY,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000;

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching token:",
      error.response?.data || error.message
    );
    res.status(500).send(error.response?.data || "Error fetching token");
  }
});

// Main dashboard route
app.get("/", (req, res) => {
  res.render("main");
});

// Robots API endpoint
app.get("/api/robots", async (req, res) => {
  try {
    const tokenResponse = await axios.get("http://localhost:3000/get-token");
    const token = tokenResponse.data.access_token;

    let allRobots = [];
    let currentPage = 1;
    const pageSize = 10;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const response = await axios.get(
        "https://openapi.gs-robot.com/v1alpha1/robots",
        {
          params: {
            page: currentPage,
            pageSize: pageSize,
            relation: "cugrup",
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      allRobots = allRobots.concat(response.data.robots);
      totalPages = Math.ceil(response.data.total / pageSize);
      currentPage++;
    }

    const onlineRobots = allRobots.filter((robot) => robot.online);

    res.json({
      robots: onlineRobots,
      totalRobots: allRobots.length,
      onlineRobotsCount: onlineRobots.length,
    });
  } catch (error) {
    console.error("Error fetching robots:", error);
    res.status(500).send("Error fetching robots");
  }
});

// Robot status endpoint
app.get("/api/robots/:serialNumber/status", async (req, res) => {
  const { serialNumber } = req.params;

  try {
    const tokenResponse = await axios.get("http://localhost:3000/get-token");
    const token = tokenResponse.data.access_token;

    const response = await axios.get(
      `https://openapi.gs-robot.com/v1alpha1/robots/${serialNumber}/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching robot status:", error);
    res.status(500).send("Error fetching robot status");
  }
});

// Robot device endpoint
app.get("/api/robots/:serialNumber/device", async (req, res) => {
  const { serialNumber } = req.params;

  try {
    const tokenResponse = await axios.get("http://localhost:3000/get-token");
    const token = tokenResponse.data.access_token;

    const response = await axios.get(
      `https://openapi.gs-robot.com/v1alpha1/robots/${serialNumber}/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const deviceData = response.data.device;
    res.json(deviceData);
  } catch (error) {
    console.error("Error fetching robot device data:", error);
    res.status(500).send("Error fetching robot device data");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
