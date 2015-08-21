requests = require('request');
module.exports = {
  send : function(text, botname, emoji, env){
    slack_org = env.SLACK_ORGANIZATION;
    slack_token = env.SLACK_TOKEN;
    slack_channel = env.SLACK_CHANNEL;
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
        if(response.statusCode != 200){
          console.log("ERROR from slack: " + response.body);
          console.log("ERROR from slack: " + response.statusCode);
        }
        console.log(body);
    });
  }
};
