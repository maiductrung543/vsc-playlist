const puppeteer = require('puppeteer');
const fs = require('fs');

async function runScraper() {
    console.log('Đang khởi động trình duyệt ảo...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    let m3u8List = [];
    page.on('request', req => {
        if (req.url().includes('.m3u8')) {
            m3u8List.push(req.url());
        }
    });

    try {
        console.log('Đang truy cập trang vsc9.vip/highlight...');
        await page.goto('https://vsc9.vip/highlight', { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 6000)); // Chờ load dữ liệu

        // Lấy danh sách tên trận đấu từ trang
        const matches = await page.evaluate(() => {
            let items = [];
            const cards = document.querySelectorAll('.grid > div, .match-card, .item-highlight');
            cards.forEach(card => {
                let text = card.innerText.trim().replace(/\n/g, ' - ');
                if(text) items.push(text);
            });
            return items;
        });

        console.log(`Tìm thấy ${matches.length} trận, bắt được ${m3u8List.length} link m3u8.`);

        // Tạo nội dung file playlist.m3u
        let m3uContent = '#EXTM3U\n';
        matches.forEach((matchName, index) => {
            let streamUrl = m3u8List[index] || m3u8List[0]; // Gán link m3u8 tương ứng
            if (streamUrl) {
                m3uContent += `#EXTINF:-1,${matchName}\n`;
                m3uContent += `${streamUrl}\n`;
            }
        });

        fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
        console.log('Đã tạo xong file playlist.m3u thành công!');

    } catch (error) {
        console.error('Lỗi khi cào dữ liệu:', error);
    } finally {
        await browser.close();
    }
}

runScraper();
