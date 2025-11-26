const fs = require('fs');
const HID = require('node-hid');
HID.setDriverType('libusb');

// Get all connected HID devices
const devices = HID.devices();

// Save to JSON file
const outputPath = './hid_devices.json';
fs.writeFileSync(outputPath, JSON.stringify(devices, null, 2), 'utf-8');

console.log(`✅ Saved ${devices.length} devices to ${outputPath}`);
