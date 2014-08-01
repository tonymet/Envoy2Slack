

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

var fullcontact = require("fullcontact-api")(process.env.FULL_CONTACT_KEY);

app.get('/', function(request, response) {
    response.redirect('/');
});

String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g, '');};

post_to_slack = function(text, botname, emoji){
    slack_org = process.env.SLACK_ORGANIZATION;
    slack_token = process.env.SLACK_TOKEN;
    slack_channel = process.env.SLACK_CHANNEL;


    slack_url = "https://" + slack_org + ".slack.com/services/hooks/incoming-webhook?token=" + slack_token;

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
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
}


stalker_callback = function(error, result) {
  if (!error && (result['status'] != 404)) {
    console.log(result);


    text = result['contactInfo']['givenName'];
    if (result['demographics']['locationGeneral']==1){
        text = text + " is located in " + result['demographics']['locationGeneral']+"."
        text = text + " They are"

    }else {
        text = text + " is"
    }


    console.log(text);
    organizations = result['organizations']

    job_text = [];
    for (index = 0; index < organizations.length; ++index) {
        if (organizations[index]['isPrimary']){
          job_text[index] = organizations[index]['title'] + " at " + organizations[index]['name'] ;
        }
    }

    text = text + " " + job_text.join(", ") + ".";

    socialProfiles = result['socialProfiles']
    social = [];
    social_count = 0;
    for (index = 0; index < socialProfiles.length; ++index) {
          if (socialProfiles[index]['typeName']== "Twitter"){
              social[social_count] = "<" + socialProfiles[index]['url'] + "|@" + socialProfiles[index]['username']  + ">";
              social_count++;
          }else if (socialProfiles[index]['typeName']== "LinkedIn"){
              social[social_count] = "<" + socialProfiles[index]['url'] + "|linkedin/" + socialProfiles[index]['username']  + ">";
              social_count++;
          }else if (socialProfiles[index]['typeName']== "Facebook"){
              social[social_count] = "<" + socialProfiles[index]['url'] + "|facebook/" + socialProfiles[index]['username']  + ">";
              social_count++;
          }else if (socialProfiles[index]['typeName']== "Pinterest"){
              social[social_count] = "<" + socialProfiles[index]['url'] + "|pinterest/" + socialProfiles[index]['username']  + ">";
              social_count++;
          }else if (socialProfiles[index]['typeName']== "Flickr"){
              social[social_count] = "<" + socialProfiles[index]['url'] + "|flickr/" + socialProfiles[index]['username']  + ">";
              social_count++;
          }
    }


    text = text + ".\n\nThey are on the internet at " + social.join(", ") + ".";

    photos = result['photos']
    for (index = 0; index < photos.length; ++index) {
         if (photos[index]['isPrimary']){
            text = text + "\n\nPhoto of <" +photos[index]['url'] + "|" +result['contactInfo']['fullName'] + ">."
          }
    }

    text = text + "\n\nTheir klout score is " + result['digitalFootprint']['scores'][0]['value'] + ". lol.";

    post_to_slack(text, "StalkerBot", ":stalker:")

  }else{
            console.log("Status: " + result['message'])
        }
}

grab_email_data = function(email) {
    fullcontact.person.findByEmail(email, stalker_callback);
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
    slack_botname = process.env.SLACK_BOTNAME;
    post_to_slack(message_string, slack_botname, ":ghost:")
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
