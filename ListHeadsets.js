const HID = require('node-hid');
HID.setDriverType('libusb');

//USB\VID_1038&PID_2212&MI_00
//headset list
// const NOVA7_VENDOR_ID = 0x1038;
// const NOVA7_PRODUCT_ID = 0x2212;
const headSets = require('./listOfHeadsets.js');



//const NOVA7_VENDOR_ID = 0x1038;
//const NOVA7_PRODUCT_ID = 0x2202;
// The “magic byte” to request battery info
const BATTERY_MAGIC = 0xb0;



module.exports = {
    getConnectedHeadset: () => {
        const devices = HID.devices().filter(d =>
        headSets.some(h =>
            d.vendorId === h.NOVA7_VENDOR_ID &&
            d.productId === h.NOVA7_PRODUCT_ID
        )
        );


        if (!devices.length) throw new Error('No Arctis Nova 7 devices found!');

        // Try each interface until one responds to battery request
        for (const d of devices) {
            try {
                const dev = new HID.HID(d.path);
                // Write output report with magic byte
                dev.write([0x00, BATTERY_MAGIC]);
                // Attempt to read input report (timeout 100ms)
                const buf = dev.readTimeout(100);
                if (buf && buf.length >= 4) {
                    // Found responsive interface
                    dev.close();
                    return d;
                }
                dev.close();
            } catch (err) {
                // Ignore and try next interface
            }
        }

        throw new Error('Could not find a responsive Nova 7 interface for battery.');
    }
};
