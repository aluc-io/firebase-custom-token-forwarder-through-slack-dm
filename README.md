# firebase-custom-token-forwarder-through-slack-dm

## Install dependencies

```
$ yarn install
$ yarn --cwd functions install
```

## Create and set Slack app

open https://api.slack.com

- **Enable Bots, Interactive Components**

- **Interactive Components:**
    - `<endpoint>/<project-prefix>/<region>/slackAction`
    - During testing, [ngrok](https://ngrok.com/) can be used to obtain publicly accessible endpoints.

- **Bot Token Scopes:**
    - `chat:write`, `im:write`

- **User Token Scopes:**
    - `users:read`, `users:read:email`

## Need Firebase permission
- External networking
- signBlob

## Login firebase

```shell
$ npx firebase login:ci

Visit this URL on this device to log in:
https://accounts.google.com/o/oauth2/auth?client_id=560000000069-fgxxxxxxxxxxxxxxxxxxxxxxxxxxxxe6.apps.googleusercontent.com&scope=email%20openid%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloudplatformprojects.readonly%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Ffirebase%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform&response_type=code&state=900000000&redirect_uri=http%3A%2F%2Flocalhost%3A9005

Waiting for authentication...

✔  Success! Use this token to login on a CI server:

1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxc_yX0s

Example: firebase deploy --token "$FIREBASE_TOKEN"

$ export FIREBASE_TOKEN=1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxc_yX0s 
```

## Run local server

**Provide environment variables:**
```
export SLACK_WORKSPACE_TOKEN=xoxp-440000000063-440000000062-1000000000020-37ffffffffffffffffffffffffffffd9
export SLACK_WORKSPACE_BOT_TOKEN=xoxb-440000000063-1000000000007-Kuxxxxxxxxxxxxxxxxxxxxfj
export SLACK_SIGNING_SECRET=6fxxxxxxxxxxxxxxxxxxxxxxxxxxxxc5
export SLACK_WORKSPACE_ID=<WORKSPACE_ID>
```

**Run local server:**
```shell
$ npx firebase functions:config:set $(node tool/get-key-value-for-function-env.js)
$ npx firebase functions:config:get > functions/.runtimeconfig.json
$ export GOOGLE_APPLICATION_CREDENTIALS=../serviceAccountKey.json
$ yarn --cwd functions run serve
```

## Usage

**1. Request Authentification:**
```
$ curl -H 'Content-Type: application/json' -d '{"email":"example@email.com"}' \
  <endpoint>/<project-prefix>/<region>/requestSlackAuthentication
```

**2. Check Slack DM and select a correct code**

**3. Polling to get firebase custom token:**
```
curl -H 'Content-Type: application/json' -d '{"email":"example@gmail.com"}' \
  <endpoint>/<project-prefix>/<region>/pollingToGetCustomToken
```
