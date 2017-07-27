![Logo](admin/broadlink.png) 
iobroker.broadlink2  
==================

[![NPM version](http://img.shields.io/npm/v/iobroker.broadlink2.svg)](https://www.npmjs.com/package/iobroker.broadlink2)
[![Downloads](https://img.shields.io/npm/dm/iobroker.broadlink2.svg)](https://www.npmjs.com/package/iobroker.broadlink2)

[![NPM](https://nodei.co/npm/iobroker.broadlink.png?downloads=true)](https://nodei.co/npm/iobroker.broadlink2/)

**Tests:** Linux/Mac: [![Travis-CI Build Status](https://travis-ci.org/frankjoke/iobroker.broadlink2.svg?branch=master)](https://travis-ci.org/frankjoke/iobroker.broadlink2)
Windows: [![AppVeyor Build status](https://ci.appveyor.com/api/projects/status/pil6266rrtw6l5c0?svg=true)](https://ci.appveyor.com/project/frankjoke/iobroker-broadlink2)

This is an ioBroker adapter for multiple  Broadlink devices like RM3, SP1, SP2, SP3,... .

It scans the network to find compatible devices and installs them (currently only switches type SP?).

## Configuration
* Enter prefix of network address in configuration which should be removed when generating device names 

## Known-Issues
* If you learn the same signal multiple times the code can be different everytime. This can not be changed.

## Important/Wichtig!
* Requires node >=v4.2

## Changelog
### 0.2.1
* Changed naming convention and used type:name instead of type.name to reduce ioBroker subdivision of devices 
* generate device object only if device is a remote control

### 0.2.0
* Implemented SP2 switches and they are working to set them!
* Currently ONLY SP1 && SP2 (SP3?) are working, please test!
* Disabled RM? devices, no test available, ordered one for later re-implementation
