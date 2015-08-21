var requests = require('request');
var slackapi = require('slack-api');
module.exports = {
  send : function(text, botname, emoji, channel, env){
    slack_org = env.SLACK_ORGANIZATION;
    slack_token = env.SLACK_TOKEN;
    slack_channel = channel;
    slack_url = env.SLACK_URL;

    console.log("Message:" + text);
    slack_payload = {
        "text": text,
        "channel" : slack_channel,
        "username" : botname,
        "icon_emoji": emoji
    };

    /* Post to slack! */
    requests.post(slack_url, {json:slack_payload},
    function (error, response, body) {
        if(error || response.statusCode != 200){
          console.log("ERROR from slack: " + response.body);
          console.log("ERROR from slack: " + response.statusCode);
        }
        console.log(body);
    });
  },
  lookupUser: function(name,cb){
    slackapi.users.list({token: process.env.SLACK_TOKEN},function(err,data){
      if(err){
        console.log("ERROR: " + err);
        cb(true,null);
        return;
      }
      for(var i = 0; i < data.members.length; ++i){
        if(data.members[i].profile.real_name_normalized == name){
          cb(false, data.members[i].name);
          return;
        }
      }
      cb(true,null);
      return;
    });
  }
};
