const fs = require("fs");

let FgCyan = "\x1b[36m";
let BgWhite = "\x1b[47m";
let BgRed = "\x1b[41m";


const logger = (req, res, next) => {
  
  const LOG = `Req :  ${new Date().toISOString()} ${req.method} ${req.url}\n`;
  console.log(LOG);
  // fs.appendFile("logs/logs.txt", LOG, function (err) {});

  next();

};


module.exports = logger;
