

var dateFormat = require('dateformat');
var express = require("express");
var qs = require('querystring');
var requests = require('request');

var app = express();
app.use(express.logger());
app.use(express.bodyParser());

app.get('/', function(request, response) {
    response.send('Hi! Go Away!');
});

String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g, '');};

/* Handle incoming posts from circleci */
post_handler = function(payload) {
    console.log(payload);
    visitor = JSON.parse(payload['entry']);

    console.log(visitor);
    console.log(visitor["id"]);
    console.log(visitor['your_full_name']);
    var date = new Date(visitor['signed_in_time_local']);
    console.log(date);
    signin_date = dateFormat(date, "dddd, mmmm dS, yyyy, h:MM:ss TT");
    console.log(signin_date);
    console.log(visitor['who_are_you_here_to_see\?']);


    /* This is the message. tweak it to make it better */

    message_string = visitor['your_full_name']+" is here to see "+visitor['who_are_you_here_to_see\?']+".  <" + visitor['photo_url'] + "| Picture of "+visitor['your_full_name']+">"


    slack_org = process.env.SLACK_ORGANIZATION;
    slack_token = process.env.SLACK_TOKEN;
    slack_channel = process.env.SLACK_CHANNEL;
    slack_botname = process.env.SLACK_BOTNAME;

    slack_url = "https://" + slack_org + ".slack.com/services/hooks/incoming-webhook?token=" + slack_token;

    slack_payload = {
        "text": message_string,
        "channel" : slack_channel,
        "username" : slack_botname,
        "icon_emoji": ":ghost:"
    };

    /* Post to slack! */
    console.log(slack_payload);
    requests.post(slack_url, {json:slack_payload},
    function (error, response, body) {
        console.log(body);
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
};

app.get('/hook/', function(request, response) {
    response.redirect('/');
});

app.post('/hook/', function(request, response) {

    console.log("Got response: " + response.statusCode);
    response.send("Thank you!");
    post_handler(request.body);

});

/*
There has to be a better way to do this. Thoughts?
*/

if ((typeof process.env.SLACK_BOTNAME !== 'undefined' && process.env.SLACK_BOTNAME)||
    (typeof process.env.SLACK_CHANNEL !== 'undefined' && process.env.SLACK_CHANNEL)||
    (typeof process.env.SLACK_ORGANIZATION !== 'undefined' && process.env.SLACK_ORGANIZATION)||
    (typeof process.env.SLACK_TOKEN !== 'undefined' && process.env.SLACK_TOKEN)
    )
{
    var port = process.env.PORT || 5000;
    app.listen(port, function() {
        console.log("Listening on " + port);
    });
}else{
    console.log("One of the required config variables missing:");
    console.log("\tSLACK_BOTNAME: " + process.env.SLACK_BOTNAME);
    console.log("\tSLACK_CHANNEL: " + process.env.SLACK_CHANNEL);
    console.log("\tSLACK_ORGANIZATION: " + process.env.SLACK_ORGANIZATION);
    console.log("\tSLACK_TOKEN: " + process.env.SLACK_TOKEN);
    process.exit();
}
