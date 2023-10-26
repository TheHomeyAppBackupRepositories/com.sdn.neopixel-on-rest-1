module.exports = {
  async configuration({ homey, body, params, query }) {
    homey.app.log('APP API:', params);
    if (params.cmd == 'getDevices') {
      var deviceIndex = homey.app.__getAllDevicesIndex();
      homey.app.log('APP API getDevices:', deviceIndex);
      return deviceIndex;
    } else if (params.cmd == 'getLedConfig') {
      var ledIndex = homey.app.__getLedIndexOfDevice(body.deviceID);
      homey.app.log('APP API getLedConfig:', ledIndex);
      return ledIndex;
    } else if (params.cmd == 'saveLedConfig') {
      var ledIndex = homey.app.__saveLedIndexOfDevice(body.deviceID, body.newLedData);
      return {};
    } else {
      return Promise.reject('Unknown API Command!');
    }
  }
}
