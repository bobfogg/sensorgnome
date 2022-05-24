#!/bin/bash
SENSORGNOME_UDEV_DIR="/dev/sensorgnome/usb"
if [[ -d $SENSORGNOME_UDEV_DIR ]]; then
    mkdir -p $SENSORGNOME_UDEV_DIR
fi

USB_HUB_UDEV_RULES="/data/usb_hub_rules.txt"
if [[ -d $USB_HUB_UDEV_RULES ]]; then
    ln -s /lib/ctt/sensorgnome/sensorgnome/udev-rules/hub_COMPUTE_portnums.txt $USB_HUB_UDEV_RULES
fi

BOOT_COUNT_FILE="/etc/bootcount"
if [[ -f $BOOT_COUNT_FILE ]]; then
    COUNT=`cat $BOOT_COUNT_FILE`;
    if [[ "$COUNT" == "" ]]; then
        COUNT=0;
    fi
    echo $(( 1 + $COUNT )) > $BOOT_COUNT_FILE
else
    echo 1 > $BOOT_COUNT_FILE
fi

