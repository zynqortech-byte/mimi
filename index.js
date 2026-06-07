const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const fs = require('fs')
const pino = require('pino')
const http = require('http')
const QRCode = require('qrcode')
require('dotenv').config()

// =============================================
// الإعدادات
// =============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const COFFEE_GROUP_KEYWORD = process.env.COFFEE_GROUP_KEYWORD || 'القهوة'
const PORT = process.env.PORT || 3000

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
- ردودك قصيرة ومضحكة — مش محاضرات (جملة أو جملتين بالكتير)

## أفيهات لازم تستخدمها:
- "والنبي ده كلام؟"
- "أنا كنت هقول كده بس خليت الكلام"
- "ربنا يستر"
- "أيوه يسطا"
- "ده أنا بقالي ساعة بفكر في نفس الكلام"
- "متقولش! بجد؟!"
- "ع الراحة يا عم"
- "ده كلام ولا إيه؟"
- ابتكر أفيهات جديدة من عندك

## مهم:
- ردودك قصيرة دايماً
- خليك خفيف الدم دايماً
- متبقاش رسمي أبداً
- لو سألوك عن ميمي قول إنه مشغول بالكود وهيجي بعد شوية
- لو سألوك عن شغلتك قول إنك بوت بيمثل ميمي`

// =============================================
// متغيرات عامة
// =============================================
const groupHistory = {}
const COFFEE_GROUP_FILE = 'coffee_group_id.txt'
let currentQR = null
let isConnected = false

// =============================================
// سيرفر ويب لعرض الـ QR
// =============================================
const server = http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (isConnected) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <html dir="rtl">
          <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0a0a0a;color:#25D366">
            <h1>✅ بوت ميمي شغال!</h1>
            <p style="color:#fff">الواتس متصل وكل حاجة تمام ☕</p>
          </body>
        </html>
      `)
      return
    }

    if (!currentQR) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <html dir="rtl">
          <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0a0a0a;color:#fff">
            <h2>⏳ بيتجهز الـ QR...</h2>
            <p>ارجع بعد 5 ثواني</p>
            <script>setTimeout(()=>location.reload(), 5000)</script>
          </body>
        </html>
      `)
      return
    }

    try {
      const qrImage = await QRCode.toDataURL(currentQR, { width: 300 })
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <html dir="rtl">
          <head>
            <title>بوت ميمي - QR Code</title>
            <meta http-equiv="refresh" content="30">
          </head>
          <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0a0a0a;color:#fff">
            <h1 style="color:#25D366">☕ بوت ميمي</h1>
            <h2>امسح الـ QR من واتس بيزنس</h2>
            <p style="color:#aaa">افتح واتس ← النقاط الثلاث ← الأجهزة المرتبطة ← ربط جهاز</p>
            <img src="${qrImage}" style="border:10px solid #25D366;border-radius:10px;margin:20px"/>
            <p style="color:#666;font-size:12px">الصفحة بتتجدد كل 30 ثانية تلقائياً</p>
          </body>
        </html>
      `)
    } catch (e) {
      res.writeHead(500)
      res.end('خطأ في توليد QR')
    }
    return
  }

  // الصفحة الرئيسية
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`
    <html dir="rtl">
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0a0a0a;color:#fff">
        <h1 style="color:#25D366">☕ بوت ميمي</h1>
        <a href="/qr" style="background:#25D366;color:#000;padding:15px 30px;border-radius:8px;text-decoration:none;font-size:18px;font-weight:bold">
          📱 امسح QR Code هنا
        </a>
      </body>
    </html>
  `)
})

server.listen(PORT, () => {
  console.log(`🌐 افتح الرابط ده في المتصفح لمسح الـ QR: http://localhost:${PORT}/qr`)
  console.log(`   (على Railway هتلاقي الرابط في قسم Settings ← Networking)`)
})

// =============================================
// Gemini AI
// =============================================
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

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
      isConnected = false
      console.log(`📱 QR جاهز! افتح: http://localhost:${PORT}/qr`)
      console.log(`   (على Railway: افتح رابط المشروع + /qr)`)
    }

    if (connection === 'close') {
      isConnected = false
      currentQR = null
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      console.log('❌ الاتصال اتقطع، الكود:', code)
      if (shouldReconnect) {
        console.log('🔄 بيتصل تاني...')
        setTimeout(connectToWhatsApp, 3000)
      } else {
        console.log('⚠️ تم تسجيل الخروج — امسح مجلد auth_info_baileys وابدأ تاني')
      }
    }

    if (connection === 'open') {
      isConnected = true
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
        if (!found) {
          console.log(`⚠️ مش لاقي جروب فيه "${COFFEE_GROUP_KEYWORD}" — تأكد من الاسم أو غير COFFEE_GROUP_KEYWORD`)
        }
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
          text.includes('ميمي') ||
          text.includes('mimy') ||
          text.includes('mimi') ||
          text.includes('mahmoud') ||
          text.includes('محمود')

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
