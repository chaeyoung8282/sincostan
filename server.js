// server.js 파일

// Node.js 기본 모듈 임포트
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Render 환경 변수에서 PORT 번호를 가져오거나 기본값 8080 사용
// Render는 내부적으로 PORT 환경 변수를 제공합니다.
const PORT = process.env.PORT || 8080;

// 1. HTTP 서버 설정 (HTML, CSS, JS 파일 제공 역할)
const server = http.createServer((req, res) => {
    // 요청 URL을 기반으로 파일 경로 설정
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    
    // MIME 타입 정의: 브라우저에게 파일 종류를 알려줍니다.
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png', // 이미지도 처리할 수 있도록 추가
        '.jpg': 'image/jpeg',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // 파일 읽기 및 전송
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 파일이 없을 경우 404 응답
                res.writeHead(404);
                res.end('File not found: ' + filePath);
            } else {
                // 기타 서버 에러 발생 시 500 응답
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
        } else {
            // 성공적으로 파일을 찾았을 경우 200 응답
            res.writeHead(200, { 'Content-Type': contentType });
            // 💡 한글 깨짐 방지를 위해 'utf-8' 인코딩 명시
            res.end(content, 'utf-8'); 
        }
    });
});

// 서버를 Render가 지정한 PORT에서 실행합니다.
server.listen(PORT, () => {
    console.log(`✅ HTTP 서버가 포트 ${PORT} 에서 실행 중입니다.`);
});


// 2. WebSocket 서버 설정 (실시간 데이터 중계 역할)
const wss = new WebSocket.Server({ server });

// 연결된 모든 클라이언트(브라우저) 목록을 저장합니다.
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('🔗 새로운 클라이언트가 연결되었습니다.');

    // 클라이언트로부터 메시지(필기 좌표)를 수신했을 때
    ws.on('message', (message) => {
        const data = message.toString();
        
        // 연결된 모든 다른 클라이언트에게 필기 데이터를 브로드캐스트합니다.
        clients.forEach((client) => {
            // 자기 자신을 제외하고, 연결 상태가 열려있는 클라이언트에게만 전송
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });

    // 클라이언트 연결이 끊겼을 때 (브라우저 닫힘)
    ws.on('close', () => {
        clients.delete(ws);
        console.log('❌ 클라이언트 연결이 종료되었습니다.');
    });
});
