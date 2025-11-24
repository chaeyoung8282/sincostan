// server.js 파일

// Node.js 기본 모듈
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Replit 환경 변수에서 포트 번호를 가져오거나 기본값 8080 사용
const PORT = process.env.PORT || 8080;

// 1. HTTP 서버 설정 (웹사이트 파일을 제공하는 역할)
const server = http.createServer((req, res) => {
    // 기본적으로 index.html을 찾도록 설정
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // 파일 읽기 및 전송
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found: ' + filePath);
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 서버를 Replit 포트에서 실행합니다.
server.listen(PORT, () => {
    console.log(`HTTP 서버가 포트 ${PORT} 에서 실행 중입니다.`);
    console.log('이제 여러 브라우저 탭에서 접속하여 실시간 공유를 테스트할 수 있습니다.');
});


// 2. WebSocket 서버 설정 (실시간 데이터 중계 역할)
const wss = new WebSocket.Server({ server });

// 연결된 클라이언트들을 저장할 Set
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('새로운 클라이언트가 연결되었습니다.');

    // 클라이언트로부터 필기 데이터를 수신했을 때
    ws.on('message', (message) => {
        const data = message.toString();

        // 연결된 모든 다른 클라이언트에게 필기 데이터를 브로드캐스트합니다.
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });

    // 클라이언트 연결이 끊겼을 때
    ws.on('close', () => {
        clients.delete(ws);
        console.log('클라이언트 연결이 종료되었습니다.');
    });
});