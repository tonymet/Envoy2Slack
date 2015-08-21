var dateFormat = require('dateformat');
var express = require("express");
var knox = require('knox');
var https = require('https');
var bodyParser = require('body-parser');
var expressLogger = require('express-logger');
var slack = require('./slack');
var envoy = require('./envoy');

var app = express();
app.use(bodyParser.urlencoded({extended: false}));

var client = knox.createClient({
    key: process.env.S3_KEY
  , secret: process.env.S3_SECRET
  , bucket: process.env.S3_BUCKET
});

app.get('/', function(request, response) {
    response.redirect('/');
});

String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g, '');};

/* Handle incoming posts from circleci */
app.post('/hook/', function(request, response) {
    //console.log("request: " + JSON.stringify(request.body));
    if (! envoy.checkSig(request.body, process.env.ENVOY_KEY)){
      console.log("ERROR: signature mismatch");
      response.status(400).send("ERROR: signature mismatch");
      return;
    }

    visitor = JSON.parse(request.body.entry);
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
    slack.send(message_string, slack_botname, ":ghost:",process.env);
    response.send("OK");
});

app.get('/hook/', function(request, response) {
    response.send('HI');
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
