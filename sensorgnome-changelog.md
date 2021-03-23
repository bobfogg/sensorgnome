# CTT Sensor Station Sensorgnome Changelog

- Sensorgnome is no longer updating the hardware clock using the GPS
    - [chrony](https://chrony.tuxfamily.org/) is responsible for negotiating clock set based on GPS, Network, RTC times.
        - There is room for investigating the optimum configuration for chrony
- Data is now saved to root data directory
    - `/data`
    - USB Hub Rules
        - `/data/usb_hub_rules.txt`
    - Deployment and Tag Database files
        - `/data/sg_files`
    - Data streaming
        - `/data/SGdata/YYYY-MM-DD/filename`
- Compiled Vamp plugin moved
    - `/home/pi/.vamp/lotek-plugins.so`
- Add `package.json` file for npm install / handle
- Prevent Sensorgnome Updates (temporary via original tar.bz2 upload)