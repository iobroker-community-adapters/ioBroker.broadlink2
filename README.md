![Logo](admin/broadlink.png) 
iobroker.broadlink2  
==================

[![NPM version](http://img.shields.io/npm/v/iobroker.broadlink2.svg)](https://www.npmjs.com/package/iobroker.broadlink2)
[![Downloads](https://img.shields.io/npm/dm/iobroker.broadlink2.svg)](https://www.npmjs.com/package/iobroker.broadlink2)

[![NPM](https://nodei.co/npm/iobroker.broadlink.png?downloads=true)](https://nodei.co/npm/iobroker.broadlink2/)

**Tests:** Linux/Mac: [![Travis-CI Build Status](https://travis-ci.org/frankjoke/iobroker.broadlink2.svg?branch=master)](https://travis-ci.org/frankjoke/iobroker.broadlink2)
Windows: [![AppVeyor Build status](https://ci.appveyor.com/api/projects/status/pil6266rrtw6l5c0?svg=true)](https://ci.appveyor.com/project/frankjoke/iobroker-broadlink2)

This is an ioBroker adapter for multiple  Broadlink switch like RM3, SP1, SP2, SP3, Honeywell SP2, SPMini, SPMini2, SPMiniPlus and some OEM products from them.
ALso remote controllers are supported like RM2, RM Mini, RM Pro Phicomm, RM2 Home Plus, RM2 Home Plus GDT, RM2 Pro Plus, RM2 Pro Plus2 and RM2 Pro Plus BL. 
It scans the network to find compatible devices and installs them (currently only switches type SP?).

I could not test all of them because I have only a RM2 Pro Plus and some SM2.

SP1 devices cannot be polled.

## Configuration
* Enter prefix of network address in configuration which should be removed when generating device names 
* Enter the number of seconds between polls. On each poll all SP* devices expluding SP1 are asked what the switch status is. This feature can be disabled by setting the poll delay to 0.

## Known-Issues
* If you learn the same signal multiple times the code can be different everytime. This can not be changed.

## Important/Wichtig!
* Requires node >=v4.2

## Changelog
### 0.3.1
* Poll more devices and some better debug code.

### 0.3.0
* Poll frequency can be set to check the switches (which are able to do so, SM2 for example) and change the state if they are  changed by the user on the device.

### 0.2.1
* Changed naming convention and used type:name instead of type.name to reduce ioBroker subdivision of devices 
* generate device object only if device is a remote control

### 0.2.0
* Implemented SP2 switches and they are working to set them!
* Currently ONLY SP1 && SP2 (SP3?) are working, please test!
* Disabled RM? devices, no test available, ordered one for later re-implementation
