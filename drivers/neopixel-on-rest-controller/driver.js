'use strict';

const Homey = require('homey');

class NPOR_Driver extends Homey.Driver {
  async onInit() {
    this.log('Neopixel On Rest Driver has been initialized.');
  }
  onPair(socket) {
    let theDriver = this;
    socket.setHandler("list_devices", function (data) {
      theDriver.log('Neopixel On Rest Driver starting pairing..');
      const discoveryStrategy = theDriver.getDiscoveryStrategy();
      const discoveryResults = discoveryStrategy.getDiscoveryResults();
      const devices = Object.values(discoveryResults).map(discoveryResult => {
        theDriver.log('Neopixel On Rest Driver discovered: ', discoveryResult.id);
        return {
          name: `Neopixel On Rest ${discoveryResult.id.toUpperCase()}`,
          data: {
            id: discoveryResult.id,
            rev: 'npor3'
          }
        };
      });
      theDriver.log('Neopixel On Rest Driver discovery finished: ', devices);
      return devices;
    });
  } //onPair
}

module.exports = NPOR_Driver;