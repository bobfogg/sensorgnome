#!/bin/bash
typeset -i version=$(cat /etc/ctt/station-revision)
USB_HUB_LINK=/data/usb_hub_rules.txt
if test -f $USB_HUB_LINK; then
	rm $USB_HUB_LINK
fi

if test $version -ge 3; then
	echo 'linking v3 sensorgnome hub map'
	ln -s /etc/ctt/sensorgnome/v3_usb_hub_rules.txt $USB_HUB_LINK
else
	echo 'lniking v2 sensorgnome hub map'
	ln -s /etc/ctt/sensorgnome/v2_usb_hub_rules.txt $USB_HUB_LINK
fi

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

