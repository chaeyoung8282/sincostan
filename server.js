// server.js 파일

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// 💡 1. problems.json 파일에서 문제 데이터를 읽어옵니다.
const problemsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'problems.json'), 'utf8'));
// 💡 2. 출제된 문제를 기록할 변수 (서버 재시작 시 초기화됩니다.)
const solvedProblems = {}; 

// 2. WebSocket 서버 설정 (실시간 데이터 중계 역할)
const wss = new WebSocket.Server({ noServer: true }); // HTTP 서버와 분리
const clients = new Set(); // 접속된 모든 클라이언트 (교사, 학생) 저장

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] 새로운 클라이언트 접속. 현재 ${clients.size}명.`);

    ws.on('message', (message) => {
        // 클라이언트에서 메시지를 받는 로직이 있다면 여기에 구현
        const data = message.toString();
        console.log(`[WS] 클라이언트로부터 메시지 수신: ${data}`);
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[WS] 클라이언트 연결 해제. 현재 ${clients.size}명.`);
    });
    
    ws.on('error', (err) => {
        console.error(`[WS] 오류 발생: ${err.message}`);
    });
});


// 1. HTTP 서버 설정 (파일 제공 및 API 처리 역할)
const server = http.createServer((req, res) => {
    
    // 💡 퀴즈 요청 처리 API 경로 (/api/quiz/주제/난이도)
    if (req.url.startsWith('/api/quiz/')) {
        const parts = req.url.split('/'); 
        const subject = parts[3]; 
        const difficulty = parts[4];
        
        // 문제 데이터가 존재하는지 확인
        if (problemsData[subject] && problemsData[subject][difficulty]) {
            const problemList = problemsData[subject][difficulty];
            const key = `${subject}-${difficulty}`;
            
            // 이미 출제된 문제 목록을 가져옵니다.
            const publishedIds = solvedProblems[key] || [];

            // 출제되지 않은 문제만 필터링합니다.
            let availableProblems = problemList.filter(p => !publishedIds.includes(p.id));

            let nextProblem;

            if (availableProblems.length === 0 && problemList.length > 0) {
                // 모든 문제 출제 완료 시 초기화 (문제 재활용)
                availableProblems = [...problemList];
                solvedProblems[key] = [];
                console.log(`[문제 시스템] ${key} 문제 초기화됨. 전체 ${availableProblems.length}개 재활용.`);
            }

            // 문제 선택 (랜덤)
            if (availableProblems.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableProblems.length);
                nextProblem = availableProblems[randomIndex];
            } else {
                // 문제 목록이 비어 있으면 문제가 없음을 알림
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `문제 데이터 없음: ${subject}/${difficulty}` }));
                return;
            }

            // 선택된 문제를 출제 목록에 추가
            if (!solvedProblems[key]) {
                solvedProblems[key] = [];
            }
            solvedProblems[key].push(nextProblem.id);

            // 🚨 핵심: WebSocket을 통해 모든 클라이언트에게 문제 정보를 브로드캐스팅
            const broadcastMessage = JSON.stringify({
                type: 'new_quiz_problem',
                problem: nextProblem,
                subject: subject,
                difficulty: difficulty
            });

            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(broadcastMessage);
                }
            });
            
            // 요청한 클라이언트(교사)에게 응답 전송
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(nextProblem));
            return; // API 처리 완료
        } else {
            // 주제/난이도 데이터 없음
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `주제 또는 난이도 데이터가 problems.json에 존재하지 않음: ${subject}/${difficulty}` }));
            return;
        }
    }
    
    // 3. 기존의 파일 제공 로직 (HTML, CSS, JS, 이미지 파일)
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
        '.jpg': 'image/jpeg',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

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

// HTTP 서버 업그레이드 이벤트를 통해 WebSocket 연결 처리
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/') { // 루트 경로로 WebSocket 연결 시도 가정
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

server.listen(PORT, () => {
    console.log(`✅ HTTP/WS 서버가 포트 ${PORT} 에서 실행 중입니다.`);
});
