#!/usr/bin/python

import broadlink

strHost="192.168.0.187"
strMac="34:ea:34:9b:92:46"
strType = '0x4ead'
macbytes = bytearray.fromhex(strMac.replace(':',''))
device = broadlink.hysen((strHost,80),macbytes,strType)
print device.auth()
data = device.get_full_status()
print data
