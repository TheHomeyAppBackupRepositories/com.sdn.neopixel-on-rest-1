'use strict';

const Fetch = require('node-fetch');

const DriversMap = [
    {
        label: "WS2812",
        id: "0"
    },
    {
        label: "TM1803",
        id: "1"
    },
    {
        label: "SK6812RGBW",
        id: "2"
    },
    {
        label: "TM1829",
        id: "3"
    },
    {
        label: "WS2812B",
        id: "4"
    },
    {
        label: "WS2812B2",
        id: "5"
    },
    {
        label: "WS2811",
        id: "6"
    },
    {
        label: "WS2812B_FAST",
        id: "7"
    },
    {
        label: "WS2812B2_FAST",
        id: "8"
    }
];

class NPOR {

    constructor(address) {
        this.__deviceAddress = address;
    }

    __getDriverIdFromName(name) {
        var result = null;
        DriversMap.forEach(driver => {
            if (driver.label == name) result = driver.id;
        });
        return result;
    }

    __getDriverNameFromId(id) {
        var result = null;
        DriversMap.forEach(driver => {
            if (driver.id == id) result = driver.name;
        });
        return result;
    }

    async __sendGetCmd(fullUrl) {
        console.log('REST API CALL:', fullUrl);
        var success = true;
        const headers = {
            "Content-Type": "text/html"
        };
        try {
            await Fetch(fullUrl, { method: 'GET', headers: headers, body: null })
        } catch (err) {
            success = false;
        }
        return Promise.resolve(success);
    }

    async _fetchTimeouted(url, options, timeout = 8000) {
        return Promise.race([
            Fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    }

    async _httpQuery(method, url, headers, body, returnRawData) {
        console.log('REST API CALL:', url);
        // make request
        let response;
        let returnableResult = null;
        await this._fetchTimeouted(url, { method: method, headers: headers, body: body })
            .then(resp => {
                response = resp;
            })
            .catch(error => {
                returnableResult = Promise.reject(new Error(error));
            });
        if (returnableResult != null) {
            return returnableResult;
        }
        await response.text()
            .then(dataBody => {
                if (returnRawData === true) return dataBody;
                let responseJSON = JSON.parse(dataBody);
                if (returnableResult == null) returnableResult = Promise.resolve(responseJSON);
            })
            .catch(err => {
                returnableResult = err;
            });
        return returnableResult;
    }

    UpdateAddress(address) {
        this.__deviceAddress = address;
    }

    async GetStatus() {
        var respData = null;
        await this._httpQuery('GET', `http://${this.__deviceAddress}/sta`).then((data) => {
            respData = Promise.resolve(data);
        }).catch((err) => {
            respData = Promise.reject(err);
        });
        return respData;
    }

    async SetDeviceConfiguration(driver, pixels, colorMode, selftestEndabled) {
        var respData = true;
        await this._httpQuery('GET', `http://${this.__deviceAddress}/cfg/${pixels}/${driver}/${colorMode}/${selftestEndabled}`).then((data) => {
            // NOP
        }).catch((err) => {
            respData = false;
        });
        return respData;
    }

    __calculateRgbFromKelvin(kelvin) {
        var rgbObj = {
            r: 0,
            g: 0,
            b: 0
        }
        // Hardlimit Range
        if (kelvin < 1000) kelvin = 1000;
        if (kelvin > 40000) kelvin = 40000;
        kelvin = kelvin / 100;
        // Appox red component
        if (kelvin <= 66) {
            rgbObj.r = 255;
        } else {
            var tmp = kelvin - 60;
            rgbObj.r = 329.698727446 * (tmp ^ -0.1332047592);
            if (rgbObj.r < 0) rgbObj.r = 0;
            if (rgbObj.r > 255) rgbObj.r = 255;
        }
        // Approx green component
        if (kelvin <= 66) {
            rgbObj.g = 99.4708025861 * Math.log(kelvin) - 161.1195681661;
            if (rgbObj.g < 0) rgbObj.g = 0;
            if (rgbObj.g > 255) rgbObj.g = 255;
        } else {
            var tmp = kelvin - 60;
            rgbObj.g = 288.1221695283 * (tmp ^ -0.0755148492);
            if (rgbObj.g < 0) rgbObj.g = 0;
            if (rgbObj.g > 255) rgbObj.g = 255;
        }
        // Appox blue component
        if (kelvin >= 66) {
            rgbObj.b = 255;
        } else if (kelvin <= 19) {
            rgbObj.b = 0;
        } else {
            var tmp = kelvin - 10;
            rgbObj.b = 138.5177312231 * Math.log(tmp) - 305.0447927307;
            if (rgbObj.b < 0) rgbObj.b = 0;
            if (rgbObj.b > 255) rgbObj.b = 255;
        }
        // Sanitize RGB Object
        rgbObj.r = rgbObj.r.toFixed(0);
        rgbObj.g = rgbObj.g.toFixed(0);
        rgbObj.b = rgbObj.b.toFixed(0);
        return rgbObj;
    }

    async SetKelvin(ledIndex, kelvin) {
        var rgbObj = this.__calculateRgbFromKelvin(kelvin);
        var red = rgbObj.r;
        var green = rgbObj.g;
        var blue = rgbObj.b;
        var white = 0;
        return this.__sendGetCmd(`http://${this.__deviceAddress}/set/${ledIndex.toString()}/${red.toString()}/${green.toString()}/${blue.toString()}/${white.toString()}`);
    }

    async SetColor(ledIndex, red, green, blue, white) {
        return this.__sendGetCmd(`http://${this.__deviceAddress}/set/${ledIndex.toString()}/${red.toString()}/${green.toString()}/${blue.toString()}/${white.toString()}`);
    }

    async SetBrightness(level) {
        return this.__sendGetCmd(`http://${this.__deviceAddress}/dim/${level.toString()}`);
    }

    async SetAnimation(ledIndex, animationType, red, green, blue, white, redEnd, greenEnd, blueEnd, whiteEnd, speed) {
        return this.__sendGetCmd(`http://${this.__deviceAddress}/ani/${ledIndex.toString()}/${animationType.toString()}/${red.toString()}/${green.toString()}/${blue.toString()}/${white.toString()}/${redEnd.toString()}/${greenEnd.toString()}/${blueEnd.toString()}/${whiteEnd.toString()}/${speed.toString()}`);
    }

    async SetRotationAnimation(cmd, speed) {
        return this.__sendGetCmd(`http://${this.__deviceAddress}/rot/${cmd.toString()}/${speed.toString()}`);
    }

    async SetArrowAnimation(cmd, bouncy, red, green, blue, white, speed) {
        return this.__sendGetCmd(`http://${this.__deviceAddress}/arr/${cmd.toString()}/${bouncy.toString()}/${red.toString()}/${green.toString()}/${blue.toString()}/${white.toString()}/${speed.toString()}`);
    }
}

module.exports = NPOR;