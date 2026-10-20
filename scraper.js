const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function runScraper() {
    console.log('Đang khởi động trình duyệt tàng hình (Stealth Mode)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    
    // Giả lập thông tin thiết bị và User-Agent giống hệt người dùng thật trên máy tính
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    let m3u8Set = new Set();

    // Bắt mọi request mạng có chứa định dạng luồng stream
    page.on('request', req => {
        const url = req.url();
        if (url.includes('.m3u8') || url.includes('.ts')) {
            console.log('Bắt được luồng stream:', url);
            m3u8Set.add(url);
        }
    });

    try {
        console.log('Đang truy cập vsc9.vip/highlight...');
        await page.goto('https://vsc9.vip/highlight', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Mô phỏng hành vi cuộn trang xuống dưới để kích hoạt các thành phần ẩn nạp dữ liệu
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 150;
                let timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= document.body.scrollHeight || totalHeight > 4000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Chờ thêm 8 giây để các tập lệnh video và API hoàn tất phản hồi
        await new Promise(r => setTimeout(r, 8000));

        // Quét lấy tiêu đề các trận đấu trên trang
        const matchTitles = await page.evaluate(() => {
            let titles = [];
            const elements = document.querySelectorAll('h3, h4, .title, .match-name, a');
            elements.forEach(el => {
                let text = el.innerText.trim();
                // Lọc lấy các chuỗi có định dạng tên trận đấu
                if (text && (text.includes(' vs ') || text.includes(' - ') || text.length > 8)) {
                    titles.push(text);
                }
            });
            return [...new Set(titles)];
        });

        console.log(`Tìm thấy ${matchTitles.length} tên trận và ${m3u8Set.size} link stream.`);

        let m3u8List = Array.from(m3u8Set);
        let m3uContent = '#EXTM3U\n';

        // Lập bảng ghép nối tiêu đề và link stream
        matchTitles.forEach((title, index) => {
            let streamUrl = m3u8List[index] || m3u8List[0];
            if (streamUrl) {
                m3uContent += `#EXTINF:-1,${title}\n`;
                m3uContent += `${streamUrl}\n`;
            }
        });

        // Fallback: Nếu không bắt được tên nhưng có link stream m3u8
        if (m3u8List.length > 0 && matchTitles.length === 0) {
            m3u8List.forEach((url, i) => {
                m3uContent += `#EXTINF:-1,Highlight Match ${i + 1}\n`;
                m3uContent += `${url}\n`;
            });
        }

        fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
        console.log('Đã tạo xong file playlist.m3u thành công!');

    } catch (err) {
        console.error('Lỗi thực thi:', err);
    } finally {
        await browser.close();
    }
}

runScraper();
