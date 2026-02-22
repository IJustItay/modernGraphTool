// Copyright 2024 : Pragmatic Audio
// WebUSB to WebHID Polyfill wrapper for Mobile Type-C support

export const UsbWebUsbConnector = (async function () {
    let currentDevice = null;
    const { usbHidDeviceHandlerConfig } = await import('./usbDeviceConfig.js');

    // Maps a WebUSB device to look like a WebHID device
    class WebUsbHidShim {
        constructor(usbDevice) {
            this.usbDevice = usbDevice;
            this.vendorId = usbDevice.vendorId;
            this.productId = usbDevice.productId;
            this.productName = usbDevice.productName;
            this.opened = false;
            this.listeners = {};
            this.oninputreport = null;
            this._pollingInterval = null;
            this._hidInterface = null;
        }

        async open() {
            if (!this.opened) {
                await this.usbDevice.open();

                if (this.usbDevice.configuration === null && this.usbDevice.configurations.length > 0) {
                    await this.usbDevice.selectConfiguration(this.usbDevice.configurations[0].configurationValue);
                }

                // Find the HID interface
                const config = this.usbDevice.configuration;
                let claimed = false;
                let dbg = "";
                if (config) {
                    for (const iface of config.interfaces) {
                        const alt = iface.alternates[0];
                        dbg += `[I${iface.interfaceNumber}C${alt.interfaceClass}S${alt.interfaceSubclass}]`;
                        if (alt.interfaceClass === 3 || alt.interfaceClass === 255) { // HID or Vendor-Specific
                            try {
                                await this.usbDevice.claimInterface(iface.interfaceNumber);
                                this._hidInterface = iface.interfaceNumber;
                                this._inEndpoint = alt.endpoints ? alt.endpoints.find(e => e.direction === 'in') : null;
                                claimed = true;
                                break;
                            } catch (e) {
                                dbg += `!E:${e.name}!`;
                                console.warn(`Could not claim interface ${iface.interfaceNumber}: ${e.message}`);
                            }
                        }
                    }
                }

                if (claimed) {
                    this._startPolling();
                } else {
                    throw new Error(`No claimable HID/Vendor IF. Dbg: ${dbg}`);
                }

                this.opened = true;
            }
        }

        async close() {
            if (this.opened) {
                this._stopPolling();
                if (this._hidInterface !== null) {
                    await this.usbDevice.releaseInterface(this._hidInterface);
                }
                await this.usbDevice.close();
                this.opened = false;
            }
        }

        async sendReport(reportId, data) {
            // WebHID sendReport maps to HID SET_REPORT (Output report)
            // bmRequestType: 0x21 (Host to Device, Class, Interface)
            // bRequest: 0x09 (SET_REPORT)
            // wValue: (0x02 << 8) | reportId (0x02 = Output Report)
            // wIndex: interfaceNumber
            try {
                // Ensure data includes reportId at the beginning if required by device,
                // but usually WebHID sendReport abstracts the Report ID. For safety, we pass data directly.
                await this.usbDevice.controlTransferOut({
                    requestType: 'class',
                    recipient: 'interface',
                    request: 0x09,
                    value: (0x02 << 8) | reportId,
                    index: this._hidInterface || 0
                }, data);
            } catch (e) {
                console.error("WebUSB sendReport failed", e);
            }
        }

        addEventListener(type, listener) {
            if (!this.listeners[type]) this.listeners[type] = [];
            this.listeners[type].push(listener);
        }

        removeEventListener(type, listener) {
            if (this.listeners[type]) {
                this.listeners[type] = this.listeners[type].filter(l => l !== listener);
            }
        }

        _dispatchEvent(event) {
            if (this.oninputreport && event.type === 'inputreport') {
                this.oninputreport(event);
            }
            if (this.listeners[event.type]) {
                this.listeners[event.type].forEach(l => l(event));
            }
        }

        _startPolling() {
            if (this._pollingInterval || !this._inEndpoint) return;

            const poll = async () => {
                try {
                    const result = await this.usbDevice.transferIn(this._inEndpoint.endpointNumber, 64);
                    if (result.data) {
                        // In WebHID, event.data is a DataView containing the report data (excluding report ID usually)
                        // In WebUSB, the first byte might be the report ID. We emit it raw to let handlers process it.
                        this._dispatchEvent({
                            type: 'inputreport',
                            data: result.data,
                            device: this
                        });
                    }
                } catch (e) {
                    if (this.opened) console.error("WebUSB Poll Error", e);
                }
                if (this.opened) {
                    this._pollingInterval = setTimeout(poll, 10); // Polling interval
                }
            };
            poll();
        }

        _stopPolling() {
            if (this._pollingInterval) {
                clearTimeout(this._pollingInterval);
                this._pollingInterval = null;
            }
        }
    }

    const getDeviceConnected = async () => {
        try {
            const vendorToManufacturer = usbHidDeviceHandlerConfig.flatMap(entry =>
                entry.vendorIds.map(vendorId => ({
                    vendorId,
                }))
            );

            // On mobile, navigator.hid won't exist. We use navigator.usb explicitly
            if (!navigator.usb) {
                console.error("WebUSB is not supported in this browser.");
                return null;
            }

            const rawUsbDevice = await navigator.usb.requestDevice({ filters: vendorToManufacturer });

            if (rawUsbDevice) {
                const rawDevice = new WebUsbHidShim(rawUsbDevice);

                const vendorConfig = usbHidDeviceHandlerConfig.find(entry =>
                    entry.vendorIds.includes(rawDevice.vendorId)
                );

                if (!vendorConfig) {
                    return;
                }

                const model = rawDevice.productName || "Unknown USB Device";
                let deviceDetails = vendorConfig.devices[model] || {};
                let modelConfig = Object.assign(
                    {},
                    vendorConfig.defaultModelConfig || {},
                    deviceDetails.modelConfig || {}
                );

                const manufacturer = deviceDetails.manufacturer | vendorConfig.manufacturer;
                let handler = deviceDetails.handler || vendorConfig.handler;

                if (currentDevice != null) {
                    return currentDevice;
                }

                if (!rawDevice.opened) {
                    try {
                        await rawDevice.open();
                    } catch (e) {
                        return { error: e.message };
                    }
                }
                currentDevice = {
                    rawDevice: rawDevice,
                    manufacturer: manufacturer,
                    model: model,
                    handler: handler,
                    modelConfig: modelConfig
                };

                return currentDevice;
            }
        } catch (error) {
            console.error("Failed to connect to USB device:", error);
            if (error.name === "NotFoundError" || error.name === "NotAllowedError" || error.message.includes("cancelled")) {
                return null; // User cancelled
            }
            return { error: error.message };
        }
    };

    const disconnectDevice = async () => {
        if (currentDevice && currentDevice.rawDevice) {
            try {
                await currentDevice.rawDevice.close();
                currentDevice = null;
            } catch (error) { }
        }
    };

    const checkDeviceConnected = async (device) => {
        if (!device || !device.rawDevice || !device.rawDevice.opened) {
            alert('Device disconnected?');
            return false;
        }
        return true;
    };

    const pushToDevice = async (device, slot, preamp, filters) => {
        if (!await checkDeviceConnected(device)) throw Error("Device Disconnected");
        // Wrapper code logic is identical to standard USBHidConnector
        if (device && device.handler) {
            const filtersToWrite = [...filters];
            if (filtersToWrite.length > device.modelConfig.maxFilters) filtersToWrite.splice(device.modelConfig.maxFilters);
            for (let i = 0; i < filtersToWrite.length; i++) {
                if (filtersToWrite[i].freq < 20 || filtersToWrite[i].freq > 20000) filtersToWrite[i].freq = 100;
                if (filtersToWrite[i].q < 0.01 || filtersToWrite[i].q > 100) filtersToWrite[i].q = 1;
            }
            if (filtersToWrite.length < device.modelConfig.maxFilters && device.modelConfig.defaultResetFiltersValues) {
                const defaultFilter = device.modelConfig.defaultResetFiltersValues[0];
                for (let i = filtersToWrite.length; i < device.modelConfig.maxFilters; i++) {
                    filtersToWrite.push({ ...defaultFilter });
                }
            }
            return await device.handler.pushToDevice(device, slot, preamp, filtersToWrite);
        }
        return true;
    };

    const getAvailableSlots = async (device) => device.modelConfig.availableSlots;
    const getCurrentSlot = async (device) => device && device.handler ? await device.handler.getCurrentSlot(device) : -2;
    const pullFromDevice = async (device, slot) => {
        if (!await checkDeviceConnected(device)) throw Error("Device Disconnected");
        return device && device.handler ? await device.handler.pullFromDevice(device, slot) : { filters: [] };
    };
    const enablePEQ = async (device, enabled, slotId) => device && device.handler ? await device.handler.enablePEQ(device, enabled, slotId) : null;
    const getCurrentDevice = () => currentDevice;

    return {
        getDeviceConnected,
        getAvailableSlots,
        disconnectDevice,
        pushToDevice,
        pullFromDevice,
        getCurrentDevice,
        getCurrentSlot,
        enablePEQ,
    };
})();
