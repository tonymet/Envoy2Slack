

var dateFormat = require('dateformat');
var express = require("express");
var qs = require('querystring');
var requests = require('request');
var knox = require('knox');
var https = require('https');

var app = express();
app.use(express.logger());
app.use(express.bodyParser());


var client = knox.createClient({
    key: process.env.S3_KEY
  , secret: process.env.S3_SECRET
  , bucket: process.env.S3_BUCKET
});

app.get('/', function(request, response) {
    response.send('Hi! Go Away!');
});

String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g, '');};

function rapportive_callback(error, response, body) {
  if (!error && response.statusCode == 200) {
    var info = JSON.parse(body);
    text = info['contact']['name'] + " is located in " + info['contact']['location']
    occupations = info['contact']['occupations'];
    memberships = info['contact']['memberships'];
    //

    job_text = [];
    for (index = 0; index < occupations.length; ++index) {
          job_text[index] = occupations[index]['job_title'] + " at " + occupations[index]['company'] ;
    }

    social = [];

    for (index = 0; index < memberships.length; ++index) {
          if (memberships[index]['site_name']== "Twitter"){
              social[index] = "<" + memberships[index]['profile_url'] + "|@" + memberships[index]['username']  + ">";
          }
          if (memberships[index]['site_name']== "LinkedIn"){
              social[index] = "<" + memberships[index]['profile_url'] + "|linkedin/" + memberships[index]['username']  + ">";
          }
          if (memberships[index]['site_name']== "Facebook"){
              social[index] = "<" + memberships[index]['profile_url'] + "|facebook/" + memberships[index]['username']  + ">";
          }
    }

    text = text + ". They are on the internet at " + social.join(", ");
    text = text + ". Photo of <" +info['contact']['image_url_raw'] + "|" +info['contact']['name'] + ">."

    slack_org = process.env.SLACK_ORGANIZATION;
    slack_token = process.env.SLACK_TOKEN;
    slack_channel = process.env.SLACK_CHANNEL;
    slack_botname = process.env.SLACK_BOTNAME;

    slack_url = "https://" + slack_org + ".slack.com/services/hooks/incoming-webhook?token=" + slack_token;

    slack_payload = {
        "text": text,
        "channel" : slack_channel,
        "username" : slack_botname,
        "icon_emoji": ":ghost:"
    };

    /* Post to slack! */
    requests.post(slack_url, {json:slack_payload},
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
  }
}

grab_email_data = function(email) {

    session_url = "http://rapportive.com/login_status?user_email=this_doesnt_exist_@gmail.com"
    info_url = "https://profiles.rapportive.com/contacts/email/" + email
    requests.get(session_url,
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var jsonObject = JSON.parse(body);
            session_token = jsonObject['session_token'];
            var options = {
              url: info_url,
              headers: {
                    'X-Session-Token': session_token
              }
            }
            requests.get(options, rapportive_callback);
        }
    });
}

/* Handle incoming posts from circleci */
post_handler = function(payload) {

    visitor = JSON.parse(payload['entry']);
    var date = new Date(visitor['signed_in_time_local']);
    signin_date = dateFormat(date, "dddd, mmmm dS, yyyy, h:MM:ss TT");
    /* This is the message. tweak it to make it better */

    photo_url = visitor['photo_url']
    console.log(photo_url);

    https.get(photo_url, function(res){
        console.log("Got response: " + res.statusCode);
        var headers = {
            'Content-Length': res.headers['content-length']
            , 'Content-Type': res.headers['content-type']
            , 'Cache-Control': 'max-age=604800'
            , 'x-amz-acl': 'public-read'
        };

        s3_file_name = 'envoy_'+visitor['your_full_name']+'.'+visitor['signed_in_time_local']+'.png'
        var req = client.putStream(res, '/envoy/'+s3_file_name, headers, function(err, res) {
            // error or successful upload
            photo_url = req.url;
        });
    });

    grab_email_data(visitor['your_email_address']);
    message_string = visitor['your_full_name']+" is here to see "+visitor['who_are_you_here_to_see\?']+".  <" + photo_url + "| Picture of "+visitor['your_full_name']+">"

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
    requests.post(slack_url, {json:slack_payload},
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
};

app.get('/hook/', function(request, response) {
    grab_email_data("harper@nata2.org")
    response.send("Thank you!");
    //response.redirect('/');
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
    (typeof process.env.S3_KEY !== 'undefined' && process.env.S3_KEY)
    (typeof process.env.S3_SECRET !== 'undefined' && process.env.S3_SECRET)
    (typeof process.env.S3_BUCKET !== 'undefined' && process.env.S3_BUCKET)

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
    console.log("\tSLACK_TOKEN: " + process.env.S3_KEY);
    console.log("\tSLACK_TOKEN: " + process.env.S3_SECRET);
    console.log("\tSLACK_TOKEN: " + process.env.S3_BUCKET);
    process.exit();
}
