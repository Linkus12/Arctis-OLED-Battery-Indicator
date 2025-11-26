const HID = require('node-hid');

const BATTERY_MAGIC = 0xb0;

module.exports = class Headset {
    constructor(deviceInfo) {
        this.deviceInfo = deviceInfo;
        this.headsetName = deviceInfo.product;

        // open the actual HID device
        this.device = new HID.HID(deviceInfo.path);
    }

    getBatteryPercentage() {
        return this._readBatteryData().batteryPercent;
    }

    getChargingStatus() {
        return this._readBatteryData().chargingStatus;
    }

    _readBatteryData() {
    // write the "output report" to request battery
    this.device.write([0x00, BATTERY_MAGIC]);

    // read the response (returns an array)
    const buf = this.device.readTimeout(100); // 100ms timeout
    if (!buf || buf.length < 4) {
        throw new Error('Failed to read battery report');
    }

    const battery = Math.round((buf[2] / 4) * 100); // buf[2] = battery raw
    let status;
    switch (buf[3]) {
        case 1: status = 'Charging'; break;
        case 3: status = 'Discharging'; break;
        default: status = 'Disconnected';
    }

    return { batteryPercent: battery, chargingStatus: status };
}

};
