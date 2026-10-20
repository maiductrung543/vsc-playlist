const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function runScraper() {
    console.log('Khởi động trình duyệt giả lập Stealth...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    const page = await browser.newPage();
    
    // Đặt User-Agent thực tế của Chrome Desktop
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1440, height: 900 });

    let streamLinks = new Set();

    // Lắng nghe tất cả luồng mạng (Network Request)
    page.on('response', async response => {
        const url = response.url();
        if (url.includes('.m3u8') || url.includes('index.m3u8') || url.includes('/hls/')) {
            console.log('[BẮT ĐƯỢC M3U8]:', url);
            streamLinks.add(url);
        }
    });

    try {
        console.log('Truy cập https://vsc9.vip/highlight ...');
        await page.goto('https://vsc9.vip/highlight', {
            waitUntil: 'networkidle2',
            timeout: 90000
        });

        // Chờ 10 giây để vượt Cloudflare Turnstile / JavaScript Rendering
        await new Promise(r => setTimeout(r, 10000));

        // Cuộn trang tự động để kích hoạt Lazy-load
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 200;
                let timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= document.body.scrollHeight || totalHeight > 3000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Trích xuất danh sách tên trận và link trận đấu
        const matchData = await page.evaluate(() => {
            let results = [];
            // Tìm tất cả các liên kết chứa highlight hoặc trực tiếp
            const anchors = Array.from(document.querySelectorAll('a'));
            
            anchors.forEach(a => {
                let text = a.innerText ? a.innerText.trim().replace(/\n+/g, ' - ') : '';
                let href = a.href || '';
                let img = a.querySelector('img');
                let logo = img ? img.src : '';

                if (text.length > 3 && (href.includes('highlight') || href.includes('detail') || href.includes('match') || text.includes('vs'))) {
                    results.push({ title: text, href: href, logo: logo });
                }
            });

            // Lọc trùng lặp theo tiêu đề
            return results.filter((item, index, self) =>
                index === self.findIndex((t) => t.title === item.title)
            );
        });

        console.log(`Tìm thấy ${matchData.length} thẻ trận đấu.`);

        // Duyệt qua tối đa 5 trận đầu tiên để kích hoạt khung phát stream
        const detailLinks = matchData.map(m => m.href).filter(h => h.length > 0);
        for (let i = 0; i < Math.min(detailLinks.length, 5); i++) {
            try {
                console.log(`Kiểm tra trang con [${i + 1}]: ${detailLinks[i]}`);
                const subPage = await browser.newPage();
                subPage.on('response', response => {
                    const url = response.url();
                    if (url.includes('.m3u8') || url.includes('/hls/')) {
                        streamLinks.add(url);
                    }
                });

                await subPage.goto(detailLinks[i], { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 5000)); // Đợi video player nạp luồng .m3u8
                await subPage.close();
            } catch (e) {
                console.log(`Lỗi trang con ${i + 1}:`, e.message);
            }
        }

        const finalStreamList = Array.from(streamLinks);
        console.log(`Tổng cộng bắt được ${finalStreamList.length} link stream .m3u8.`);

        // Tạo tệp playlist.m3u
        let m3uContent = '#EXTM3U\n';

        if (finalStreamList.length > 0) {
            finalStreamList.forEach((streamUrl, idx) => {
                let info = matchData[idx] || { title: `Highlight Match ${idx + 1}`, logo: '' };
                m3uContent += `#EXTINF:-1 tvg-logo="${info.logo}",${info.title}\n`;
                m3uContent += `${streamUrl}\n`;
            });
        } else if (matchData.length > 0) {
            // Trường hợp có thông tin trận đấu nhưng chưa bắt được luồng m3u8
            matchData.forEach((info) => {
                m3uContent += `#EXTINF:-1 tvg-logo="${info.logo}",${info.title} (Đang cập nhật luồng)\n`;
                m3uContent += `https://vsc9.vip/highlight\n`;
            });
        }

        fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
        console.log('Cập nhật playlist.m3u thành công!');

    } catch (err) {
        console.error('Lỗi chính:', err);
    } finally {
        await browser.close();
    }
}

runScraper();
