const arr = [
  ['project-name',              process.env.PROJECT_NAME              ].join('='),
  ['slack-workspace-token',     process.env.SLACK_WORKSPACE_TOKEN     ].join('='),
  ['slack-workspace-bot-token', process.env.SLACK_WORKSPACE_BOT_TOKEN ].join('='),
  ['slack-signing-secret',      process.env.SLACK_SIGNING_SECRET      ].join('='),
  ['slack-workspace-id',        process.env.SLACK_WORKSPACE_ID        ].join('='),
]
console.log(arr.map(str => 'f46m.' + str).join(' '))
