// SteelSeries Nova 7 Headset Battery Indicator on OLED.
// Made by: GorillaGoVroom <3

const ListHeadsets = require("./ListHeadsets");
const Headset = require("./Headset");
const GameSenseManager = require("./GameSenseManager");

const prependFile = require("prepend-file");

const exitHook = require("exit-hook");

let myHeadset;
let myGameSenseManager;

function getTimeStamp() {
  const date = new Date();
  return (
    ("00" + (date.getMonth() + 1)).slice(-2) +
    "/" +
    ("00" + date.getDate()).slice(-2) +
    "/" +
    date.getFullYear() +
    " " +
    ("00" + date.getHours()).slice(-2) +
    ":" +
    ("00" + date.getMinutes()).slice(-2) +
    ":" +
    ("00" + date.getSeconds()).slice(-2)
  );
}

function writeToLogFile(data) {
  prependFile.sync("log.txt", getTimeStamp() + " - " + data + "\n##########\n");
}

try {
  const headsetCreds = ListHeadsets.getConnectedHeadset();
  myHeadset = new Headset(headsetCreds);
  myGameSenseManager = new GameSenseManager(myHeadset.headsetName);

  exitHook(() => {
    myHeadset.close();
    myGameSenseManager.onExit();
  });

  console.log("Nova 7 connected:", myHeadset.headsetName);
} catch (err) {
  console.error("Initialization failed:", err);
  process.exit(1);
}

// Poll battery every 1s
setInterval(function () {
  try {
    const battery_percent = myHeadset.getBatteryPercentage();
    const charging_status = myHeadset.getChargingStatus();
    myGameSenseManager.displayBatteryPercentage(
      battery_percent,
      charging_status
    );
  } catch (write_error) {
    writeToLogFile(write_error);
    // If headset disconnected, pass null
    myGameSenseManager.displayBatteryPercentage(null);
  }
}, 1000);
