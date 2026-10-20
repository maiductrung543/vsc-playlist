const fs = require('fs');

async function fetchHighlights() {
    console.log('Đang kết nối tới ScoreBat Video API...');
    
    // Endpoint API v3 chuẩn của ScoreBat
    const url = 'https://www.scorebat.com/video-api/v3/feed/?token=MTc1MDcxXzE3Mjk0MjAyOTVfZmRhYWY5NzRiZGIxNjRkZmVkMDM1OTI2OGU4MTlhNWExYWU1ZTllMg==';

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        const matches = data.response || data || [];

        console.log(`Nhận được ${matches.length} trận đấu từ ScoreBat API.`);

        let m3uContent = '#EXTM3U\n';

        if (Array.isArray(matches) && matches.length > 0) {
            matches.forEach((item) => {
                const title = item.title || 'Highlight Match';
                const competition = item.competition || 'International Football';
                const thumbnail = item.thumbnail || '';
                
                // Lấy URL iframe/video nhúng từ API
                let videoUrl = item.matchviewUrl || 'https://www.scorebat.com';
                if (item.videos && item.videos.length > 0) {
                    const embedHtml = item.videos[0].embed || '';
                    const srcMatch = embedHtml.match(/src='([^']+)'/) || embedHtml.match(/src="([^"]+)"/);
                    if (srcMatch && srcMatch[1]) {
                        videoUrl = srcMatch[1];
                    }
                }

                m3uContent += `#EXTINF:-1 tvg-logo="${thumbnail}" group-title="${competition}",${title}\n`;
                m3uContent += `${videoUrl}\n`;
            });
        } else {
            // Trường hợp dự phòng nếu API v3 thay đổi cấu trúc key
            m3uContent += `#EXTINF:-1,ScoreBat Feed (Updating)\nhttps://www.scorebat.com\n`;
        }

        fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
        console.log('Đã tạo xong file playlist.m3u thành công!');

    } catch (error) {
        console.error('Lỗi khi tải API:', error.message);
        
        // Thử lại với Endpoint API v1 fallback công khai
        try {
            console.log('Thử lại với Endpoint dự phòng v1...');
            const resV1 = await fetch('https://www.scorebat.com/video-api/v1/', {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const dataV1 = await resV1.json();
            
            let m3uContent = '#EXTM3U\n';
            dataV1.forEach(item => {
                let videoUrl = item.url || item.embed || 'https://www.scorebat.com';
                const srcMatch = videoUrl.match(/src='([^']+)'/) || videoUrl.match(/src="([^"]+)"/);
                if (srcMatch && srcMatch[1]) videoUrl = srcMatch[1];

                m3uContent += `#EXTINF:-1 tvg-logo="${item.thumbnail || ''}",${item.title || 'Highlight'}\n`;
                m3uContent += `${videoUrl}\n`;
            });
            fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
            console.log('Tạo playlist thành công qua Endpoint dự phòng v1!');
        } catch (e2) {
            console.error('Lỗi endpoint dự phòng:', e2.message);
        }
    }
}

fetchHighlights();
