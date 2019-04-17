#!/bin/sh
mkdir -p /dev/sensorgnome/usb
ln -s /home/pi/proj/sensorgnome/udev-rules/hub_COMPUTE_portnums.txt /dev/usb_hub_port_nums.txt

# - increment the persistent bootcount in /etc/bootcount

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

# - delete any empty unmounted directores named /media/disk_portX.Y
#   These might be leftover from previous boots with disks plugged
#   into different slots.  As a failsafe, if the directory isn't
#   empty, we don't delete (since we're using rmdir) - the folder
#   might contain real data.

#for dir in /media/disk*port*; do
#    if ( ! ( mount -l | grep -q " on $dir " ) ); then
#        if [ "$(ls -A $dir 2> /dev/null)" == "" ]; then
#            rmdir $dir
#        fi
#    fi
#done

# maybe do a software update
# /home/pi/proj/sensorgnome/scripts/update_software.sh

