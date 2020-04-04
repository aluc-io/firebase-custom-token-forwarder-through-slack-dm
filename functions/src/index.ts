import { https, config } from 'firebase-functions'
import to from 'await-to-js'
import { initializeApp, auth } from 'firebase-admin'
import { WebClient, KnownBlock } from '@slack/web-api'
import { createMessageAdapter } from '@slack/interactive-messages'
import ms from 'ms'
import { UserRecord } from 'firebase-functions/lib/providers/auth'

type SlackUser = {
  id: string
  team_id: string
  name: string
  deleted: boolean
  color: string
  real_name: string
  tz: string
  tz_label: string
  tz_offset: number
  profile: {
    title: string
    phone: string
    skype: string
    real_name: string
    real_name_normalized: string
    display_name: string
    display_name_normalized: string
    status_text: string
    status_emoji: string
    status_expiration: number
    avatar_hash: number
    email: number
    image_24: string
    image_32: string
    image_48: string
    image_72: string
    image_192: string
    image_512: string
    status_text_canonical: string
    team: string
  }
  is_admin: boolean
  is_owner: boolean
  is_primary_owner: boolean
  is_restricted: boolean
  is_ultra_restricted: boolean
  is_bot: boolean
  is_app_user: boolean
  updated: number
  has_2fa: boolean
}

type ResConversationsOpen = {
  ok: boolean
  channel: {
    id: string
  }
}

type ButtonValue = {
  email: string
  code: string
}

const isResConversationsOpen = (o: any): o is ResConversationsOpen => {
  if (typeof o !== 'object') return false
  if (typeof o.ok !== 'boolean') return false
  if (typeof o.channel !== 'object') return false
  if (typeof o.channel.id !== 'string') return false

  return true
}

const isSlackUser = (o: any): o is SlackUser => {
  if (typeof o !== 'object') return false
  if (typeof o.id !== 'string') return false
  if (typeof o.deleted !== 'boolean') return false
  if (typeof o.is_admin !== 'boolean') return false
  if (typeof o.is_bot !== 'boolean') return false
  if (typeof o.is_app_user !== 'boolean') return false

  return true
}

const PROJECT_NAME = config().f46m['project-name'] || 'test project'
const SLACK_WORKSPACE_TOKEN = config().f46m['slack-workspace-token']
const SLACK_WORKSPACE_BOT_TOKEN = config().f46m['slack-workspace-bot-token']
const SLACK_SIGNING_SECRET = config().f46m['slack-signing-secret']

const swc = new WebClient(SLACK_WORKSPACE_TOKEN)
const swcBot = new WebClient(SLACK_WORKSPACE_BOT_TOKEN)
const slackInteractions = createMessageAdapter(SLACK_SIGNING_SECRET);

const BLOCK_ID = 'f46d.verificationBlock'
const msg = (email: string): KnownBlock[] => [
  {
    "type": "section",
    "text": { "type": "mrkdwn", "text": `[${PROJECT_NAME}] 본인 인증을 위해 코드를 선택해주세요.` }
  },
  {
    "type": "actions",
    block_id: BLOCK_ID,
    "elements": codes.map(code => {
      const value: ButtonValue = { code, email }
      return {
        "type": "button",
        "text": { "type": "plain_text", "emoji": true, "text": code },
        "style": "primary",
        "value": JSON.stringify(value),
      }
    }),
  },
]

initializeApp()

const getValidSlackUserId = async (email: string) => {
  const [err,r] = await to<any,any>(swc.users.lookupByEmail({ email }))
  if (err?.data?.error === 'users_not_found') throw new Error('Slack 유저가 아닙니다')
  if (err?.data?.error) throw new Error('Unknown Error: ' + err.data.error)

  const slackUser = r?.user
  if (!isSlackUser(slackUser)) throw new Error('Wrong Slack user')

  if (slackUser.deleted) throw new Error('Deleted Slack user')
  if (slackUser.is_bot) throw new Error('Slack bot user')

  return slackUser.id
}

const codes = [
  '치킨', '피자', '짜장면', '초밥', '냉면', '짜파구리', '족발', '보쌈'
]

const getFirebaseUser = async (email: string) => {
  let [err, fbUser] = await to<UserRecord,any>(auth().getUserByEmail(email))
  if (err?.errorInfo?.code === 'auth/user-not-found') {
    [err, fbUser] = await to(auth().createUser({ email }))
  }

  if (!fbUser) throw err

  return fbUser
}

const sendError = (res: any, err: any, varName: string, statusCode?: number) => {
  if (err) return res.send({ ok: false, message: err.message })

  res.status(statusCode || 500).send({ ok: false, error: `empty '${varName}'` })
}

exports.requestSlackAuthentication = https.onRequest(async (req, res) => {
  const email = req.body.email
  console.log('email: ' + email)

  const [err, slackUserId] = await to<string, any>(getValidSlackUserId(email))
  if (err || !slackUserId) return sendError(res, err, 'slackUserId', 413)
  console.log('slackUserId: ' + slackUserId)

  const [err2, fbUser] = await to(getFirebaseUser(email))
  if (err2 || !fbUser) return sendError(res, err2, 'fbUser', 413)

  const verificationCode = codes[Math.floor(Math.random() * codes.length)]
  const props = { hasUserSelectedCode: false, verificationCode, ts: new Date().getTime() }
  await auth().setCustomUserClaims(fbUser.uid, props)

  const [, r] = await to(swcBot.conversations.open({ users: slackUserId }))
  if (!isResConversationsOpen(r)) return res.status(500).send('Can not start DM')
  console.log('channelId: ' + r.channel.id)

  const text = `[${PROJECT_NAME}] 인증 메시지가 도착하였습니다.`
  const arg = { channel: r.channel.id, text, blocks: msg(email) }
  const [err3] = await to(swcBot.chat.postMessage(arg))
  if (err3) return res.status(500).send({ ok: false, message: 'Error when send message' })

  res.status(200).send({ ok: true, verificationCode, message: 'Sent veryfication message as Slack DM' })
})

slackInteractions.action({ blockId: BLOCK_ID }, async (payload, res) => {
  const action = payload.actions[0]
  const value = JSON.parse(action.value) as ButtonValue
  const { email, code } = value

  let [err,user] = await to(getFirebaseUser(email))
  if (err || !user) return res({ text: '인증 실패. Unknown Error' })

  const gap = new Date().getTime() - (user.customClaims?.ts || 0)
  if (gap > ms('2m')) {
    await auth().setCustomUserClaims(user.uid, { hasUserSelectedCode: true, isVerificated: false })
    return res({ text: '인증 실패. 타임아웃. 2분 내에 인증해야 합니다' })
  }

  const isVerificated = user.customClaims?.verificationCode === code
  await auth().setCustomUserClaims(user.uid, { hasUserSelectedCode: true, isVerificated })

  const msgSuccess = '인증성공. 인증을 요청한 브라우저에서 로그인 됩니다'
  const msgFail = '인증실패. 잘못 된 코드를 선택하였습니다.'
  res({ text: isVerificated ? msgSuccess : msgFail })
})
exports.slackAction = https.onRequest(slackInteractions.requestListener())

exports.pollingToGetCustomToken = https.onRequest(async (req, res) => {
  const email = req.body.email
  const [err, fbUser] = await to(getFirebaseUser(email))
  if (err || !fbUser) return sendError(res, err, 'fbUser', 500)

  const { hasUserSelectedCode, isVerificated } = fbUser.customClaims || {}
  if (!hasUserSelectedCode) return res.status(200).send({ hasUserSelectedCode })

  // first reset and send result
  await auth().setCustomUserClaims(fbUser.uid, { hasUserSelectedCode: false })

  const customToken = isVerificated ? await auth().createCustomToken(fbUser.uid) : ''
  return res.status(200).send({ hasUserSelectedCode: true, isVerificated, customToken })
})
