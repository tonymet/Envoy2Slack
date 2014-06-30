#Envoy 2 Slack

A node app that proxies visitor notifications from [Envoy](https://signwithenvoy.com) to [Slack](http://slack.com)

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

	SLACK_BOTNAME:      buildbot
	SLACK_CHANNEL:      #code
	SLACK_ORGANIZATION: lunar
	SLACK_TOKEN:        xxxx

You can do this the easy way with heroku:

	heroku config:add SLACK_BOTNAME=OfficeBot
	heroku config:add SLACK_CHANNEL=#office
	heroku config:add SLACK_ORGANIZATION=modest
	heroku config:add SLACK_TOKEN=xxx


###That should do it.


##Yay.

hit me up if you have problems or concerns: [@harper](http://twitter.com/harper) / [harper@nata2.org](mailto:harper@nata2.org)
