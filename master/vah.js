/*

  vah.js - maintain a running instance of vamp-alsa-host and communicate
  with it.

  vamp-alsa-host accepts commands and sends replies over a unix domain
  connection.  It also outputs data from plugins or raw devices over a
  unix domain connection.

*/

VAH = function(matron, prog, sockName) {

    this.matron = matron;
    this.prog = prog;
    this.sockName = sockName;
    this.sockPath = "/tmp/" + sockName;
    this.cmdSock = null; // control socket
    this.dataSock = null; // data socket
    this.child = null; // child process
    this.replyHandlerQueue = []; // list of reply handlers in order of commands being sent out
                                 // each handler is an object with these fields:
                                 // callback: function(reply, par) to call with reply and extra parameter
                                 // par:  extra parameter for callback
                                 // n: number of times to use this handler

    this.commandQueue = []; // list of commands queued before command connection is established
    this.replyBuf = "";
    this.quitting = false;
    this.inDieHandler = false;
    this.connectCmdTimeout = null;
    this.connectDataTimeout = null;
    this.checkRateTimer = null;
    this.frames = {}; // last frame count&time for each plugin {at: Date.now(), frames:N, bad:N}

    // callback closures
    this.this_childDied        = this.childDied.bind(this);
    this.this_logChildError    = this.logChildError.bind(this);
    this.this_cmdSockConnected = this.cmdSockConnected.bind(this);
    this.this_connectCmd       = this.connectCmd.bind(this);
    this.this_connectData      = this.connectData.bind(this);
    this.this_doneReaping      = this.doneReaping.bind(this);
    this.this_gotCmdReply      = this.gotCmdReply.bind(this);
    this.this_gotData          = this.gotData.bind(this);
    this.this_quit             = this.quit.bind(this);
    this.this_serverReady      = this.serverReady.bind(this);
    this.this_cmdSockProblem   = this.cmdSockProblem.bind(this);
    this.this_dataSockProblem  = this.dataSockProblem.bind(this);
    this.this_spawnChild       = this.spawnChild.bind(this);
    this.this_vahAccept        = this.vahAccept.bind(this);
    this.this_vahSubmit        = this.vahSubmit.bind(this);
    this.this_vahStartStop     = this.vahStartStop.bind(this);

    matron.on("quit", this.this_quit);
    matron.on("vahSubmit", this.this_vahSubmit);
    matron.on("vahStartStop", this.this_vahStartStop);
    matron.on("vahAccept", this.this_vahAccept);

    this.reapOldVAHandSpawn();
}

const checkRatesInterval = 20_000;

VAH.prototype.childDied = function(code, signal) {
//    console.log("VAH child died\n")
    if (this.inDieHandler)
        return;
    this.inDieHandler = true;
    if (this.cmdSock) {
        this.cmdSock.destroy();
        this.cmdSock = null;
    }
    if (this.dataSock) {
        this.dataSock.destroy();
        this.dataSock = null;
    }
    if (! this.quitting)
        setTimeout(this.this_spawnChild, 5000);
    if (this.connectCmdTimeout) {
        clearTimeout(this.connectCmdTimeout);
        this.connectCmdTimeout = null;
    }
    if (this.connectDataTimeout) {
        clearTimeout(this.connectDataTimeout);
        this.connectDataTimeout = null;
    }
    this.inDieHandler = false;
    this.matron.emit("VAHdied")
};

VAH.prototype.reapOldVAHandSpawn = function() {
    ChildProcess.execFile("/usr/bin/killall", ["-KILL", "vamp-alsa-host"], null, this.this_doneReaping);
    if (this.checkRateTimer)
        clearInterval(this.checkRateTimer);
};

VAH.prototype.doneReaping = function() {
    this.spawnChild();
};

VAH.prototype.spawnChild = function() {
    if (this.quitting)
        return;
    this.cmdSock = null;
//    console.log("VAH about to spawn child\n");
    var child = ChildProcess.spawn(this.prog, ["-q", "-s", this.sockName]);
    child.on("exit", this.this_childDied);
    child.on("error", this.this_childDied);
    child.stdout.on("data", this.this_serverReady);
    child.stderr.on("data", this.this_logChildError);
    this.child = child;
    this.frames = {};
};


VAH.prototype.cmdSockConnected = function() {
    // process any queued command
    while (this.commandQueue.length) {
//        console.log("VAH about to submit queued: " + this.commandQueue[0] + "\n");
        this.cmdSock.write(this.commandQueue.shift());
    }
    // start monitoring sample rates
    // need to wait a long time for VAH to respond to the first list command (prob has to 
    // start all plugin processes and get some OK from them)
    this.checkRateTimer = setInterval(() => this.checkRates(), checkRatesInterval);
};

VAH.prototype.serverReady = function(data) {
    this.child.stdout.removeListener("data", this.this_serverReady);
    this.connectCmd();
    this.connectData();
    this.matron.emit("VAHstarted");
};

VAH.prototype.logChildError = function(data) {
    console.log("VAH child got error: " + data.toString() + "\n");
};

VAH.prototype.connectCmd = function() {
    // server is listening for connections, so connect
    if (this.cmdSock) {
        return;
    }
//    console.log("about to connect command socket\n")
    this.cmdSock = Net.connect(this.sockPath, this.this_cmdSockConnected);
    this.cmdSock.on("error" , this.this_cmdSockProblem);
//    this.cmdSock.on("end"   , this.this_cmdSockProblem);
//    this.cmdSock.on("close" , this.this_cmdSockProblem);
    this.cmdSock.on("data"  , this.this_gotCmdReply);
};

VAH.prototype.connectData = function() {
    if (this.dataSock) {
        return;
    }
//    console.log("about to connect data socket\n")
    this.dataSock = Net.connect(this.sockPath, function() {});

    this.dataSock.on("error" , this.this_dataSockProblem);
//    this.dataSock.on("end"   , this.this_dataSockProblem);
//    this.dataSock.on("close" , this.this_dataSockProblem);
    this.dataSock.on("data"  , this.this_gotData);
}

VAH.prototype.cmdSockProblem = function(e) {
//    console.log("Got command socket problem " + e.toString() + "\n");
    if (this.cmdSock) {
        this.cmdSock.destroy();
        this.cmdSock = null;
    }
    if (this.quitting || this.inDieHandler)
        return;
    setTimeout(this.this_connectCmd, 5001);
};

VAH.prototype.dataSockProblem = function(e) {
//    console.log("Got data socket problem " + e.toString() + "\n");
    if (this.dataSock) {
        this.dataSock.destroy();
        this.dataSock = null;
    }
    if (this.quitting || this.inDieHandler)
        return;
    setTimeout(this.this_connectData, 5001);
};


VAH.prototype.vahSubmit = function (cmd, callback, callbackPars) {
    // add the callback to the reply queue and
    // issue the command; if there are multiple commands, send all
    // replies to the callback with a single call.
    // Also, if callback is null, the command is assumed not to return
    // a reply.

    if (!Array.isArray(cmd))
        cmd = [cmd];
    if (callback)
        this.replyHandlerQueue.push({callback: callback, par: callbackPars});
    if (this.cmdSock) {
//        console.log("VAH about to submit: " + cmd + "\n");
        for (var i in cmd)
            this.cmdSock.write(cmd[i] + '\n');
    } else {
//        console.log("VAH about to queue: " + cmd + "\n");
        for (var i in cmd)
            this.commandQueue.push(cmd + '\n');
    }
};


// Submit a start/stop command to vah. Uses VahSubmit to send the command but then remembers
// whether the port is on or off so that the rate check knows whether to expect data.
VAH.prototype.vahStartStop = function (startstop, devLabel, callback, callbackPars) {
    const cmd = startstop + " " + devLabel;
    this.vahSubmit(cmd, callback, callbackPars);
    // info from VAH comes back as 'pN', the 'p' stands for Plugin...
    if (startstop == 'start') this.frames['p'+devLabel] = { at: Date.now(), frames: 0, bad: 0 };
    else delete this.frames['p'+devLabel];
};


VAH.prototype.gotCmdReply = function (data) {
    // vamp-alsa-host replies are single JSON-formatted strings on a single line ending with '\n'
    // if multiple commands are submitted with a single call to vahSubmit,
    // their replies are returned in an array with a single call to the callback.
    // Otherwise, the reply is sent bare (i.e. not in an array of 1 element).

    this.replyBuf += data.toString();
// DEBUG: console.log("VAH replied: " + data.toString() + "\n");
    for(;;) {
	var eol = this.replyBuf.indexOf("\n");
	if (eol < 0)
	    break;
        var replyString = this.replyBuf.substring(0, eol);
	this.replyBuf = this.replyBuf.substring(eol + 1);

        if (replyString.length == 0)
            continue;

	var reply = JSON.parse(replyString);

        if (reply.async) {
            // if async field is present, this is not a reply to a command
            this.matron.emit(reply.event, reply.devLabel, reply);
        } else {
            // deal with the new reply
            var handler = this.replyHandlerQueue.shift();

            if (!handler)
                continue;
            if (handler.callback)
                handler.callback(reply, handler.par);
        }
    }
};

VAH.prototype.vahAccept = function(pluginLabel) {
    // indicate that VAH should accept data from the specified plugin
    if (this.dataSock) {
//        console.log("VAH about to do receive " + pluginLabel + "\n");
        this.dataSock.write("receive " + pluginLabel + "\n");
    }
};

VAH.prototype.gotData = function(data) {
    this.matron.emit("vahData", data);
};

VAH.prototype.quit = function() {
    this.quitting = true;
    this.child.kill("SIGKILL");
    };

VAH.prototype.getRawStream = function(devLabel, rate, doFM) {
    // return a readableStream which will produce raw output from the specified device, until the socket is closed

    var rawSock = Net.connect(this.sockPath, function(){});
    rawSock.stop = function() {rawSock.write("rawStreamOff " + devLabel + "\n"); rawSock.destroy();}

    rawSock.start = function() {rawSock.write("rawStream " + devLabel + " " + rate + " " + doFM + "\n")};
    return rawSock;
};

VAH.prototype.checkRates = function() {
    this.vahSubmit("list", reply => this.checkRatesReply(reply));
};

var logRateCnt = 0;

VAH.prototype.checkRatesReply = function(reply) {
    // check that all the plugins are producing data at the correct rate
    const now = Date.now()
    // console.log("VAH rates: ", JSON.stringify(reply, null, 2));
    // console.log(`VAH frames: ${JSON.stringify(this.frames, null, 2)}`);
    for (const p in this.frames) {
        const fp = this.frames[p];
        if (p in reply) {
            var info = reply[p];
            if (info.type != 'PluginRunner') {
                console.log(`VAH checkRates: ${p} is not a plugin? ${JSON.stringify(info)}`);
                continue;
            }
            this.matron.emit("vahFrames", p, now, info.totalFrames);
            // calculate the rate
            const dt = now - fp.at;
            if (dt < checkRatesInterval*0.9) continue; // too soon to calculate stable rate
            const df = info.totalFrames - fp.frames;
            const rate = df / dt * 1000;
            this.matron.emit("vahRate", p, now, rate);
            // OK or not?
            const ok = rate > info.rate*0.95 && rate < info.rate*1.05;
            if (!ok || logRateCnt++ < 100)
                console.log(`VAH rate for ${p}: nominal ${info.rate}, actual ${rate.toFixed(0)} frames/sec`);
            if (!ok) fp.bad++; else fp.bad = 0;
            if (fp.bad > 6) {
                console.log(`VAH rate for ${p} is out of range: nominal ${info.rate}, actual ${rate.toFixed(0)} frames/sec`);
                this.matron.emit("devStalled", p);
            }
        } else if (fp.frames > 0 || Date.now() - fp.at > 60_000) {
            // plugin has died
            console.log(`VAH plugin ${p} has died`);
            this.matron.emit("devStalled", p);
        }
    }
};

exports.VAH = VAH;
