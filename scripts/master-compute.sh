#!/bin/sh
export NODE_ENV=production VAMP_PATH=/home/pi/vamp NODE_PATH=/usr/local/lib/node_modules LC_ALL="C.UTF-8"
/usr/bin/node /home/pi/proj/sensorgnome/master/master.js