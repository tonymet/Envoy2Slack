

var dateFormat = require('dateformat');
var express = require("express");
var qs = require('querystring');
var requests = require('request');
var knox = require('knox');
var https = require('https');
var hmac_sha256 = require("crypto-js/hmac-sha256");

var app = express();
app.use(express.logger());
app.use(express.bodyParser());

if('' == process.env.ENVOY_KEY){
  console.log("ENVOY_KEY is required.")
  process.exit();
}

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
check_sig = function(payload, envoy_key){
  console.log("payload.signature= " + JSON.stringify(payload.signature.trim()));
  console.log("check_sig = " + JSON.stringify(hmac_sha256(payload.timestamp + payload.token, envoy_key).toString()));
  return hmac_sha256(payload.timestamp + payload.token, envoy_key).toString() == payload.signature.trim();
}

post_to_slack = function(text, botname, emoji){
    slack_org = process.env.SLACK_ORGANIZATION;
    slack_token = process.env.SLACK_TOKEN;
    slack_channel = process.env.SLACK_CHANNEL;
    slack_url = process.env.SLACK_URL;

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


stalker_callback = function(error, result) {
  if(error || result['status'] != 200){
    console.log("ERROR stalker_callback");
    console.log(result);
    return;
  }
  name = result['contactInfo']['givenName'];
  text = name;
  if (result['demographics'] != undefined ){
      if (result['demographics']['locationGeneral'] != undefined ){
          text = text + " is located in " + result['demographics']['locationGeneral']+"."

      }else {
          text = text + " is"
      }
  }

  if (result['organizations'] != undefined ){
      organizations = result['organizations']
      text = text + " They are employed as "
      job_text = [];
      for (index = 0; index < organizations.length; ++index) {
          if (organizations[index]['isPrimary']){
            job_text[index] = organizations[index]['title'] + " at " + organizations[index]['name'] ;
          }
      }
      text = text + job_text.join(", ") + ".\n\n";
  }


  if (result['socialProfiles'] != undefined ){
      socialProfiles = result['socialProfiles']
      social = [];
      social_count = 0;
      for (index = 0; index < socialProfiles.length; ++index) {
            if (socialProfiles[index]['typeName']== "Twitter"){
                social[social_count] = "<" + socialProfiles[index]['url'] + "|@" + socialProfiles[index]['username']  + ">";
                social_count++;
            }else if (socialProfiles[index]['typeName']== "LinkedIn"){
                social[social_count] = "<" + socialProfiles[index]['url'] + "|linkedin/>";
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


      if (social.length >0){
          text = text + "They are on the internet at " + social.join(", ") + ".\n\n";

      }
  }


  if (result['photos'] != undefined ){
      photos = result['photos']
      for (index = 0; index < photos.length; ++index) {
           if (photos[index]['isPrimary']){
              text = text + "Photo of <" +photos[index]['url'] + "|" +result['contactInfo']['fullName'] + ">.\n\n"
            }
      }
  }

  if (result['digitalFootprint'] != undefined ){
      text = text + "Their klout score is " + result['digitalFootprint']['scores'][0]['value'] ;
      if (result['digitalFootprint']['scores'][0]['value']<40){
          text = text + ". lol n00b."
      }else if (result['digitalFootprint']['scores'][0]['value']<60){
          text = text + ". semi-pro n00b? "
      }else{
          text = text + ". expert at twitter."

      }

  }
  if (text == name){
      text = text + " has no internet presence."
  }

  post_to_slack(text, "StalkerBot", ":stalker:")

}

grab_email_data = function(email) {
    fullcontact.person.findByEmail(email, stalker_callback);
}

/* Handle incoming posts from circleci */
app.post('/hook/', function(request, response) {
    //console.log("request: " + JSON.stringify(request.body));
    payload = request.body;
    if (! check_sig(payload, process.env.ENVOY_KEY)){
      console.log("ERROR: signature mismatch");
      response.status(400).send("ERROR: signature mismatch");
      return;
    }

    visitor = JSON.parse(payload['entry']);
    console.log("visitor:" + JSON.stringify(visitor));
    var date = new Date(visitor['signed_in_time_local']);
    signin_date = dateFormat(date, "dddd, mmmm dS, yyyy, h:MM:ss TT");
    /* This is the message. tweak it to make it better */

    photo_url = visitor['photo_url']
    console.log("photo_url: " + photo_url);

    https.get(photo_url, function(res){
        if(res.statusCode != 200){
          console.log("error from S3. res=  "+ res.statusCode);
          return;
        }
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

    //grab_email_data(visitor['your_email_address']);
    //message_string = visitor['your_full_name']+" is here to see "+visitor['who_are_you_here_to_see\?']+".  <" + photo_url + "| Picture of "+visitor['your_full_name']+">"
    message_string = JSON.stringify(visitor);
    slack_botname = process.env.SLACK_BOTNAME;
    post_to_slack(message_string, slack_botname, ":ghost:")
    response.send("OK");
});

app.get('/hook/', function(request, response) {
    //response.redirect('/');
    grab_email_data("harper@nata2.org")
});


/*
There has to be a better way to do this. Thoughts?
*/

if ((typeof process.env.SLACK_BOTNAME !== 'undefined' && process.env.SLACK_BOTNAME)||
    (typeof process.env.SLACK_CHANNEL !== 'undefined' && process.env.SLACK_CHANNEL)||
    (typeof process.env.SLACK_ORGANIZATION !== 'undefined' && process.env.SLACK_ORGANIZATION)||
    (typeof process.env.SLACK_TOKEN !== 'undefined' && process.env.SLACK_TOKEN) ||
    (typeof process.env.S3_KEY !== 'undefined' && process.env.S3_KEY) ||
    (typeof process.env.S3_SECRET !== 'undefined' && process.env.S3_SECRET) ||
    (typeof process.env.S3_BUCKET !== 'undefined' && process.env.S3_BUCKET) ||
    (typeof process.env.ENVOY_KEY !== 'undefined' && process.env.S3_BUCKET)

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
