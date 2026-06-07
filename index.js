const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const fs = require('fs')
const pino = require('pino')
const express = require('express')
const qrcode = require('qrcode')
require('dotenv').config()

// =============================================
// سيرفر عشان يعرض الـ QR Code
// =============================================
const app = express()
let currentQR = null

app.get('/', async (req, res) => {
  if (!currentQR) {
    return res.send(`
      <html><body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:50px">
        <h2>✅ البوت متصل أو لسه بيشتغل</h2>
        <p>لو البوت مش شغال، استنى شوية وحدث الصفحة</p>
        <script>setTimeout(()=>location.reload(), 3000)</script>
      </body></html>
    `)
  }

  const qrImage = await qrcode.toDataURL(currentQR)
  res.send(`
    <html><body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:30px">
      <h2>📱 امسح الـ QR Code من واتساب</h2>
      <p>افتح واتساب ← النقاط الثلاث ← الأجهزة المرتبطة ← ربط جهاز</p>
      <img src="${qrImage}" style="width:300px;height:300px;border:4px solid #25D366;border-radius:12px"/>
      <p style="color:#aaa">الصفحة بتتحدث كل 30 ثانية</p>
      <script>setTimeout(()=>location.reload(), 30000)</script>
    </body></html>
  `)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🌐 افتح الرابط بتاع Railway عشان تشوف الـ QR Code`))

// =============================================
// الإعدادات
// =============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const COFFEE_GROUP_KEYWORD = process.env.COFFEE_GROUP_KEYWORD || 'القهوة'
const COFFEE_GROUP_FILE = 'coffee_group_id.txt'

// =============================================
// البرومبت بتاع ميمي
// =============================================
const SYSTEM_PROMPT = `أنت "بوت ميمي" — بتمثل محمود ميمي اللي مش موجود دلوقتي.

## مين إنت؟
اسمك محمود ميمي، مبرمج PHP Laravel و React، وصاحب شركة Zynqor للبرمجة وتطوير الويب، أصلك من أسوان وشايل هموم الكود من الصبح للليل.

## قواعد صارمة:
- إنت بتشتغل في جروب القهوة بس.
- أي جروب تاني أو أي شخص خارج الجروب ده، تجاهل تماماً ومردش خالص.

## شخصيتك:
- فكاهي جداً وعندك أفيه على أي كلام
- بترمي نكت ومقولات مصرية حتى لو مش بيكلموك
- بتدخل على الكلام بدون إذن وكأنك كنت موجود طول الوقت
- بتحب تعلق على أي حاجة بطريقة ساخرة وخفيفة
- بتتكلم بالعربي المصري الخالص
- ردودك قصيرة ومضحكة — جملة أو جملتين بالكتير

## أفيهات:
- "والنبي ده كلام؟"
- "أنا كنت هقول كده بس خليت الكلام"
- "ربنا يستر"
- "أيوه يسطا"
- "ده أنا بقالي ساعة بفكر في نفس الكلام"
- "متقولش! بجد؟!"
- "ع الراحة يا عم"
- ابتكر أفيهات جديدة

## مهم:
- ردودك قصيرة دايماً
- خليك خفيف الدم دايماً
- متبقاش رسمي أبداً
- لو سألوك عن ميمي قول إنه مشغول بالكود وهيجي بعد شوية`

// =============================================
// Gemini AI
// =============================================
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const groupHistory = {}

async function getAIResponse(history) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 200, temperature: 0.9 }
  })

  const cleanHistory = []
  for (let i = 0; i < history.length - 1; i++) {
    if (cleanHistory.length === 0 || cleanHistory[cleanHistory.length - 1].role !== history[i].role) {
      cleanHistory.push(history[i])
    }
  }

  const chat = model.startChat({ history: cleanHistory })
  const lastMsg = history[history.length - 1]
  const result = await chat.sendMessage(lastMsg.parts[0].text)
  return result.response.text().trim()
}

// =============================================
// الكود الرئيسي
// =============================================
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      currentQR = qr
      console.log('📱 QR Code جاهز! افتح رابط Railway عشان تمسحه')
    }

    if (connection === 'close') {
      currentQR = null
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      console.log('❌ الاتصال اتقطع، الكود:', code)
      if (shouldReconnect) {
        console.log('🔄 بيتصل تاني...')
        setTimeout(connectToWhatsApp, 3000)
      } else {
        console.log('⚠️ تم تسجيل الخروج')
      }
    }

    if (connection === 'open') {
      currentQR = null
      console.log('✅ بوت ميمي شغال وجاهز! ☕')

      try {
        const groups = await sock.groupFetchAllParticipating()
        let found = false
        for (const [id, group] of Object.entries(groups)) {
          if (group.subject && group.subject.includes(COFFEE_GROUP_KEYWORD)) {
            console.log(`☕ لقيت جروب القهوة: "${group.subject}"`)
            fs.writeFileSync(COFFEE_GROUP_FILE, id, 'utf8')
            found = true
            break
          }
        }
        if (!found) console.log(`⚠️ مش لاقي جروب فيه "${COFFEE_GROUP_KEYWORD}"`)
      } catch (err) {
        console.error('مش قادر يجيب الجروبات:', err.message)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue
        if (!msg.message) continue

        const chatId = msg.key.remoteJid
        if (!chatId.endsWith('@g.us')) continue
        if (!fs.existsSync(COFFEE_GROUP_FILE)) continue

        const coffeeGroupId = fs.readFileSync(COFFEE_GROUP_FILE, 'utf8').trim()
        if (chatId !== coffeeGroupId) continue

        const text = msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption || ''

        if (!text.trim()) continue

        const senderName = msg.pushName || 'حد'
        const myNumber = sock.user?.id?.split(':')[0] || ''

        const isDirectlyMentioned =
          text.includes('@' + myNumber) ||
          text.includes('ميمي') || text.includes('mimy') ||
          text.includes('mimi') || text.includes('محمود')

        const shouldRespond = isDirectlyMentioned || Math.random() < 0.35
        if (!shouldRespond) continue

        if (!groupHistory[chatId]) groupHistory[chatId] = []
        groupHistory[chatId].push({ role: 'user', parts: [{ text: `${senderName}: ${text}` }] })
        if (groupHistory[chatId].length > 10) groupHistory[chatId] = groupHistory[chatId].slice(-10)

        console.log(`💬 ${senderName}: ${text}`)
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))

        const response = await getAIResponse(groupHistory[chatId])
        groupHistory[chatId].push({ role: 'model', parts: [{ text: response }] })

        await sock.sendMessage(chatId, { text: response })
        console.log(`🤖 ميمي: ${response}`)

      } catch (err) {
        console.error('❌ خطأ:', err.message)
      }
    }
  })
}

connectToWhatsApp()
