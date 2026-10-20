const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function runScraper() {
    console.log('Đang khởi động trình duyệt tàng hình...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    let m3u8List = [];

    // Bắt tất cả các request m3u8 phát sinh từ mọi trang con
    page.on('request', req => {
        let url = req.url();
        if (url.includes('.m3u8') && !m3u8List.includes(url)) {
            console.log('Bắt được link stream:', url);
            m3u8List.push(url);
        }
    });

    try {
        console.log('Đang truy cập trang chính vsc9.vip/highlight...');
        await page.goto('https://vsc9.vip/highlight', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        // 1. Quét tên các trận đấu hiển thị trên trang
        let matchNames = await page.evaluate(() => {
            let titles = [];
            let elements = document.querySelectorAll('a, div, span, h3, h4');
            elements.forEach(el => {
                let text = el.innerText ? el.innerText.trim() : '';
                // Lọc các chuỗi có định dạng tên cặp đấu
                if (text && text.includes(' vs ') && text.length < 80 && !titles.includes(text)) {
                    titles.push(text);
                }
            });
            return titles;
        });

        console.log(`Tìm thấy ${matchNames.length} tên trận đấu.`);

        // 2. Lấy danh sách các đường dẫn (links) của các trận đấu trên trang
        let matchHrefs = await page.evaluate(() => {
            let links = [];
            let anchors = document.querySelectorAll('a');
            anchors.forEach(a => {
                if (a.href && (a.href.includes('highlight') || a.href.includes('match') || a.href.includes('truc-tiep')) && !links.includes(a.href)) {
                    links.push(a.href);
                }
            });
            return links;
        });

        console.log(`Tìm thấy ${matchHrefs.length} đường dẫn trận đấu. Tiến hành cào sâu...`);

        // 3. Tự động ghé thăm các trang trận đấu để kích hoạt link m3u8 load ngầm
        for (let i = 0; i < Math.min(matchHrefs.length, 8); i++) {
            try {
                let subPage = await browser.newPage();
                await subPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                
                subPage.on('request', req => {
                    let url = req.url();
                    if (url.includes('.m3u8') && !m3u8List.includes(url)) {
                        m3u8List.push(url);
                    }
                });

                console.log(`Đang mở link chi tiết [${i+1}]: ${matchHrefs[i]}`);
                await subPage.goto(matchHrefs[i], { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 4000)); // Chờ player load stream
                await subPage.close();
            } catch (err) {
                console.log('Lỗi khi mở trang con:', err.message);
            }
        }

        console.log(`Tổng hợp: Bắt được ${m3u8List.length} link m3u8.`);

        // 4. Tạo file playlist.m3u hoàn chỉnh
        let m3uContent = '#EXTM3U\n';
        if (m3u8List.length > 0) {
            m3u8List.forEach((url, index) => {
                let name = matchNames[index] || `Highlight Trận ${index + 1}`;
                m3uContent += `#EXTINF:-1,${name.replace(/\n/g, ' - ')}\n`;
                m3uContent += `${url}\n`;
            });
        }

        fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
        console.log('Đã ghi file playlist.m3u thành công!');

    } catch (err) {
        console.error('Lỗi thực thi script:', err);
    } finally {
        await browser.close();
    }
}

runScraper();
