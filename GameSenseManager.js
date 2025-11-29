const http = require("http");
const fs = require("fs");
const path = require("path");
const { text } = require("stream/consumers");
const PImage = require("pureimage");

module.exports = class GameSenseManager {
  constructor(headsetName) {
    this.headsetName = headsetName;
    this.app_name = "ARCTIS_BATTERY";
    this.percent_event_name = "DISPLAY_HEADSET_PERCENT";

    // Initialize SSE connection
    const corePropsFilename =
      "%PROGRAMDATA%/SteelSeries/SteelSeries Engine 3/coreProps.json";
    const absoluteCorePropsFilename = corePropsFilename.replace(
      /%([^%]+)%/g,
      (_, n) => process.env[n]
    );
    const corePropsJson = fs.readFileSync(absoluteCorePropsFilename, "utf-8");
    if (!corePropsJson) throw new Error("Error finding SSE address.");
    const endpoint = JSON.parse(corePropsJson).address.split(":");
    this.sseAddress = endpoint[0];
    this.ssePort = endpoint[1];

    // Register the app
    this.postToEngine("/game_metadata", {
      game: this.app_name,
      game_display_name: "Arctis Battery OLED Indicator",
      developer: "GorillaGoVroom",
    });

    // Bind the event
    this.postToEngine("/bind_game_event", {
      game: this.app_name,
      event: this.percent_event_name,
      value_optional: true,
      handlers: [
        {
          "device-type": "screened-128x40",
          mode: "screen",
          zone: "one",
          datas: [{ "has-text": false, "image-data": true }],
        },
      ],
    });
  }

  // --- Render a 128x40 monochrome image with battery info ---
  async renderBatteryOLED(headsetName = "Nova 7", statusText, batteryText, percent) {
    const width = 128;
    const height = 40;
    const img = PImage.make(width, height);
    const ctx = img.getContext("2d");

        // Load font
      const fontPath = path.join(__dirname, "fonts", "slkscr.ttf");
      const font = PImage.registerFont(fontPath, "SilkRegular");
      font.loadSync();

    if (statusText == "Offline") {
      // Big centered "Nova 7 - Offline" text
      ctx.fillStyle = "black";
      ctx.fillRect(0,0, width, height);
      ctx.fillStyle = "white";
      // console.log(headsetName)
      const text = headsetName + " - Offline";
      if (text.length <= 18)
        ctx.font = "12pt SilkRegular"; // bigger than normal
      else
        ctx.font = "10pt SilkRegular"; // bigger than normal
      const textWidth = ctx.measureText(text).width;
      const x = Math.floor((width - textWidth) / 2);
      const y = Math.floor(height / 2 + 6); // vertical center
      ctx.fillText(text, x, y);
    } else {
      // Fill background
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);

      ctx.font = "8pt SilkRegular";
      ctx.fillStyle = "white";

      // Draw headset and status text
      // ctx.fillText(`${headsetName} - ${statusText}`, 0, 10);
      ctx.fillText(`${headsetName} - ${statusText}`, 0, 10);
      ctx.fillText(batteryText, 0, 20);

      // Draw progress bar
      const barX = 0,
        barY = 28,
        barWidth = width,
        barHeight = 6;
      ctx.fillStyle = "#202020"; // background
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = "white"; // fill
      ctx.fillRect(
        barX,
        barY,
        Math.floor(barWidth * (percent / 100)),
        barHeight
      );
    }

    // Convert to monochrome bytes (1 byte = 8 horizontal pixels)
    const imageData = ctx.getImageData(0, 0, width, height).data;
    const bytes = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 8) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const i = (y * width + x + bit) * 4;
          const pixel = imageData[i]; // red channel
          byte = (byte << 1) | (pixel > 128 ? 1 : 0);
        }
        bytes.push(byte);
      }
    }

    if (bytes.length !== 640)
      console.warn("Warning: OLED byte length is not 640!", bytes.length);

    // Optional: save PNG for debugging
    // await PImage.encodePNGToStream(img, fs.createWriteStream("oled_debug.png"));

    return bytes;
  }

  // --- Send battery percentage to OLED ---
  async displayBatteryPercentage(headsetName, percent, chargingStatus = null) {
    const statusText =
      percent === null
        ? "Online"
        : chargingStatus === "Charging"
        ? "Charging"
        : chargingStatus === "Discharging"
        ? "Discharging"
        : "Offline";

    const batteryText = percent === null ? "" : `Battery: ${percent}%`;

    const imageData = await this.renderBatteryOLED(
      headsetName,
      statusText,
      batteryText,
      percent ?? 0
    );

    const eventData = {
      game: this.app_name,
      event: this.percent_event_name,
      data: {
        value: percent ?? 0,
        frame: {
          "image-data": imageData, // 640 bytes only
        },
      },
    };

    this.postToEngine("/game_event", eventData);
  }

  // --- Post JSON to GameSense ---
  postToEngine(request_type, data = "") {
    const http = require("http");
    const jsonData = JSON.stringify(data);

    const options = {
      host: this.sseAddress,
      port: this.ssePort,
      path: request_type,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(jsonData),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) console.error("GameSense error:", body);
      });
    });

    req.on("error", (err) => console.error("Request error:", err));
    req.write(jsonData);
    req.end();
  }

  onExit() {
    const exit_event = {
      game: this.app_name,
    };

    this.postToEngine("/stop_game", exit_event);
  }

  removeApp() {
    const remove_event = {
      game: this.app_name,
    };
    this.postToEngine("/remove_game", remove_event);
  }
};
