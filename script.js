// =======================================================
// 1. WebSocket 및 환경 설정
// =======================================================

// 실제 서버에 올릴 경우 Render URL로 변경하세요. (예: wss://your-render-app.onrender.com)
// 현재는 로컬 테스트용입니다.
const RENDER_URL = window.location.host;
const socket = new WebSocket(`wss://${RENDER_URL}`); 

socket.onopen = () => {
    console.log('🔗 WebSocket 서버에 연결되었습니다.');
};

socket.onerror = (error) => {
    console.error('❌ WebSocket 오류 발생:', error);
};


// =======================================================
// 2. HTML 요소 및 캔버스 설정
// =======================================================

const subjectButtons = document.querySelectorAll('.subject-btn');
const difficultySelection = document.getElementById('difficulty-selection');
const mainScreen = document.getElementById('main-screen');
const quizScreen = document.getElementById('quiz-screen');
const problemImage = document.getElementById('problem-image');

// 💡 P1/P2 캔버스 및 컨텍스트
const canvasP1 = document.getElementById('canvas-p1');
const ctxP1 = canvasP1.getContext('2d');
const canvasP2 = document.getElementById('canvas-p2');
const ctxP2 = canvasP2.getContext('2d');

const toolButtons = document.querySelectorAll('.tool-btn');
const clearButtons = document.querySelectorAll('.clear-btn'); 

// 💡 상태 변수: P1과 P2 각각의 상태를 저장
let playerState = {
    'p1': {
        isDrawing: false, lastX: 0, lastY: 0,
        mode: 'pen', color: '#000000', 
        canvas: canvasP1, ctx: ctxP1
    },
    'p2': {
        isDrawing: false, lastX: 0, lastY: 0,
        mode: 'pen', color: '#000000', 
        canvas: canvasP2, ctx: ctxP2
    }
};

// 캔버스 해상도 설정 (CSS 크기에 맞춰 내부 해상도 설정)
const CANVAS_WIDTH = 900; 
const CANVAS_HEIGHT = 450;
canvasP1.width = CANVAS_WIDTH; canvasP1.height = CANVAS_HEIGHT;
canvasP2.width = CANVAS_WIDTH; canvasP2.height = CANVAS_HEIGHT;

// 드로잉 기본 스타일 초기화
[ctxP1, ctxP2].forEach(ctx => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // 배경 흰색으로 초기화
});

// =======================================================
// 3. 드로잉 및 좌표 계산 함수 (P1/P2 통합)
// =======================================================

// 캔버스 내 좌표 계산 (특정 캔버스에 맞춤)
function getCanvasCoordinates(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return [x, y];
}

function startDrawing(e) {
    // 💡 클릭/터치된 캔버스가 P1인지 P2인지 ID로 확인
    const player = e.target.id === 'canvas-p1' ? 'p1' : 'p2';
    const state = playerState[player];
    
    state.isDrawing = true;
    
    let clientX = e.clientX || (e.touches && e.touches[0].clientX);
    let clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    [state.lastX, state.lastY] = getCanvasCoordinates(state.canvas, clientX, clientY);
    
    e.preventDefault(); 
}

function draw(e) {
    // 💡 마우스가 이동 중인 캔버스 상태를 찾습니다.
    const player = e.target.id === 'canvas-p1' ? 'p1' : 'p2';
    const state = playerState[player];
    
    if (!state.isDrawing) return;

    // 모드에 따른 펜/지우개 스타일 설정
    const penColor = state.mode === 'pen' ? state.color : '#ffffff';
    const penWidth = state.mode === 'pen' ? 4 : 20;
    
    state.ctx.strokeStyle = penColor;
    state.ctx.lineWidth = penWidth;

    let clientX = e.clientX || (e.touches && e.touches[0].clientX);
    let clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const [x, y] = getCanvasCoordinates(state.canvas, clientX, clientY);
    
    state.ctx.beginPath();
    state.ctx.moveTo(state.lastX, state.lastY);
    state.ctx.lineTo(x, y);
    state.ctx.stroke();

    // 💡 핵심: 필기 데이터를 서버에 전송 (player ID 포함)
    const drawData = {
        type: 'draw',
        player: player, 
        lastX: state.lastX, lastY: state.lastY,
        x: x, y: y,
        color: penColor,
        lineWidth: penWidth
    };
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(drawData));
    }

    [state.lastX, state.lastY] = [x, y];
}

function stopDrawing(e) {
    // 마우스 이벤트가 끝난 캔버스만 isDrawing을 false로 설정
    const player = e.target.id === 'canvas-p1' ? 'p1' : 'p2';
    playerState[player].isDrawing = false;
    playerState[player].ctx.beginPath();
}


// 캔버스 전체 지우기 함수 (P1/P2 선택적 지우기)
function clearCanvas(player) {
    // 'p1' 또는 'p2'에 해당하는 context와 canvas를 선택
    const ctx = player === 'p1' ? ctxP1 : ctxP2;
    const canvas = player === 'p1' ? canvasP1 : canvasP2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}


// =======================================================
// 4. WebSocket 데이터 수신 및 처리
// =======================================================

// 💡 다른 클라이언트로부터 받은 선을 그리는 함수
function drawReceivedLine(data) {
    // 수신된 data.player에 따라 캔버스를 선택
    const ctx = data.player === 'p1' ? ctxP1 : ctxP2; 
    
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.lineWidth;

    ctx.beginPath();
    ctx.moveTo(data.lastX, data.lastY);
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.closePath();
}

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'draw') {
            drawReceivedLine(data);
        } else if (data.type === 'clear') {
            // 💡 clear 명령 수신 시, 해당 캔버스(data.player)만 지우기
            clearCanvas(data.player); 
        }
    } catch (e) {
        console.error("수신된 데이터 파싱 오류:", e);
    }
};


// =======================================================
// 5. 화면 전환 및 도구 선택 이벤트 리스너
// =======================================================

// A. 주제 및 난이도 선택 (API 호출)
let selectedSubject = '';
let selectedDifficulty = '';

document.querySelectorAll('.subject-btn').forEach(button => {
    button.addEventListener('click', (event) => {
        selectedSubject = event.target.dataset.subject;
        document.getElementById('difficulty-selection').style.display = 'block';
    });
});

document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', (event) => {
        selectedDifficulty = event.target.dataset.difficulty;
        startQuiz(selectedSubject, selectedDifficulty);
    });
});


function startQuiz(subject, difficulty) {
    fetch(`/api/quiz/${subject}/${difficulty}`)
        .then(response => response.json())
        .then(problemData => {
            if (problemData.error) {
                alert(problemData.error);
                return;
            }
            
            // 화면 전환
            document.getElementById('main-screen').style.display = 'none';
            document.getElementById('quiz-screen').style.display = 'block';
            
            // 문제 이미지 URL 설정
            problemImage.src = problemData.url; 
            
            // 캔버스 초기화
            clearCanvas('p1');
            clearCanvas('p2');
            
            // P1 캔버스 도구만 초기 검은색 펜으로 설정
            document.querySelector('.drawing-tools [data-player="p1"]').click();
        })
        .catch(error => {
            console.error('문제 로드 중 오류 발생:', error);
            alert('문제 로드에 실패했습니다. 서버 상태를 확인해주세요.');
        });
}

// B. 메인 화면으로 돌아가기 버튼
document.getElementById('back-to-main').addEventListener('click', () => {
    quizScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    difficultySelection.style.display = 'none';
});

// C. 도구 선택 (펜 색상 및 지우개) 이벤트
toolButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const player = event.target.dataset.player; // P1 또는 P2
        const state = playerState[player];
        
        // 해당 플레이어의 도구 버튼만 선택 해제
        document.querySelectorAll(`.drawing-tools [data-player="${player}"]`).forEach(btn => btn.classList.remove('selected'));
        event.target.classList.add('selected');

        const mode = event.target.dataset.mode;
        const color = event.target.dataset.color;

        state.mode = mode;
        if (mode === 'pen') {
            state.color = color;
        }
    });
});

// D. 전체 지우기 기능 (명령 송신 포함)
clearButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const player = event.target.dataset.player;
        
        // 로컬 화면 지우기
        clearCanvas(player);

        // 💡 전체 지우기 명령을 서버에 전송 (어느 캔버스인지 정보 포함)
        const clearData = { type: 'clear', player: player };
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(clearData));
        }
    });
});


// E. 드로잉 이벤트 리스너 연결 (P1, P2 캔버스 모두에 연결)
[canvasP1, canvasP2].forEach(canvas => {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
});
