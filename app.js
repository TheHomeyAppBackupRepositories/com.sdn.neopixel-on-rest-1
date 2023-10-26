'use strict';

const Homey = require('homey');
const FileSys = require('fs');
const CurrentlyNewestFirmware = '3.1.3';

class NeoPixelOnRestApp extends Homey.App {

  saveData(data, filename) {
    try {
      this.homey.app.log('Storing:', filename);
      FileSys.writeFileSync(`/userdata/${filename}`, JSON.stringify(data), 'utf-8');
    }
    catch (err) {
      this.homey.app.error('saveData Failed:', err);
    }
  }

  loadData(filename) {
    let stringData = '';
    try {
      stringData = FileSys.readFileSync(`/userdata/${filename}`, 'utf-8');
      let data = JSON.parse(stringData);
      this.homey.app.log('Loaded:', filename);
      return data;
    }
    catch (err) {
      this.homey.app.error('loadData Failed:', err);
      return null;
    }
  }

  existsData(filename) {
    var isThere = false;
    try {
      if (FileSys.existsSync(`/userdata/${filename}`)) {
        isThere = true;
        this.homey.app.log('Found:', filename);
      } else {
        this.homey.app.log('Not Found:', filename);
      }
    }
    catch (err) {
      this.homey.app.error('Error Finding:', err);
    }
    return isThere;
  }

  deleteData(filename) {
    try {
      FileSys.unlinkSync(`/userdata/${filename}`);
      this.homey.app.log('Deleted:', filename);
    }
    catch (err) {
      this.homey.app.error('Error Deleting:', err);
    }
  }

  __saveLedIndexOfDevice(deviceId, ledData) {
    this.saveData(ledData, deviceId);
  }

  __getLedListForDevice(theDevice) {
    var deviceData = theDevice.getData();
    var deviceConfig = {};
    if (this.existsData(`${deviceData.id.toUpperCase()}`) === true) {
      deviceConfig = this.loadData(`${deviceData.id.toUpperCase()}`);
    }
    var availableLEDs = [
      {
        name: this.homey.__('allLEDsLabel'),
        led: -1
      }
    ];
    const settings = theDevice.getSettings();
    for (var i = 0; i < settings.pixelsCount; i++) {
      var ledDisplayName = `# ${(i + 1)}`;
      if (deviceConfig.hasOwnProperty(`${i}`)) {
        ledDisplayName = deviceConfig[`${i}`].label;
      }
      availableLEDs.push({
        name: ledDisplayName,
        led: i
      });
    }
    return availableLEDs;
  }

  __getAllDevicesIndex() {
    var deviceIndex = {};
    var drivers = this.homey.drivers.getDrivers();
    for (const [key, driver] of Object.entries(drivers)) {
      let theDevices = driver.getDevices();
      for (var i = 0; i < theDevices.length; i++) {
        let deviceData = theDevices[i].getData();
        if (deviceData.rev == 'wled') continue; // exclude wled for now
        let deviceId = `${deviceData.id.toUpperCase()}`;
        let newDevice = {
          name: theDevices[i].getName(),
          id: deviceId
        }
        // Skip dublicates
        if (deviceIndex.hasOwnProperty(deviceId) === false) {
          deviceIndex[deviceId] = newDevice;
        }
      }
    }
    return deviceIndex;
  }

  __getDeviceById(theId) {
    var myDevice = null;
    var drivers = this.homey.drivers.getDrivers();
    for (const [key, driver] of Object.entries(drivers)) {
      let theDevices = driver.getDevices();
      for (var i = 0; i < theDevices.length; i++) {
        let deviceData = theDevices[i].getData();
        let deviceId = `${deviceData.id.toUpperCase()}`;
        if (deviceId == theId) {
          myDevice = theDevices[i];
          break;
        }
      }
      if (myDevice != null) break;
    }
    return myDevice;
  }

  __getLedIndexOfDevice(deviceId) {
    var theDevice = this.__getDeviceById(deviceId);
    var deviceData = theDevice.getData();
    var deviceSettings = theDevice.getSettings();
    var deviceConfig = {};
    if (this.existsData(`${deviceData.id.toUpperCase()}`) === true) {
      deviceConfig = this.loadData(`${deviceData.id.toUpperCase()}`);
    }
    return {
      "deviceConfig": deviceConfig,
      "ledCount": deviceSettings.pixelsCount
    };
  }

  __getWledSectionListForDevice(theDevice) {
    var availableSegs = [
      {
        name: this.homey.__('wled.allSeg'),
        segId: -1
      }
    ];
    var segIdx = -1;
    theDevice.LastDataRaw.state.seg.forEach(element => {
      segIdx++;
      availableSegs.push({
        name: `#${segIdx}`,
        segId: segIdx
      });
    });
    return availableSegs;
  }

  __getWledPropIndex(arrField, theDevice, addRandomOption) {
    var availableElems = [];
    var elemIdx = -1;
    theDevice.LastDataRaw[arrField].forEach(element => {
      elemIdx++;
      availableElems.push({
        name: element,
        elemIdx: elemIdx
      });
    });
    if (addRandomOption && addRandomOption === true) {
      availableElems.push({
        name: this.homey.__('wled.random'),
        elemIdx: -99
      });
    }
    return availableElems;
  }

  async onInit() {
    let actionCard_set_preset = this.homey.flow.getActionCard('set_preset')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        args.my_device.api.SetPreset(args.preset);
        return Promise.resolve();
      });
    let actionCard_set_nightlight = this.homey.flow.getActionCard('set_nightlight')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var onOff = false;
        if (args.onoff == 'ON') onOff = true;
        args.my_device.api.SetNewNightlightSettings({ on: onOff });
        return args.my_device.setCapabilityValue('nightlight', onOff);
      });
    let actionCard_set_nightlight_adv = this.homey.flow.getActionCard('set_nightlight_adv')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var onOff = false;
        if (args.onoff == 'ON') onOff = true;
        var nlObj = {
          on: onOff,
          dur: args.dur,
          mode: 0,
          tbri: args.bri
        }
        if (args.mode == 'instant') nlObj.mode = 0;
        if (args.mode == 'fade') nlObj.mode = 1;
        if (args.mode == 'colorFade') nlObj.mode = 2;
        if (args.mode == 'sunrise') nlObj.mode = 3;
        args.my_device.api.SetNewNightlightSettings(nlObj);
        return args.my_device.setCapabilityValue('nightlight', onOff);
      });
    let actionCard_set_color_control_mode = this.homey.flow.getActionCard('set_color_control_mode')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        return args.my_device.setCapabilityValue('control_mode', args.mode);
      });
    let actionCard_set_wled_colors = this.homey.flow.getActionCard('set_wled_colors')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        // Prepare seg object
        var rgb1 = this.homey.app.Convert_rgbHexToRgbNum(args.col1);
        var rgb2 = this.homey.app.Convert_rgbHexToRgbNum(args.col2);
        var rgb3 = this.homey.app.Convert_rgbHexToRgbNum(args.col3);
        var segColObj = {
          "col": [
            [parseInt(rgb1.r), parseInt(rgb1.g), parseInt(rgb1.b), 0],
            [parseInt(rgb2.r), parseInt(rgb2.g), parseInt(rgb2.b), 0],
            [parseInt(rgb3.r), parseInt(rgb3.g), parseInt(rgb3.b), 0]
          ]
        };
        args.my_device.setCapabilityValue('col1r', rgb1.r);
        args.my_device.setCapabilityValue('col1g', rgb1.g);
        args.my_device.setCapabilityValue('col1b', rgb1.b);
        args.my_device.setCapabilityValue('col1w', 0);
        args.my_device.setCapabilityValue('col2r', rgb2.r);
        args.my_device.setCapabilityValue('col2g', rgb2.g);
        args.my_device.setCapabilityValue('col2b', rgb2.b);
        args.my_device.setCapabilityValue('col2w', 0);
        args.my_device.setCapabilityValue('col3r', rgb3.r);
        args.my_device.setCapabilityValue('col3g', rgb3.g);
        args.my_device.setCapabilityValue('col3b', rgb3.b);
        args.my_device.setCapabilityValue('col3w', 0);
        if (args.my_device.api == null) return Promise.reject();
        if (args.seg.segId == -1) {
          args.my_device.api.SetMainColors(args.my_device.LastDataRaw, segColObj);
        } else {
          args.my_device.api.SetSegColors(args.my_device.LastDataRaw, segColObj, args.seg.segId);
        }
        return Promise.resolve();
      });
    actionCard_set_wled_colors.getArgument('seg')
      .registerAutocompleteListener(async (query, args) => {
        if (args.my_device.api == null) {
          args.my_device.log('actionCard_set_wled_colors getList: NO API');
          return Promise.reject();
        }
        var segList = this.homey.app.__getWledSectionListForDevice(args.my_device);
        args.my_device.log('actionCard_set_wled_colors getList:', segList);
        return Promise.resolve(segList);
      });
    let actionCard_set_wled_effect = this.homey.flow.getActionCard('set_wled_effect')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var dir = false;
        var mi = false;
        if (args.direction == 'BACKWARD') dir = true;
        if (args.mirror == 'YES') mi = true;
        var idxEffect = args.effect.elemIdx;
        var idxPalette = args.palette.elemIdx;
        if (args.effect.elemIdx == -99) {
          // random mode
          var eleList = this.homey.app.__getWledPropIndex('effects', args.my_device);
          idxEffect = this.homey.app.GetRandomInteger(0, eleList.length);
        }
        if (args.palette.elemIdx == -99) {
          // random mode
          var eleList = this.homey.app.__getWledPropIndex('palettes', args.my_device);
          idxPalette = this.homey.app.GetRandomInteger(0, eleList.length);
        }
        args.my_device.api.SetSegEffect(args.my_device.LastDataRaw, args.seg.segId, idxEffect, idxPalette, args.sx, args.ix, dir, mi)
        return Promise.resolve();
      });
    actionCard_set_wled_effect.getArgument('seg')
      .registerAutocompleteListener(async (query, args) => {
        if (args.my_device.api == null) {
          args.my_device.log('set_wled_effect getList seg: NO API');
          return Promise.reject();
        }
        var segList = this.homey.app.__getWledSectionListForDevice(args.my_device);
        args.my_device.log('set_wled_effect getList seg:', segList);
        return Promise.resolve(segList);
      });
    actionCard_set_wled_effect.getArgument('effect')
      .registerAutocompleteListener(async (query, args) => {
        if (args.my_device.api == null) {
          args.my_device.log('set_wled_effect getList effect: NO API');
          return Promise.reject();
        }
        var eleList = this.homey.app.__getWledPropIndex('effects', args.my_device, true);
        args.my_device.log('set_wled_effect getList effect:', eleList);
        return Promise.resolve(eleList);
      });
    actionCard_set_wled_effect.getArgument('palette')
      .registerAutocompleteListener(async (query, args) => {
        if (args.my_device.api == null) {
          args.my_device.log('set_wled_effect getList palette: NO API');
          return Promise.reject();
        }
        var eleList = this.homey.app.__getWledPropIndex('palettes', args.my_device, true);
        args.my_device.log('set_wled_effect getList palette:', eleList);
        return Promise.resolve(eleList);
      });
    let actionCard_set_pixel_color = this.homey.flow.getActionCard('set_pixel_color')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var rgbOb = this.homey.app.Convert_rgbHexToRgbNum(args.pixel_color);
        args.my_device.api.SetColor(args.led.led, rgbOb.r, rgbOb.g, rgbOb.b, 0);
        return Promise.resolve();
      });
    actionCard_set_pixel_color.getArgument('led')
      .registerAutocompleteListener(async (query, args) => {
        var availableLEDs = this.homey.app.__getLedListForDevice(args.my_device);
        return Promise.resolve(availableLEDs);
      });
    let actionCard_set_pixel_color_hex = this.homey.flow.getActionCard('set_pixel_color_hex')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var cleanHex = args.pixel_color.trim();
        var rgbOb = this.homey.app.Convert_rgbHexToRgbNum(cleanHex);
        args.my_device.api.SetColor(args.led.led, rgbOb.r, rgbOb.g, rgbOb.b, 0);
        return Promise.resolve();
      });
    actionCard_set_pixel_color_hex.getArgument('led')
      .registerAutocompleteListener(async (query, args) => {
        var availableLEDs = this.homey.app.__getLedListForDevice(args.my_device);
        return Promise.resolve(availableLEDs);
      });
    let actionCard_set_pixel_effect = this.homey.flow.getActionCard('set_pixel_effect')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var cleanHex = args.pixel_color_start.trim();
        var cleanHexEnd = args.pixel_color_end.trim();
        var rgbOb = this.homey.app.Convert_rgbHexToRgbNum(cleanHex);
        var rgbObE = this.homey.app.Convert_rgbHexToRgbNum(cleanHexEnd);
        var effectId = parseInt(args.effect);
        args.my_device.api.SetAnimation(args.led.led, effectId, rgbOb.r, rgbOb.g, rgbOb.b, 0, rgbObE.r, rgbObE.g, rgbObE.b, 0, args.effect_speed);
        return Promise.resolve();
      });
    actionCard_set_pixel_effect.getArgument('led')
      .registerAutocompleteListener(async (query, args) => {
        var availableLEDs = this.homey.app.__getLedListForDevice(args.my_device);
        return Promise.resolve(availableLEDs);
      });
    let actionCard_set_pixel_effect_hex = this.homey.flow.getActionCard('set_pixel_effect_hex')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var cleanHex = args.pixel_color_start.trim();
        var cleanHexEnd = args.pixel_color_end.trim();
        var rgbOb = this.homey.app.Convert_rgbHexToRgbNum(cleanHex);
        var rgbObE = this.homey.app.Convert_rgbHexToRgbNum(cleanHexEnd);
        var effectId = parseInt(args.effect);
        args.my_device.api.SetAnimation(args.led.led, effectId, rgbOb.r, rgbOb.g, rgbOb.b, 0, rgbObE.r, rgbObE.g, rgbObE.b, 0, args.effect_speed);
        return Promise.resolve();
      });
    actionCard_set_pixel_effect_hex.getArgument('led')
      .registerAutocompleteListener(async (query, args) => {
        var availableLEDs = this.homey.app.__getLedListForDevice(args.my_device);
        return Promise.resolve(availableLEDs);
      });
    let actionCard_set_strip_effect_rotation_start = this.homey.flow.getActionCard('set_strip_effect_rotation_start')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        args.my_device.api.SetRotationAnimation(args.direction, args.effect_speed);
        return Promise.resolve();
      });
    let actionCard_set_strip_effect_arrow_start = this.homey.flow.getActionCard('set_strip_effect_arrow_start')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        var cleanHex = args.pixel_color.trim();
        var rgbOb = this.homey.app.Convert_rgbHexToRgbNum(cleanHex);
        args.my_device.api.SetArrowAnimation(args.direction, args.bouncy, rgbOb.r, rgbOb.g, rgbOb.b, 0, args.effect_speed);
        return Promise.resolve();
      });
    let actionCard_set_strip_effect_rotation_stop = this.homey.flow.getActionCard('set_strip_effect_rotation_stop')
      .registerRunListener(async args => {
        if (args.my_device.api == null) return Promise.reject();
        args.my_device.api.SetRotationAnimation('0', '0');
        return Promise.resolve();
      });
    this.Trigger_DeviceRestarted = this.homey.flow.getDeviceTriggerCard('device_restarted');
    this.log('Neopixel On Rest app has been initialized.');
  }

  IsDeviceOnLatestFirmware(deviceFirmwareVersion) {
    return this.VersionSatisfiesMinimum(CurrentlyNewestFirmware, deviceFirmwareVersion);
  }

  /**
   * Converts hsb data to rgb object.
   * @param {number} hue Hue [0 - 1]
   * @param {number} sat Saturation [0 - 1]
   * @param {number} dim Brightness [0 - 1]
   * @returns {object} RGB object. [0 - 255] 
   */
  Convert_hsbToRgb(hue, sat, dim) {
    var red, green, blue;
    var i = Math.floor(hue * 6);
    var f = hue * 6 - i;
    var p = dim * (1 - sat);
    var q = dim * (1 - f * sat);
    var t = dim * (1 - (1 - f) * sat);
    switch (i % 6) {
      case 0: red = dim, green = t, blue = p; break;
      case 1: red = q, green = dim, blue = p; break;
      case 2: red = p, green = dim, blue = t; break;
      case 3: red = p, green = q, blue = dim; break;
      case 4: red = t, green = p, blue = dim; break;
      case 5: red = dim, green = p, blue = q; break;
    }
    return { r: red * 255, g: green * 255, b: blue * 255 };
  }

  /**
  * Converts an rgb hex code to numeric rgb values.
  * @param {string} hex RGB hex code: #rrggbb
  * @returns {object} RGB object.
  */
  Convert_rgbHexToRgbNum(hex) {
    var r = parseInt(hex.substr(1, 2), 16);
    var g = parseInt(hex.substr(3, 2), 16);
    var b = parseInt(hex.substr(5, 2), 16);
    return { r: r, g: g, b: b };
  }

  /**
  * Converts numeric RGB to HSB object.
  * @param {number} red Red 0-255
  * @param {number} green Green 0-255
  * @param {number} blue Blue 0-255
  * @returns {object} HSB object: 0 - 1
  */
  Convert_rgbToHsb(red, green, blue) {
    red /= 255, green /= 255, blue /= 255;
    var max = Math.max(red, green, blue), min = Math.min(red, green, blue);
    var hue, sat, dim = max;
    var x = max - min;
    sat = max == 0 ? 0 : x / max;
    if (max == min) {
      hue = 0; // achromatic
    } else {
      switch (max) {
        case red: hue = (green - blue) / x + (green < blue ? 6 : 0); break;
        case green: hue = (blue - red) / x + 2; break;
        case blue: hue = (red - green) / x + 4; break;
      }
      hue /= 6;
    }
    return { h: hue, s: sat, b: dim }
  }
  MapScale(input_scale_start, input_scale_end, output_scale_start, output_scale_end, value) {
    return output_scale_start + ((output_scale_end - output_scale_start) / (input_scale_end - input_scale_start)) * (value - input_scale_start);
  }

  /**
    * Returns true if the minimum version requirement is met.
    * @param {string} versionMin Mimium version we want.
    * @param {string} versionToCheck The version to check against the minimum.
    * @returns {boolean} true if the minimum version requirement is met. false if not.
    */
  VersionSatisfiesMinimum(versionMin, versionToCheck) {
    var vMinArr = versionMin.split('.');
    var vChkArr = versionToCheck.split('.');
    if (parseInt(vChkArr[0]) > parseInt(vMinArr[0])) return true;
    if (parseInt(vChkArr[0]) == parseInt(vMinArr[0])) {
      if (parseInt(vChkArr[1]) > parseInt(vMinArr[1])) return true;
      if (parseInt(vChkArr[1]) == parseInt(vMinArr[1])) {
        if (parseInt(vChkArr[2]) >= parseInt(vMinArr[2])) return true;
      }
    }
    return false;
  }

  /**
   * Generates a pseudo random number.
   * @param {*} min Minimum integer.
   * @param {*} max Maximum integer (exclusive).
   * @returns Random integer number.
   */
  GetRandomInteger(min, max) {
    var result = Math.random() * (max - min) + min
    return Math.floor(result);
  }

}

module.exports = NeoPixelOnRestApp;