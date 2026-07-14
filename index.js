const puppeteer = require('puppeteer');
const fs = require('fs');

const API_URL = 'https://www.acmawards50.com/api.php';

// دالة التقاط الروابط من الشبكة (كما هي بدون تغيير)
async function getDirectStream(browser, iframeUrl) {
    if (!iframeUrl) return "";
    const fullIframeUrl = iframeUrl.startsWith('//') ? `https:${iframeUrl}` : iframeUrl;

    return new Promise(async (resolve) => {
        let found = false;
        let page;
        try {
            page = await browser.newPage();
            // محاكاة متصفح حقيقي بالكامل
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
            
            page.on('request', (request) => {
                if (request.url().includes('.m3u8') && !found) {
                    found = true;
                    resolve(request.url());
                    page.close().catch(() => {});
                }
            });

            await page.goto(fullIframeUrl, { waitUntil: 'networkidle2', timeout: 25000 });
            
            // محاكاة نقرة للبدء (ضرورية للمشغلات)
            await page.mouse.click(500, 300).catch(() => {});
            
            setTimeout(() => {
                if (!found) { page.close().catch(() => {}); resolve(""); }
            }, 12000);
        } catch (e) {
            if (page) await page.close().catch(() => {});
            resolve("");
        }
    });
}

async function scrapeMatches() {
    let browser;
    try {
        console.log("📥 جاري جلب البيانات من الـ API...");
        
        // جلب البيانات من واجهة JSON مباشرة (يتطلب Node.js 18 أو أحدث)
        const response = await fetch(API_URL);
        const data = await response.json();
        
        let finalMatches = [];
        
        // التحقق من وجود مباريات في الرد
        if (data && data.success && Array.isArray(data.matches) && data.matches.length > 0) {
            console.log("🚀 جاري تهيئة المتصفح لاستخراج البثوث...");
            browser = await puppeteer.launch({ 
                headless: "new", 
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'] 
            });

            for (let match of data.matches) {
                console.log(`⏳ جاري استخراج بث: ${match.home_team}`);
                
                let streamLink = "";
                if (match.match_url) {
                    streamLink = await getDirectStream(browser, match.match_url);
                }

                // هيكلة البيانات لتطابق النسخة الثابتة المطلوبة
                finalMatches.push({
                    team1: match.home_team || "",
                    team1Logo: match.home_logo || "",
                    team2: match.away_team || "",
                    team2Logo: match.away_logo || "",
                    time: match.time || "",
                    status: match.status_text || "",
                    league: match.league || "",
                    streamUrl: match.match_url || "",
                    channel: match.channel || "غير متوفر",
                    LastTime: new Date().toLocaleString('ar-EG'),
                    stream: streamLink
                });
            }
        } else {
            console.log("⚠️ لا توجد مباريات أو البيانات فارغة، سيتم إنشاء مصفوفة فارغة.");
        }

        // حفظ المصفوفة سواء كانت ممتلئة أو فارغة [ ]
        fs.writeFileSync('match1.json', JSON.stringify(finalMatches, null, 2), 'utf8');
        console.log("✅ انتهى العمل. تم حفظ البيانات في match1.json");

    } catch (error) {
        console.error('❌ خطأ فادح:', error.message);
        // توليد مصفوفة فارغة في حالة حدوث فشل بالاتصال لضمان عدم توقف التطبيق الذي يقرأ الملف
        fs.writeFileSync('match1.json', JSON.stringify([], null, 2), 'utf8');
    } finally {
        if (browser) await browser.close();
    }
}

scrapeMatches();
