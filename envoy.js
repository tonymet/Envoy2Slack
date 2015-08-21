var crypto = require('crypto');
module.exports = {
  checkSig : function(payload, envoy_key){
    var our_sig = crypto.createHmac('sha256', envoy_key).update(payload.timestamp+payload.token).digest('hex');
    console.log("payload.signature= " + JSON.stringify(payload.signature.trim()));
    console.log("check_sig = " + our_sig);
    return our_sig === payload.signature.trim();
  }
};
