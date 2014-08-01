#Envoy 2 Slack

A node app that proxies visitor notifications from [Envoy](https://signwithenvoy.com) to [Slack](http://slack.com)

Uploads photos to S3 for safe keeping and grabs data from fullcontact. 

## How to get it going:

###Install

Check it out of git:

	git clone https://github.com/modestinc/Envoy2Slack.git

Deploy to heroku:

	heroku create
	git push heroku master

This will tell you your url: `https://creative-name-1234.herokuapp.com`

I imagine you could host it yourself, but why?

###Config

####Environmental Vars

You will need to set the following environmental variables:

	SLACK_BOTNAME:      officebot
	SLACK_CHANNEL:      #office
	SLACK_ORGANIZATION: startup
	SLACK_TOKEN:        xxxx
	S3_BUCKET:          xxxx
	S3_KEY:             xxxx
	S3_SECRET:          xxxx
	FULLCONTACT_KEY:    xxxx

You can do this the easy way with heroku:

	heroku config:add SLACK_BOTNAME=OfficeBot
	heroku config:add SLACK_CHANNEL=#office
	heroku config:add SLACK_ORGANIZATION=modest
	heroku config:add SLACK_TOKEN=xxx


###That should do it.


##Yay.

hit me up if you have problems or concerns: [@harper](http://twitter.com/harper) / [harper@modest.com](mailto:harper@modest.com)
