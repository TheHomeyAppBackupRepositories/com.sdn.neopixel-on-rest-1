'use strict';

const Homey = require('homey');
const NPOR = require('../../lib/neopixel_on_rest_api');

class NPOR_Device extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.api = null;
    this.LastDim = 150;
    this.FirmwareRevision = 0;
    this.FirmwareVersion = "0.0.0";
    this.PongTimeout = null;
    // Register light capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));
    this.registerMultipleCapabilityListener(['light_hue', 'light_saturation', 'light_temperature', 'light_mode'], this.onColorCapability.bind(this), 250);
    var onOffInitState = await this.getCapabilityValue('onoff');
    if (onOffInitState == null) this.setCapabilityValue('onoff', true);
    var modeInitState = await this.getCapabilityValue('light_mode');
    if (modeInitState == null) this.setCapabilityValue('light_mode', 'color');
    this.log('Neopixel On Rest has been initialized.');
  }

  async onColorCapability(valueObj, optsObj) {
    var hue = this.getCapabilityValue('light_hue');
    var sat = this.getCapabilityValue('light_saturation');
    var mode = this.getCapabilityValue('light_mode');
    var temp = this.getCapabilityValue('light_temperature');
    if (valueObj.light_hue) hue = valueObj.light_hue;
    if (valueObj.light_saturation) sat = valueObj.light_saturation;
    if (valueObj.light_mode) mode = valueObj.light_mode;
    if (valueObj.light_temperature) temp = valueObj.light_temperature;
    if (mode == 'color') {
      var rgb = this.homey.app.Convert_hsbToRgb(hue, sat, 1);
      this.log('onColorCapability:', rgb);
      var newRed = rgb.r.toFixed(0);
      var newGre = rgb.g.toFixed(0);
      var newBlu = rgb.b.toFixed(0);
      this.api.SetColor(-1, newRed, newGre, newBlu, 0);
    } else {
      var kel = this.homey.app.MapScale(1, 0, 1500, 9000, temp);
      kel = kel.toFixed(0);
      this.log('onColorCapability:', kel);
      this.api.SetKelvin(-1, kel);
    }
    return Promise.resolve();
  }

  async onCapabilityDim(dim, opts) {
    var onoff = this.getCapabilityValue('onoff');
    var newDim = this.homey.app.MapScale(0, 1, 0, 255, dim);
    newDim = newDim.toFixed(0);
    if (newDim > 0 && this.LastDim != newDim) this.LastDim = newDim;
    this.log('onCapabilityDim:', newDim);
    if (newDim > 0 && onoff === false) {
      this.setCapabilityValue('onoff', true);
    }
    this.api.SetBrightness(newDim);
    return Promise.resolve();
  } //onCapabilityDim

  async onCapabilityOnOff(value, opts) {
    this.log('onOff:', value);
    if (value === false) {
      this.setCapabilityValue('dim', 0);
      this.api.SetBrightness(0);
    } else {
      var newDim = this.homey.app.MapScale(0, 255, 0, 1, this.LastDim);
      this.setCapabilityValue('dim', newDim);
      this.api.SetBrightness(this.LastDim);
    }
    return Promise.resolve();
  } //onCapabilityOnoff

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Neopixel On Rest has been added.');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Neopixel On Rest settings where changed.');
    this.log('New Settings:', newSettings);
    this.log('Updated Settings Keys:', changedKeys);
    if (changedKeys.includes('startupSelftest') || changedKeys.includes('driverUsed') || changedKeys.includes('pixelsCount') || changedKeys.includes('colorMode')) {
      var drvId = this.api.__getDriverIdFromName(newSettings.driverUsed);
      var selfTest = '1';
      if (newSettings.startupSelftest === false) selfTest = '0';
      var success = await this.api.SetDeviceConfiguration(drvId, newSettings.pixelsCount, newSettings.colorMode, selfTest);
      if (success === false) {
        newSettings = oldSettings;
      }
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Neopixel On Rest was renamed to:', name);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    if (this.PongTimeout != null && this.PongTimeout) {
      clearTimeout(this.PongTimeout);
      this.PongTimeout = null;
    }
    this.log('Neopixel On Rest has been deleted.');
  }

  onDiscoveryResult(discoveryResult) {
    // Return a truthy value here if the discovery result matches your device.
    return discoveryResult.id === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult) {
    // This method will be executed once when the device has been found (onDiscoveryResult returned true)
    this.log('Device Discovered:', discoveryResult.address);
    this.api = new NPOR(discoveryResult.address);
    this.requestDeviceStatus(this);
  }

  onDiscoveryAddressChanged(discoveryResult) {
    // Update your connection details here, reconnect when the device is offline
    this.log('New address:', discoveryResult.address);
    this.api.UpdateAddress(discoveryResult.address);
    this.requestDeviceStatus(this);
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    // When the device is offline, try to reconnect here
    //FIXME: This does not seem to fire ever? Strangely this fires sometimes but not always.
    this.requestDeviceStatus(this);
  }

  async requestDeviceStatus(device) {
    device.api.GetStatus().then(async (data) => {
      device.log('GetStatus:', data);
      if (data.dim > 0 && data.res == 0) device.LastDim = data.dim;
      var currentDim = device.homey.app.MapScale(0, 255, 0, 1, data.dim);
      device.FirmwareRevision = data.rev;
      //TODO: Update device capabilities based on the firmware revision
      device.FirmwareVersion = data.fwv;
      var firmwareUpToDate = device.homey.app.IsDeviceOnLatestFirmware(device.FirmwareVersion);
      if (data.def == 1) {
        device.setWarning(device.homey.__('deviceSetupWarning'));
      } else if (firmwareUpToDate === false) {
        device.setWarning(device.homey.__('deviceFwOutdatedWarning'));
      } else {
        device.unsetWarning();
      }
      var areWeOn = device.getAvailable();
      if (areWeOn === false) {
        await device.setAvailable().catch(device.error);
      }
      if (data.res == 1) {
        // Check up on device settings after restart..
        const settings = device.getSettings();
        const currentDriver = device.api.__getDriverNameFromId(data.drv);
        const currentNumOfPixels = parseInt(data.nop);
        const controllerHasStartupTestEnabled = parseInt(data.tas);
        var selfTestEnabled = true;
        if (controllerHasStartupTestEnabled == 0) selfTestEnabled = false;
        // Add color mode and move to restart handler to reduce load
        if (settings.startupSelftest !== selfTestEnabled || settings.pixelsCount != currentNumOfPixels || currentDriver != settings.driverUsed || data.com != settings.colorMode) {
          device.setSettings({
            pixelsCount: currentNumOfPixels,
            driverUsed: currentDriver,
            colorMode: data.com,
            startupSelftest: selfTestEnabled
          }).catch(device.error);
        }
        // Check whether to restore the light settings..
        if (settings.restoreLightOnRestart === true) {
          var oldOnOff = await device.getCapabilityValue('onoff');
          device.onCapabilityOnOff(oldOnOff);
          device.onColorCapability({}, {});
        }
        // Fire come back trigger card..
        device.homey.app.Trigger_DeviceRestarted.trigger(device, {}, {})
          .then(() => {
            return Promise.resolve();
          })
          .catch(err => {
            device.error('Trigger_DeviceRestarted failed:', err);
            return Promise.resolve();
          })
      } else {
        // Update dim from device if we did not restart..
        var oldDim = await device.getCapabilityValue('dim');
        if (oldDim != currentDim) {
          device.setCapabilityValue('dim', currentDim);
        }
        var oldOnOff = await device.getCapabilityValue('onoff');
        if (currentDim > 0 && oldOnOff !== true) {
          device.setCapabilityValue('onoff', true);
        } else if (currentDim == 0 && oldOnOff !== false) {
          device.setCapabilityValue('onoff', false);
        }
      }
    }).catch((err) => {
      device.log('GetStatus failed:', err);
      var areWeOn = device.getAvailable();
      if (areWeOn === true) {
        device.setUnavailable(device.homey.__('deviceLooksOffline')).catch(device.error);
      }
    });
    if (device.PongTimeout != null && device.PongTimeout) {
      clearTimeout(device.PongTimeout);
      device.PongTimeout = null;
    }
    var myDriversDevices = device.driver.getDevices();
    device.PongTimeout = setTimeout(function () {
      device.requestDeviceStatus(device);
    }, 30000 + Math.floor(Math.random() * (myDriversDevices.length * 150)));
  }
}

module.exports = NPOR_Device;
