'use strict';

const Homey = require('homey');

class WLED_Driver extends Homey.Driver {
  async onInit() {
    this.log('WLED Driver has been initialized.');
  }
  onPair(socket) {
    let theDriver = this;
    socket.setHandler("list_devices", function (data) {
      theDriver.log('WLED Driver starting pairing..');
      const discoveryStrategy = theDriver.getDiscoveryStrategy();
      const discoveryResults = discoveryStrategy.getDiscoveryResults();
      const devices = Object.values(discoveryResults).map(discoveryResult => {
        theDriver.log('WLED Device discovered: ', discoveryResult.id);
        return {
          name: `WLED ${discoveryResult.id.toUpperCase()}`,
          data: {
            id: discoveryResult.id,
            rev: 'wled'
          }
        };
      });
      theDriver.log('WLED Driver discovery finished: ', devices);
      return devices;
    });
  } //onPair
}

module.exports = WLED_Driver;