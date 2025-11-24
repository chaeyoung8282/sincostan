// script.js 파일 맨 위에 추가

// 1. WebSocket 서버에 연결을 시도합니다.
// 로컬에서 실행 시: ws://localhost:8080 
// 실제 서버에 올릴 경우: wss://yourdomain.com
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
    console.log('WebSocket 서버에 연결되었습니다.');
};

socket.onerror = (error) => {
    console.error('WebSocket 오류 발생:', error);
};

// 2. 다른 클라이언트(선생님 등)로부터 필기 데이터를 수신했을 때
socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'draw') {
            // 수신된 데이터를 이용해 캔버스에 선을 그립니다.
            // (다른 사람의 펜 색상, 굵기 등도 data에 포함되어야 정확합니다.)
            drawReceivedLine(data);
        } else if (data.type === 'clear') {
            // 전체 지우기 명령 수신
            clearCanvas();
        }
    } catch (e) {
        console.error("수신된 데이터 파싱 오류:", e);
    }
};

// 수신된 좌표를 캔버스에 그리는 함수 (별도 정의 필요)
function drawReceivedLine(data) {
    // 임시로 현재 펜 설정으로 그립니다.
    // (완벽한 구현을 위해서는 data에 펜 설정이 모두 포함되어야 합니다.)
    ctx.strokeStyle = data.color || '#000000';
    ctx.lineWidth = data.lineWidth || 4;

    ctx.beginPath();
    ctx.moveTo(data.lastX, data.lastY);
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.closePath();
}

// 캔버스 전체 지우기 함수 (server.js와 동기화)
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// =======================================================
// 1. 필요한 HTML 요소들을 JavaScript 변수로 가져옵니다.
// =======================================================

const subjectButtons = document.querySelectorAll('.subject-btn');
const difficultySelection = document.getElementById('difficulty-selection');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');
const mainScreen = document.getElementById('main-screen');
const quizScreen = document.getElementById('quiz-screen');
const backToMainButton = document.getElementById('back-to-main');
const problemImage = document.getElementById('problem-image');

// 드로잉 도구 관련 변수
const canvas = document.getElementById('writing-canvas');
const ctx = canvas.getContext('2d');
const toolButtons = document.querySelectorAll('.tool-btn');
const clearButton = document.getElementById('clear-btn');

// 상태 저장 변수
let selectedSubject = '';
let selectedDifficulty = '';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentMode = 'pen'; // 'pen' 또는 'eraser'
let currentColor = '#000000'; // 기본 검은색

// =======================================================
// 2. 캔버스 초기 설정 및 스타일 설정
// =======================================================

// 캔버스 내부 해상도 설정 (CSS와 비율이 일치해야 좌표 오차가 줄어듭니다)
canvas.width = 800; 
canvas.height = 400;

// 드로잉 기본 스타일
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.lineWidth = 4; // 기본 펜 굵기

// 캔버스 배경을 흰색으로 채워 지우개 기능이 작동하도록 초기화
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);


// =======================================================
// 3. 드로잉 및 좌표 계산 함수 (좌표 보정 포함)
// =======================================================

function startDrawing(e) {
    isDrawing = true;

    // 좌표 계산을 위해 캔버스 위치 정보 및 마우스/터치 위치를 가져옵니다.
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX || (e.touches && e.touches[0].clientX);
    let clientY = e.clientY || (e.touches && e.touches[0].clientY);

    // **핵심: 좌표 보정 로직**
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 보정된 캔버스 내의 x, y 좌표를 계산합니다.
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    [lastX, lastY] = [x, y];

    // 터치 시 스크롤 방지
    e.preventDefault(); 
}

function draw(e) {
    if (!isDrawing) return;

    // 모드에 따른 펜/지우개 스타일 설정
    if (currentMode === 'pen') {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 4;
    } else if (currentMode === 'eraser') {
        ctx.strokeStyle = '#ffffff'; // 배경색과 같은 색으로 덮어쓰기
        ctx.lineWidth = 20; // 지우개는 굵게
    }

    // 좌표 계산 (startDrawing과 동일한 보정 로직)
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX || (e.touches && e.touches[0].clientX);
    let clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // 기존 draw(e) 함수에서 마지막 줄 ([lastX, lastY] = [x, y];) 이전에 추가

    // ... (기존 draw 함수 코드) ...

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // 💡 핵심: 필기 데이터를 JSON 형태로 서버에 전송합니다.
        const drawData = {
            type: 'draw',
            lastX: lastX,
            lastY: lastY,
            x: x,
            y: y,
            color: ctx.strokeStyle, // 현재 펜 색상도 함께 전송
            lineWidth: ctx.lineWidth // 현재 펜 굵기도 함께 전송
        };
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(drawData));
        }

        [lastX, lastY] = [x, y];
    }

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath(); // 선 그리기 종료
}


// =======================================================
// 4. 화면 전환 및 도구 선택 이벤트 리스너
// =======================================================

// A. 주제 버튼 클릭 이벤트
subjectButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        selectedSubject = event.target.dataset.subject;
        difficultySelection.style.display = 'block';
    });
});

// B. 난이도 버튼 클릭 이벤트
difficultyButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        selectedDifficulty = event.target.dataset.difficulty;
        startQuiz(selectedSubject, selectedDifficulty);
    });
});

// C. 퀴즈 시작 및 화면 전환 함수
function startQuiz(subject, difficulty) {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';

    // 임시 문제 이미지 설정 (실제로는 서버에서 경로를 가져와야 함)
    problemImage.src = `placeholder-${subject}-${difficulty}.png`;

    // 퀴즈 화면 진입 시 초기 펜 색상 및 모드 설정
    toolButtons.forEach(btn => btn.classList.remove('selected'));
    document.getElementById('pen-black-btn').classList.add('selected'); // 검정 펜 기본 선택
    currentMode = 'pen';
    currentColor = '#000000';
}

// D. 메인 화면으로 돌아가기 버튼
backToMainButton.addEventListener('click', () => {
    quizScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    difficultySelection.style.display = 'none';
});

// E. 도구 선택 (펜 색상 및 지우개) 이벤트
toolButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        // 모든 버튼 'selected' 해제, 클릭된 버튼만 'selected' 적용
        toolButtons.forEach(btn => btn.classList.remove('selected'));
        event.target.classList.add('selected');

        const mode = event.target.dataset.mode;
        const color = event.target.dataset.color;

        currentMode = mode;

        if (mode === 'pen') {
            currentColor = color;
        }
    });
});

// 전체 지우기 (캔버스 초기화) 기능
clearButton.addEventListener('click', () => {
    // 캔버스 초기화 (로컬 화면)
    clearCanvas();

    // 💡 핵심: 전체 지우기 명령을 서버에 전송합니다.
    const clearData = { type: 'clear' };
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(clearData));
    }
});


// =======================================================
// 5. 드로잉 이벤트 리스너 연결
// =======================================================

// 마우스 이벤트
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// 터치 이벤트 (태블릿 PC 지원)
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);