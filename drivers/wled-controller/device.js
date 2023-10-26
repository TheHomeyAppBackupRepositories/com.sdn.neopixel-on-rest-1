'use strict';

const Homey = require('homey');
const WLED = require('../../lib/wled_api');

class WLED_Device extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.api = null;
    this.FirmwareVersion = "0.0.0";
    this.PongTimeout = null;
    this.WeBeenOn = false;
    this.LastDataRaw = null;
    // Register light capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));
    this.registerCapabilityListener('nightlight', this.onCapabilityNightlight.bind(this));
    this.registerMultipleCapabilityListener(['light_hue', 'light_saturation', 'light_temperature', 'light_mode'], this.onColorCapability.bind(this), 250);
    this.registerMultipleCapabilityListener([
      'control_mode',
      'col1r',
      'col1g',
      'col1b',
      'col1w',
      'col2r',
      'col2g',
      'col2b',
      'col2w',
      'col3r',
      'col3g',
      'col3b',
      'col3w',
    ], this.onDummyWledCapability.bind(this), 50);
    var onOffInitState = await this.getCapabilityValue('onoff');
    if (onOffInitState == null) this.setCapabilityValue('onoff', true);
    var modeInitState = await this.getCapabilityValue('light_mode');
    if (modeInitState == null) this.setCapabilityValue('light_mode', 'color');
    // Create default color capability values if required..
    var col1r = await this.getCapabilityValue('col1r');
    if (col1r == null) this.setCapabilityValue('col1r', 0);
    var col1g = await this.getCapabilityValue('col1g');
    if (col1g == null) this.setCapabilityValue('col1g', 0);
    var col1b = await this.getCapabilityValue('col1b');
    if (col1b == null) this.setCapabilityValue('col1b', 0);
    var col1w = await this.getCapabilityValue('col1w');
    if (col1w == null) this.setCapabilityValue('col1w', 0);
    var col2r = await this.getCapabilityValue('col2r');
    if (col2r == null) this.setCapabilityValue('col2r', 0);
    var col2g = await this.getCapabilityValue('col2g');
    if (col2g == null) this.setCapabilityValue('col2g', 0);
    var col2b = await this.getCapabilityValue('col2b');
    if (col2b == null) this.setCapabilityValue('col2b', 0);
    var col2w = await this.getCapabilityValue('col2w');
    if (col2w == null) this.setCapabilityValue('col2w', 0);
    var col3r = await this.getCapabilityValue('col3r');
    if (col3r == null) this.setCapabilityValue('col3r', 0);
    var col3g = await this.getCapabilityValue('col3g');
    if (col3g == null) this.setCapabilityValue('col3g', 0);
    var col3b = await this.getCapabilityValue('col3b');
    if (col3b == null) this.setCapabilityValue('col3b', 0);
    var col3w = await this.getCapabilityValue('col3w');
    if (col3w == null) this.setCapabilityValue('col3w', 0);
    this.log('WLED has been initialized.');
  }

  async onDummyWledCapability(valueObj, optsObj) {
    this.log('onDummyWledCapability:', valueObj);
    return Promise.resolve();
  }

  async onCapabilityNightlight(valueObj, optsObj) {
    this.log('onCapabilityNightlight:', valueObj);
    var nlObj = {
      "on": valueObj
    }
    this.api.SetNewNightlightSettings(nlObj);
  }

  async onColorCapability(valueObj, optsObj) {
    var hue = await this.getCapabilityValue('light_hue');
    var sat = await this.getCapabilityValue('light_saturation');
    var mode = await this.getCapabilityValue('light_mode');
    var temp = await this.getCapabilityValue('light_temperature');
    var colCtlMode = await this.getCapabilityValue('control_mode');
    if (colCtlMode != "col1" && colCtlMode != "col2" && colCtlMode != "col3") {
      colCtlMode = "col1";
      this.setCapabilityValue('control_mode', colCtlMode);
    }
    // Prepare multicolor section info
    var col1r = await this.getCapabilityValue('col1r');
    var col1g = await this.getCapabilityValue('col1g');
    var col1b = await this.getCapabilityValue('col1b');
    var col1w = await this.getCapabilityValue('col1w');
    var col2r = await this.getCapabilityValue('col2r');
    var col2g = await this.getCapabilityValue('col2g');
    var col2b = await this.getCapabilityValue('col2b');
    var col2w = await this.getCapabilityValue('col2w');
    var col3r = await this.getCapabilityValue('col3r');
    var col3g = await this.getCapabilityValue('col3g');
    var col3b = await this.getCapabilityValue('col3b');
    var col3w = await this.getCapabilityValue('col3w');
    var segColObj = {
      "col": [
        [parseInt(col1r), parseInt(col1g), parseInt(col1b), parseInt(col1w)],
        [parseInt(col2r), parseInt(col2g), parseInt(col2b), parseInt(col2w)],
        [parseInt(col3r), parseInt(col3g), parseInt(col3b), parseInt(col3w)]
      ]
    };
    // Prepare color which been set
    var rgb = null;
    if (valueObj.light_hue) hue = valueObj.light_hue;
    if (valueObj.light_saturation) sat = valueObj.light_saturation;
    if (valueObj.light_mode) mode = valueObj.light_mode;
    if (valueObj.light_temperature) temp = valueObj.light_temperature;
    if (mode == 'color') {
      rgb = this.homey.app.Convert_hsbToRgb(hue, sat, 1);
      this.log('onColorCapability:', rgb);
      var newRed = rgb.r.toFixed(0);
      var newGre = rgb.g.toFixed(0);
      var newBlu = rgb.b.toFixed(0);
      rgb.r = parseInt(newRed);
      rgb.g = parseInt(newGre);
      rgb.b = parseInt(newBlu);
      rgb.w = 0;
    } else {
      var kel = this.homey.app.MapScale(1, 0, 1500, 9000, temp);
      kel = kel.toFixed(0);
      this.log('onColorCapability:', kel);
      rgb = this.api.__calculateRgbFromKelvin(kel);
      rgb.r = parseInt(rgb.r);
      rgb.g = parseInt(rgb.g);
      rgb.b = parseInt(rgb.b);
      rgb.w = 0;
    }
    // Update targetted rbg color
    if (colCtlMode == "col1") {
      this.setCapabilityValue('col1r', rgb.r);
      this.setCapabilityValue('col1g', rgb.g);
      this.setCapabilityValue('col1b', rgb.b);
      this.setCapabilityValue('col1w', rgb.w);
      segColObj.col[0][0] = rgb.r;
      segColObj.col[0][1] = rgb.g;
      segColObj.col[0][2] = rgb.b;
      segColObj.col[0][3] = rgb.w;
    } else if (colCtlMode == "col2") {
      this.setCapabilityValue('col2r', rgb.r);
      this.setCapabilityValue('col2g', rgb.g);
      this.setCapabilityValue('col2b', rgb.b);
      this.setCapabilityValue('col2w', rgb.w);
      segColObj.col[1][0] = rgb.r;
      segColObj.col[1][1] = rgb.g;
      segColObj.col[1][2] = rgb.b;
      segColObj.col[1][3] = rgb.w;
    } else if (colCtlMode == "col3") {
      this.setCapabilityValue('col3r', rgb.r);
      this.setCapabilityValue('col3g', rgb.g);
      this.setCapabilityValue('col3b', rgb.b);
      this.setCapabilityValue('col3w', rgb.w);
      segColObj.col[2][0] = rgb.r;
      segColObj.col[2][1] = rgb.g;
      segColObj.col[2][2] = rgb.b;
      segColObj.col[2][3] = rgb.w;
    }
    this.api.SetMainColors(this.LastDataRaw, segColObj);
    return Promise.resolve();
  }

  async onCapabilityDim(dim, opts) {
    var newDim = this.homey.app.MapScale(0, 1, 0, 255, dim);
    newDim = newDim.toFixed(0);
    this.log('onCapabilityDim:', newDim);
    this.api.SetBrightness(newDim);
    return Promise.resolve();
  } //onCapabilityDim

  async onCapabilityOnOff(value, opts) {
    this.log('onOff:', value);
    this.api.SetOnOff(value);
    return Promise.resolve();
  } //onCapabilityOnoff

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('WLED has been added.');
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
    this.log('WLED settings where changed.');
    this.log('New Settings:', newSettings);
    this.log('Updated Settings Keys:', changedKeys);
    if (changedKeys.includes('commonTransitionDuration')) {
      this.api.SetCommonTransition(newSettings.commonTransitionDuration);
    }
    var nlObj = {};
    var nlUpd = false;
    if (changedKeys.includes('nightlightBrightness')) {
      nlObj.tbri = newSettings.nightlightBrightness;
      nlUpd = true;
    }
    if (changedKeys.includes('nightlightDuration')) {
      nlObj.dur = newSettings.nightlightDuration;
      nlUpd = true;
    }
    if (changedKeys.includes('nightlightMode')) {
      if (newSettings.nightlightMode == 'instant') nlObj.mode = 0;
      if (newSettings.nightlightMode == 'fade') nlObj.mode = 1;
      if (newSettings.nightlightMode == 'colorFade') nlObj.mode = 2;
      if (newSettings.nightlightMode == 'sunrise') nlObj.mode = 3;
      nlUpd = true;
    }
    if (nlUpd === true) {
      this.api.SetNewNightlightSettings(nlObj);
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('WLED was renamed to:', name);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    if (this.PongTimeout != null && this.PongTimeout) {
      clearTimeout(this.PongTimeout);
      this.PongTimeout = null;
    }
    this.log('WLED has been deleted.');
  }

  onDiscoveryResult(discoveryResult) {
    // Return a truthy value here if the discovery result matches your device.
    return discoveryResult.id === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult) {
    // This method will be executed once when the device has been found (onDiscoveryResult returned true)
    this.log('Device Discovered:', discoveryResult.address);
    this.api = new WLED(discoveryResult.address);
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
      device.log('GetStatus Segments:', data.state.seg);
      device.LastDataRaw = data;
      var currentDim = this.homey.app.MapScale(0, 255, 0, 1, data.state.bri);
      var currentSectionsCount = data.state.seg.length;
      device.FirmwareVersion = data.info.ver;
      // Check for minimum fw version
      var firmwareUpToDate = this.homey.app.VersionSatisfiesMinimum('0.11.1', device.FirmwareVersion);
      if (firmwareUpToDate === false) {
        device.setWarning(device.homey.__('wled.unsupFw'));
      } else {
        device.unsetWarning();
      }
      var areWeOn = device.getAvailable();
      if (areWeOn === false) {
        await device.setAvailable().catch(device.error);
      }
      // Always update color parameters for first segment to the main control UI
      // Map first section to main color parameter capabilities
      device.setCapabilityValue('col1r', data.state.seg[0].col[0][0]);
      device.setCapabilityValue('col1g', data.state.seg[0].col[0][1]);
      device.setCapabilityValue('col1b', data.state.seg[0].col[0][2]);
      if (data.state.seg[0].col[0][3]) device.setCapabilityValue('col1w', data.state.seg[0].col[0][3]);
      device.setCapabilityValue('col2r', data.state.seg[0].col[1][0]);
      device.setCapabilityValue('col2g', data.state.seg[0].col[1][1]);
      device.setCapabilityValue('col2b', data.state.seg[0].col[1][2]);
      if (data.state.seg[0].col[1][3]) device.setCapabilityValue('col2w', data.state.seg[0].col[1][3]);
      device.setCapabilityValue('col3r', data.state.seg[0].col[2][0]);
      device.setCapabilityValue('col3g', data.state.seg[0].col[2][1]);
      device.setCapabilityValue('col3b', data.state.seg[0].col[2][2]);
      if (data.state.seg[0].col[2][3]) device.setCapabilityValue('col3w', data.state.seg[0].col[2][3]);
      // Detect Restart
      if (areWeOn != device.WeBeenOn) {
        device.WeBeenOn = areWeOn;
        // Check up on device settings after restart..
        const settings = device.getSettings();
        const currentNumOfPixels = parseInt(data.info.leds.count);
        // Add color mode and move to restart handler to reduce load
        if (settings.pixelsCount != currentNumOfPixels || settings.sectionsCount != currentSectionsCount) {
          device.setSettings({
            pixelsCount: currentNumOfPixels,
            sectionsCount: currentSectionsCount
          }).catch(device.error);
        }
        // Check whether to restore the light settings..
        //TODO: LOW: Add restore effect configuration too?
        if (settings.restoreLightOnRestart === true) {
          var oldOnOff = await device.getCapabilityValue('onoff');
          device.onCapabilityOnOff(oldOnOff);
          var oldDim = await device.getCapabilityValue('dim');
          var newDim = device.homey.app.MapScale(0, 1, 0, 255, oldDim);
          newDim = newDim.toFixed(0);
          this.api.SetBrightness(newDim);
          // Restore colors
          var col1r = await device.getCapabilityValue('col1r');
          var col1g = await device.getCapabilityValue('col1g');
          var col1b = await device.getCapabilityValue('col1b');
          var col1w = await device.getCapabilityValue('col1w');
          var col2r = await device.getCapabilityValue('col2r');
          var col2g = await device.getCapabilityValue('col2g');
          var col2b = await device.getCapabilityValue('col2b');
          var col2w = await device.getCapabilityValue('col2w');
          var col3r = await device.getCapabilityValue('col3r');
          var col3g = await device.getCapabilityValue('col3g');
          var col3b = await device.getCapabilityValue('col3b');
          var col3w = await device.getCapabilityValue('col3w');
          var segColObj = {
            "col": [
              [parseInt(col1r), parseInt(col1g), parseInt(col1b), parseInt(col1w)],
              [parseInt(col2r), parseInt(col2g), parseInt(col2b), parseInt(col2w)],
              [parseInt(col3r), parseInt(col3g), parseInt(col3b), parseInt(col3w)]
            ]
          };
          device.api.SetMainColors(device.LastDataRaw, segColObj);
        }
        var colCtlMode = await device.getCapabilityValue('control_mode');
        // init control mode
        if (colCtlMode != "col1" && colCtlMode != "col2" && colCtlMode != "col3") {
          colCtlMode = "col1";
          device.setCapabilityValue('control_mode', colCtlMode);
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
        if (oldOnOff !== data.state.on) {
          device.setCapabilityValue('onoff', data.state.on);
        }
      }
      // Update device settings if new on device..
      var settings = device.getSettings();
      if (settings.commonTransitionDuration !== data.state.transition) {
        device.setSettings({
          commonTransitionDuration: data.state.transition
        }).catch(device.error);
      }
      var nlOnOffOld = await device.getCapabilityValue('nightlight');
      if (nlOnOffOld != data.state.nl.on) device.setCapabilityValue('nightlight', data.state.nl.on);
    }).catch((err) => {
      device.log('GetStatus failed:', err);
      var areWeOn = device.getAvailable();
      if (areWeOn === true) {
        device.WeBeenOn = false;
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

module.exports = WLED_Device;
