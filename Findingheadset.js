const HID = require('node-hid');
const fs = require('fs');

HID.setDriverType('libusb');

// SteelSeries Vendor ID and Nova 7 Product ID
const VENDOR_ID = 0x1038;
const PRODUCT_ID = 0x2202;

// Usually interface 3 (MI_03) is the one responding with battery info
const TARGET_INTERFACE = 3;

function getNova7Device() {
    const devices = HID.devices().filter(d => 
        d.vendorId === VENDOR_ID &&
        d.productId === PRODUCT_ID
    );

    if (devices.length === 0) throw new Error('No Nova 7 headset found');

    // Prefer interface 3
    const deviceInfo = devices.find(d => d.interface === TARGET_INTERFACE) || devices[0];
    return deviceInfo;
}

function readBattery() {
    const deviceInfo = getNova7Device();

    console.log('Using device interface:', deviceInfo.interface);

    const device = new HID.HID(deviceInfo.path);

    // Send magic output report [0x00, 0xb0]
    device.write([0x00, 0xb0]);

    // Read input report (timeout 200ms)
    let buf;
    try {
        buf = device.readTimeout(200); // returns array of bytes
    } catch (e) {
        throw new Error('Failed to read from device: ' + e.message);
    }

    if (!buf || buf.length < 4) throw new Error('Invalid response from device');

    const batteryLevel = buf[2]; // 0–4
    const chargingCode = buf[3];

    const batteryPercent = (batteryLevel / 4) * 100;

    const chargingStatus = (() => {
        switch (chargingCode) {
            case 1: return 'Charging';
            case 3: return 'Discharging';
            case 0: return 'Disconnected';
            default: return 'Unknown';
        }
    })();

    const data = {
        timestamp: new Date().toISOString(),
        batteryPercent,
        chargingStatus,
        rawBytes: buf
    };

    fs.writeFileSync('battery.json', JSON.stringify(data, null, 2));

    console.log('Battery info saved to battery.json:', data);

    device.close();
}

// Run
try {
    readBattery();
} catch (e) {
    console.error('Error:', e.message);
}
