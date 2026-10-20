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

    let m3u8Map = new Map();

    // Bắt toàn bộ luồng request .m3u8 ngầm
    page.on('request', req => {
        const url = req.url();
        if (url.includes('.m3u8')) {
            console.log('Bắt được M3U8:', url);
            m3u8Map.set(url, url);
        }
    });

    try {
        console.log('Đang truy cập vsc9.vip/highlight...');
        await page.goto('https://vsc9.vip/highlight', { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Chờ 8 giây để trang nạp xong dữ liệu JavaScript và các frame video
        await new Promise(r => setTimeout(r, 8000));

        // Cào dữ liệu thẻ trận đấu, tên, logo và thumbnail trực tiếp từ DOM
        const items = await page.evaluate(() => {
            let data = [];
            // Tìm tất cả các thẻ chứa link xem/highlight trên trang
            const cards = document.querySelectorAll('a[href*="/highlight/"], a[href*="/truc-tiep/"], div[class*="item"]');

            cards.forEach(card => {
                let text = card.innerText ? card.innerText.trim().replace(/\n+/g, ' - ') : '';
                let img = card.querySelector('img');
                let thumb = img ? img.src : '';

                if (text && text.length > 3) {
                    data.push({
                        title: text,
                        logo: thumb
                    });
                }
            });

            // Lọc bỏ các mục trùng lặp
            const uniqueData = Array.from(new Set(data.map(a => a.title)))
                .map(title => data.find(a => a.title === title));

            return uniqueData;
        });

        console.log(`Cào được ${items.length} mục highlight/trận đấu.`);
        const m3u8List = Array.from(m3u8Map.keys());

        // Tạo nội dung Playlist M3U chuẩn
        let m3uContent = '#EXTM3U\n';
        
        if (items.length > 0) {
            items.forEach((item, index) => {
                let streamUrl = m3u8List[index] || m3u8List[0] || '';
                if (streamUrl) {
                    m3uContent += `#EXTINF:-1 tvg-logo="${item.logo}",${item.title}\n`;
                    m3uContent += `${streamUrl}\n`;
                }
            });
        } else if (m3u8List.length > 0) {
            // Trường hợp không cào được tên nhưng bắt được link m3u8
            m3u8List.forEach((url, i) => {
                m3uContent += `#EXTINF:-1,Highlight Match ${i + 1}\n`;
                m3uContent += `${url}\n`;
            });
        }

        fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
        console.log('Ghi file playlist.m3u thành công!');

    } catch (err) {
        console.error('Lỗi trong quá trình chạy:', err);
    } finally {
        await browser.close();
    }
}

runScraper();
