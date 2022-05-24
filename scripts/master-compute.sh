#!/bin/sh
export NODE_ENV=production VAMP_PATH=/lib/ctt/sensorgnome/.vamp NODE_PATH=/lib/ctt/sensorgnome/sensorgnome/node_modules LC_ALL="C.UTF-8"
/usr/local/bin/node /lib/ctt/sensorgnome/sensorgnome/master/master.js