const fs = require('fs');

async function generatePlaylist() {
    console.log('Đang lấy dữ liệu từ ScoreBat API và bóc tách link video gốc...');
    const apiUrl = 'https://www.scorebat.com/video-api/v1/';
    
    let m3uContent = '#EXTM3U\n';

    try {
        const response = await fetch(apiUrl);
        const matches = await response.json();

        console.log(`Tìm thấy ${matches.length} trận đấu. Đang xử lý lấy link video...`);

        for (let item of matches) {
            const title = item.title || 'Highlight';
            const thumb = item.thumbnail || '';
            const competition = item.competition ? (item.competition.name || item.competition) : 'Football';
            
            let directVideoUrl = '';

            // Trích xuất link iframe embed từ dữ liệu API
            let embedHtml = item.embed || '';
            let matchSrc = embedHtml.match(/src="([^"]+)"/) || embedHtml.match(/src='([^']+)'/');
            
            if (matchSrc && matchSrc[1]) {
                let embedUrl = matchSrc[1];
                if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;

                try {
                    // Truy cập vào trang embed để tìm link file video thực tế bên trong
                    const embedRes = await fetch(embedUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    const embedText = await embedRes.text();

                    // Quét tìm link đuôi .mp4 hoặc .m3u8 thực tế
                    let videoMatch = embedText.match(/"(https:\/\/[^"]+\.mp4[^"]*)"/) || 
                                     embedText.match(/'(https:\/\/[^']+\.mp4[^']*)'/) ||
                                     embedText.match(/"(https:\/\/[^"]+\.m3u8[^"]*)"/) ||
                                     embedText.match(/'(https:\/\/[^']+\.m3u8[^']*)'/);

                    if (videoMatch && videoMatch[1]) {
                        directVideoUrl = videoMatch[1];
                    } else {
                        directVideoUrl = embedUrl; // Fallback nếu trang mã hóa sâu
                    }
                } catch (e) {
                    directVideoUrl = embedUrl;
                }
            } else if (item.url) {
                directVideoUrl = item.url;
            }

            if (directVideoUrl) {
                m3uContent += `#EXTINF:-1 tvg-logo="${thumb}" group-title="${competition}",${title}\n`;
                m3uContent += `${directVideoUrl}\n`;
            }
        }

    } catch (error) {
        console.error('Lỗi:', error.message);
        m3uContent += '#EXTINF:-1,ScoreBat Error\nhttps://www.scorebat.com\n';
    }

    fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
    console.log('Đã cập nhật playlist.m3u hoàn chỉnh!');
}

generatePlaylist();
