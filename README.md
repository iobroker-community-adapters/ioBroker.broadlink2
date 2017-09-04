##![Logo](./admin/broadlink.png) Steuern von BroadLink IR/RF-Remotes und Schaltsteckdosen

[![NPM version](http://img.shields.io/npm/v/iobroker.broadlink2.svg)](https://www.npmjs.com/package/iobroker.broadlink2)
[![Downloads](https://img.shields.io/npm/dm/iobroker.broadlink2.svg)](https://www.npmjs.com/package/iobroker.broadlink2)
**Tests:** Linux/Mac: [![Travis-CI Build Status](https://travis-ci.org/frankjoke/iobroker.broadlink2.svg?branch=master)](https://travis-ci.org/frankjoke/iobroker.broadlink2)
Windows: [![AppVeyor Build status](https://ci.appveyor.com/api/projects/status/pil6266rrtw6l5c0?svg=true)](https://ci.appveyor.com/project/frankjoke/iobroker-broadlink2)

[![NPM](https://nodei.co/npm/iobroker.broadlink2.png?downloads=true)](https://nodei.co/npm/iobroker.broadlink2/)

## Adapter für verschiedene Broadlink WLan-Geräte (RM2++,SP1,SP2,SP3,...)
This is an ioBroker adapter for multiple  Broadlink switch like RM2, SP1, SP2, SP3, Honeywell SP2, SPMini, SPMini2, SPMiniPlus and some OEM products from them.
ALso remote controllers are supported like RM2, RM Mini, RM Pro Phicomm, RM2 Home Plus, RM2 Home Plus GDT, RM2 Pro Plus, RM2 Pro Plus2 and RM2 Pro Plus BL. Multiple controllers will generate their own entries and need to be trained separately.
It scans the network to find compatible devices and installs them (currently only switches type SP?).

I could not test all of them because I have only a RM2 Pro Plus and some SM2.

SP1 devices cannot be polled.

* This adapter is based on original Broadlink adapter v0.1.1 found here: <https://github.com/hieblmedia/ioBroker.broadlink>

## Configuration
* Enter prefix of network address in configuration which should be removed when generating device names
* Enter the number of seconds between polls. On each poll all SP* devices expluding SP1 are asked what the switch status is. This feature can be disabled by setting the poll delay to 0. On some RM devices with temperature readout the temperature will be updated as well.

## How-To learn codes
* In Objects of ioBroker you can find "broadlink2.[n].[devicename].Learn".
* Set this object to true. (you can click on the button in object view)
* Now press some button on your remote control within 30 seconds.
* An new Object should now appear within the Object "broadlink.[n].[devicename].LearnedState" with the name ">>> Rename learned @ YYYYMMDDTHHmmSS"
* You can click on the button in object view to send the code.

It is also possible to use the codes from [RM-Bridge](http://rm-bridge.fun2code.de/).
Just create an object (state, type button) with name where you prepend "CODE_".

## Known-Issues
* If you learn the same signal multiple times the code can be different everytime. This can not be changed.
* Sometimes it does not find devices if they do not respond to the search. Restart adapter to restart the scan.

## Important/Wichtig
* Requires node >=v4.2

## Changelog
### 0.4.3
* Don't create substates for switches

### 0.4.2
* Changed message to inform about found devices.
* Moved device info from  custom to native to avoid blue mark in adapter object list.

### 0.4.1
* Cleaned up code
* Debug and Info messages corrected

### 0.3.5
* Small bugs for node 4.x removed
* Poll more devices and some better debug code.
* first RM2++ device integration with learning!

### 0.3.0
* Poll frequency can be set to check the switches (which are able to do so, SM2 for example) and change the state if they are  changed by the user on the device.

### 0.2.1
* Changed naming convention and used type:name instead of type.name to reduce ioBroker subdivision of devices
* generate device object only if device is a remote control

### 0.2.0
* Implemented SP2 switches and they are working to set them!
* Currently ONLY SP1 && SP2 (SP3?) are working, please test!
* Disabled RM? devices, no test available, ordered one for later re-implementation
