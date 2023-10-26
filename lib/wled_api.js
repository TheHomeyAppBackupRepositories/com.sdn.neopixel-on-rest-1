'use strict';

const Fetch = require('node-fetch');
const WebSocket = require('ws');

class WLED {

    constructor(address) {
        this.__deviceAddress = address;
        this.__websocket = null;
    }

    async __sendGetCmd(fullUrl, body) {
        if (!body) {
            body = null;
        } else {
            body = JSON.stringify(body);
        }
        console.log('WLED API CALL:', fullUrl, body);
        var success = true;
        const headers = {
            "Content-Type": "application/json"
        };
        try {
            await Fetch(fullUrl, { method: 'POST', headers: headers, body: body });
        } catch (err) {
            console.log('WLED API CALL ERROR:', err);
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
        await this._httpQuery('GET', `http://${this.__deviceAddress}/json`).then((data) => {
            respData = Promise.resolve(data);
        }).catch((err) => {
            respData = Promise.reject(err);
        });
        return respData;
    }

    //TODO: async SetDeviceConfiguration(driver, pixels, colorMode, selftestEndabled) {
    /*var respData = true;
    await this._httpQuery('GET', `http://${this.__deviceAddress}/cfg/${pixels}/${driver}/${colorMode}/${selftestEndabled}`).then((data) => {
        // NOP
    }).catch((err) => {
        respData = false;
    });
    return respData;
}*/

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

    __getColorBodyForAllSections(rawDeviceState, colorObj) {
        var segBody = [];
        rawDeviceState.state.seg.forEach(element => {
            segBody.push(colorObj);
        });
        return segBody;
    }

    /*async SetKelvin(rawDeviceState, ledIndex, kelvin) {
        if (rawDeviceState == null) return;
        var rgbObj = this.__calculateRgbFromKelvin(kelvin);
        var red = rgbObj.r;
        var green = rgbObj.g;
        var blue = rgbObj.b;
        var white = 0;
        var segColArr = this.__getColorBodyForAllSections(rawDeviceState, red, green, blue, white);
        var setAllLedsObj = {
            seg: segColArr
        };
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, setAllLedsObj);
    }

    async SetColor(rawDeviceState, ledIndex, red, green, blue, white) {
        if (rawDeviceState == null) return;
        var segColArr = this.__getColorBodyForAllSections(rawDeviceState, red, green, blue, white);
        var setAllLedsObj = {
            seg: segColArr
        };
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, setAllLedsObj);
    }*/

    async SetMainColors(rawDeviceState, colorObj) {
        if (rawDeviceState == null) return;
        var segColArr = this.__getColorBodyForAllSections(rawDeviceState, colorObj);
        var setAllLedsObj = {
            seg: segColArr
        };
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, setAllLedsObj);
    }

    async SetSegColors(rawDeviceState, colorObj, segId) {
        if (rawDeviceState == null) return;
        colorObj.id = segId;
        var segArr = [
            colorObj
        ];
        var body = {
            seg: segArr
        };
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
    }

    async SetSegEffect(rawDeviceState, segId, effect, palette, speed, intensity, direction, mirror) {
        if (rawDeviceState == null) return;
        var segObj = {
            fx: effect,
            pal: palette,
            sx: speed,
            ix: intensity,
            rev: direction,
            mi: mirror
        };
        if (segId != -1) {
            segObj.id = segId;
            var segArr = [
                segObj
            ];
            var body = {
                seg: segArr
            };
            return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
        } else {
            var segArr = this.__getColorBodyForAllSections(rawDeviceState, segObj);
            var body = {
                seg: segArr
            };
            return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
        }
    }

    async SetPreset(presetID) {
        var body = {
            ps: parseInt(presetID)
        }
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
    }

    async SetCommonTransition(dur) {
        var body = {
            transition: parseInt(dur)
        }
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
    }

    async SetNewNightlightSettings(nlObj) {
        var body = {
            nl: nlObj
        }
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
    }

    async SetBrightness(level) {
        var body = {
            bri: parseInt(level)
        }
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
    }

    async SetOnOff(toggle) {
        var body = {
            on: toggle
        }
        return this.__sendGetCmd(`http://${this.__deviceAddress}/json/state`, body);
    }

    async SetAnimation(ledIndex, animationType, red, green, blue, white, redEnd, greenEnd, blueEnd, whiteEnd, speed) {
        //TODO: return this.__sendGetCmd(`http://${this.__deviceAddress}/ani/${ledIndex.toString()}/${animationType.toString()}/${red.toString()}/${green.toString()}/${blue.toString()}/${white.toString()}/${redEnd.toString()}/${greenEnd.toString()}/${blueEnd.toString()}/${whiteEnd.toString()}/${speed.toString()}`);
    }

    async SetRotationAnimation(cmd, speed) {
        //TODO: return this.__sendGetCmd(`http://${this.__deviceAddress}/rot/${cmd.toString()}/${speed.toString()}`);
    }

    async SetArrowAnimation(cmd, bouncy, red, green, blue, white, speed) {
        //TODO: return this.__sendGetCmd(`http://${this.__deviceAddress}/arr/${cmd.toString()}/${bouncy.toString()}/${red.toString()}/${green.toString()}/${blue.toString()}/${white.toString()}/${speed.toString()}`);
    }
}

module.exports = WLED;