// 캔버스 요소를 가져옵니다.
const canvasP1 = document.getElementById('canvas-p1');
const ctxP1 = canvasP1.getContext('2d');
const canvasP2 = document.getElementById('canvas-p2');
const ctxP2 = canvasP2.getContext('2d');

// 메인 화면과 퀴즈 화면 요소를 가져옵니다.
const mainScreen = document.getElementById('main-screen');
const quizScreen = document.getElementById('quiz-screen');
const currentSubjectDifficulty = document.getElementById('current-subject-difficulty');
const problemImage = document.getElementById('problem-image');
const backToMainBtn = document.getElementById('back-to-main');
const difficultySelection = document.getElementById('difficulty-selection');
const solvingContainer = document.getElementById('solving-container'); // 레이아웃 변경용

// 💡 [NEW] 채점 및 효과 관련 요소
const scoreButtonsP1 = document.getElementById('score-buttons-p1');
const scoreButtonsP2 = document.getElementById('score-buttons-p2');
const scoreEffectOverlay = document.getElementById('score-effect-overlay');
const scoreEffectMessage = document.getElementById('score-effect-message');


// 캔버스 해상도 설정
const CANVAS_WIDTH = 550; 
const CANVAS_HEIGHT = 400; 

canvasP1.width = CANVAS_WIDTH; canvasP1.height = CANVAS_HEIGHT;
canvasP2.width = CANVAS_WIDTH; canvasP2.height = CANVAS_HEIGHT;

// 드로잉 상태를 저장할 객체
const drawingState = {
    p1: {
        isDrawing: false, lastX: 0, lastY: 0, color: '#000000', mode: 'pen',
        ctx: ctxP1, canvas: canvasP1, player: 'p1'
    },
    p2: {
        isDrawing: false, lastX: 0, lastY: 0, color: '#000000', mode: 'pen',
        ctx: ctxP2, canvas: canvasP2, player: 'p2'
    }
};

// 💡 [NEW] 캐릭터/HP 관련 상수 설정
const CHARACTER_CONFIG = {
    P1: {
        name: "WITCH (마녀)",
        imageFile: "witch.png", 
        initialHP: 5.0
    },
    P2: {
        name: "SOLDIER (군인)",
        imageFile: "soldier.png",
        initialHP: 5.0
    }
};

const IMAGE_ROOT_PATH = "images/characters/";
const HEART_FILES = {
    FULL: "full_heart.png",
    HALF: "half_heart.png",
    EMPTY: "empty_heart.png" // 빈 하트 이미지도 추가했습니다.
};

let currentSubject = '';
let currentDifficulty = '';
let ws = null;

// HP 초기화: CONFIG에서 가져옴
let playerHP = { 
    p1: CHARACTER_CONFIG.P1.initialHP,
    p2: CHARACTER_CONFIG.P2.initialHP
};

let isTeacher = false; 
let myPlayerId = 'p1'; 

// =========================================================
// 0. 역할/플레이어 식별 로직 및 HP 관리
// =========================================================

/**
 * URL 파라미터를 파싱하여 역할과 플레이어 ID를 설정합니다.
 */
function getRoleAndPlayerId() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('role') === 'teacher') {
        isTeacher = true;
        myPlayerId = 'teacher'; 
    } else if (params.get('player')) {
        const player = params.get('player').toLowerCase();
        if (player === 'p1' || player === 'p2') {
            isTeacher = false;
            myPlayerId = player;
        } else {
            isTeacher = false; 
            myPlayerId = 'p1';
        }
    } else {
        isTeacher = false;
        myPlayerId = 'p1';
    }
}

/**
 * HP 상태에 따라 하트 이미지 아이콘을 업데이트합니다.
 */
function updateHeartDisplay(playerId, hp) {
    const heartDisplay = document.getElementById(`hearts-${playerId}`);
    let html = '';
    
    // HP 업데이트 및 0과 5 사이로 제한 (0.5 단위로 딱 떨어지게 함)
    playerHP[playerId] = Math.max(0, Math.min(5.0, hp)); 
    let currentHp = playerHP[playerId];
    
    // 하트 아이콘 생성 (최대 5개 하트)
    for (let i = 0; i < 5; i++) { 
        let heartSrc = HEART_FILES.EMPTY; // 기본은 빈 하트

        if (currentHp >= 1.0) {
            heartSrc = HEART_FILES.FULL; // 꽉 찬 하트
            currentHp -= 1.0;
        } else if (currentHp >= 0.5) {
            heartSrc = HEART_FILES.HALF; // 반 하트
            currentHp = 0; // 나머지 HP는 0으로 처리
        }
        
        // <img> 태그를 사용하여 하트 이미지 표시
        html += `<img src="${IMAGE_ROOT_PATH}${heartSrc}" alt="Heart" class="heart-icon">`;
    }
    
    heartDisplay.innerHTML = html;
}

/**
 * 캐릭터 이미지와 이름을 UI에 설정합니다.
 */
function setupCharacterUI() {
    // 플레이어 1 설정
    document.querySelector('#status-p1 h3').textContent = CHARACTER_CONFIG.P1.name;
    document.getElementById('char-p1').style.backgroundImage = `url(${IMAGE_ROOT_PATH}${CHARACTER_CONFIG.P1.imageFile})`;

    // 플레이어 2 설정
    document.querySelector('#status-p2 h3').textContent = CHARACTER_CONFIG.P2.name;
    document.getElementById('char-p2').style.backgroundImage = `url(${IMAGE_ROOT_PATH}${CHARACTER_CONFIG.P2.imageFile})`;
}


// =========================================================
// 1. 드로잉 및 캔버스 관련 로직 (기존 로직 유지)
// =========================================================

/**
 * 실제로 캔버스에 드로잉을 수행하는 함수 (로컬 및 원격 드로잉 모두 사용)
 */
function performDrawing(playerId, fromX, fromY, toX, toY, color, mode) {
    const state = drawingState[playerId];
    const ctx = state.ctx;

    ctx.beginPath();
    
    if (mode === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    } else if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20; 
    } else {
         ctx.globalCompositeOperation = 'source-over'; 
    }
    
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    ctx.globalCompositeOperation = 'source-over'; // 기본값으로 복원
}


/**
 * 캔버스 이벤트 리스너 설정 (역할 분리 및 WS 전송 로직 포함)
 */
function setupCanvasListeners(playerId) {
    const state = drawingState[playerId];
    const canvas = state.canvas;

    if (!isTeacher && playerId !== myPlayerId) {
        canvas.style.pointerEvents = 'none'; 
        return; 
    }

    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    const draw = (e) => {
        if (!state.isDrawing) return;
        
        e.preventDefault(); 
        const { x, y } = getCoordinates(e);

        performDrawing(playerId, state.lastX, state.lastY, x, y, state.color, state.mode);

        sendWebSocketData({
            type: 'draw',
            playerId: playerId,
            from: { x: state.lastX, y: state.lastY },
            to: { x: x, y: y },
            color: state.color,
            mode: state.mode,
        });

        state.lastX = x;
        state.lastY = y;
    };
    
    const startDrawing = (e) => {
        state.isDrawing = true;
        const { x, y } = getCoordinates(e);
        state.lastX = x;
        state.lastY = y;
    };

    const stopDrawing = () => {
        state.isDrawing = false;
    };

    // 마우스 이벤트
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 터치 이벤트
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    
    // 툴 버튼 리스너 (기존 로직 유지 및 WS 클리어 동기화 추가)
    document.querySelectorAll(`#tools-${playerId} .tool-btn`).forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll(`#tools-${playerId} .tool-btn`).forEach(btn => btn.classList.remove('selected'));
            
            const mode = button.dataset.mode || 'pen';
            state.mode = mode;
            
            if (mode === 'pen') {
                state.color = button.dataset.color || '#000000';
            }
            
            if (button.classList.contains('clear-btn')) {
                // 전체 지우기
                state.ctx.globalCompositeOperation = 'source-over';
                state.ctx.fillStyle = '#ffffff';
                state.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                // WS 동기화
                sendWebSocketData({ type: 'clear', playerId: playerId });
            } else {
                button.classList.add('selected');
            }
        });
    });
}


// =========================================================
// 2. UI/레이아웃 및 동기화 로직
// =========================================================

/**
 * 교사/학생 역할에 따라 퀴즈 화면 레이아웃을 설정합니다.
 */
function setupQuizView() {
    const player1Area = document.querySelector('.player-writing-area[data-player="p1"]');
    const player2Area = document.querySelector('.player-writing-area[data-player="p2"]');
    
    if (isTeacher) {
        // 교사 모드: P1, P2 모두 표시하고 채점 버튼 숨기기 (정답 확인 후 표시)
        player1Area.style.display = 'block';
        player2Area.style.display = 'block';
        document.getElementById('tools-p1').style.display = 'flex';
        document.getElementById('tools-p2').style.display = 'flex';
        scoreButtonsP1.style.display = 'block'; // 교사 화면에 채점 버튼 항상 표시
        scoreButtonsP2.style.display = 'block'; // 교사 화면에 채점 버튼 항상 표시
        solvingContainer.style.flexDirection = 'row'; 
        player1Area.querySelector('.writing-canvas').style.height = '400px'; 
        player2Area.querySelector('.writing-canvas').style.height = '400px'; 
        
    } else {
        // 학생 모드: 자신의 영역만 크게 표시
        if (myPlayerId === 'p1') {
            player1Area.style.display = 'block';
            player2Area.style.display = 'none';
            player1Area.style.minWidth = '100%'; 
            player1Area.querySelector('.writing-canvas').style.height = '600px'; 
            player1Area.querySelector('h3').textContent = `${CHARACTER_CONFIG.P1.name}님의 풀이`; // 이름 사용
        } else {
            player1Area.style.display = 'none';
            player2Area.style.display = 'block';
            player2Area.style.minWidth = '100%';
            player2Area.querySelector('.writing-canvas').style.height = '600px'; 
            player2Area.querySelector('h3').textContent = `${CHARACTER_CONFIG.P2.name}님의 풀이`; // 이름 사용
        }
        scoreButtonsP1.style.display = 'none'; 
        scoreButtonsP2.style.display = 'none';
        solvingContainer.style.flexDirection = 'column';
    }
}

/**
 * 메인 화면으로 돌아가기 (교사는 동기화 메시지 전송)
 */
function showMainScreen() {
    mainScreen.style.display = 'block';
    quizScreen.style.display = 'none';
    difficultySelection.style.display = 'none';
    scoreEffectOverlay.style.display = 'none';

    // 💡 [NEW] 교사일 경우에만 WS 메시지를 보내 다른 클라이언트를 동기화
    if (isTeacher) {
        sendWebSocketData({ type: 'back_to_main' });
    }
    
    document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
    currentSubject = '';
    currentDifficulty = '';
    
    problemImage.onerror = null; 
}


// =========================================================
// 3. 채점 및 효과 로직
// =========================================================

/**
 * 채점 버튼 이벤트 설정 (교사 전용)
 */
function setupScoringEvents() {
    document.querySelectorAll('.grade-btn').forEach(button => {
        if (!isTeacher) { return; }
        
        button.addEventListener('click', (e) => {
            const playerId = e.target.getAttribute('data-player');
            const result = e.target.getAttribute('data-result'); // 'correct' or 'incorrect'
            
            let newHp = playerHP[playerId];
            if (result === 'correct') {
                newHp += 1.0; // +1 하트 (FULL)
            } else if (result === 'incorrect') {
                newHp -= 0.5; // -0.5 하트 (HALF)
            }
            
            // HP 업데이트
            updateHeartDisplay(playerId, newHp);
            
            // WS 동기화
            sendWebSocketData({
                type: 'score_update',
                playerId: playerId,
                result: result,
                newHp: playerHP[playerId] 
            });
            
            // 교사 화면에서 바로 효과 표시
            showScoreEffect(result, playerId);
        });
    });
}

/**
 * 채점 결과에 따른 시각적 효과를 표시합니다.
 */
function showScoreEffect(result, playerId) {
    const playerConfig = playerId === 'p1' ? CHARACTER_CONFIG.P1 : CHARACTER_CONFIG.P2;
    const playerCharName = playerConfig.name;

    let message = '';
    let bgColor = '';
    
    if (result === 'correct') {
        message = `${playerCharName} 정답! (❤️ +1)`;
        bgColor = 'rgba(40, 167, 69, 0.9)'; // 초록색
    } else {
        message = `${playerCharName} 오답.. (💔 -0.5)`;
        bgColor = 'rgba(220, 53, 69, 0.9)'; // 빨간색
    }
    
    scoreEffectMessage.textContent = message;
    scoreEffectMessage.style.backgroundColor = bgColor;
    scoreEffectOverlay.style.display = 'flex';
    
    setTimeout(() => {
        scoreEffectOverlay.style.display = 'none';
    }, 2000);
}

// ... (loadNewQuiz 및 syncQuizScreen 함수는 문제 로드 API 처리 로직이므로 생략. 기존의 유효한 로직을 사용해야 합니다.)
// ... (showQuizScreen 함수는 문제 로드 로직이므로 생략. 기존의 유효한 로직을 사용해야 합니다.)
// (사용자님이 이전에 제공한 유효한 문제 로드 및 화면 표시 로직이 있다고 가정합니다.)


// =========================================================
// 4. WebSocket 동기화 로직
// =========================================================

function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => { console.log('✅ WebSocket 연결 성공'); };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'draw':
                performDrawing(data.playerId, data.from.x, data.from.y, data.to.x, data.to.y, data.color, data.mode);
                break;
            case 'clear':
                drawingState[data.playerId].ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                break;
            case 'back_to_main': // 💡 [NEW] 메인 화면 복귀 동기화
                if (!isTeacher) { 
                    showMainScreen(); // 학생은 메인 화면으로 돌아갑니다.
                }
                break;
            case 'score_update': // 💡 [NEW] 점수 업데이트 동기화
                // 모든 클라이언트의 HP를 업데이트하고 효과를 표시합니다.
                updateHeartDisplay(data.playerId, data.newHp);
                showScoreEffect(data.result, data.playerId);
                break;
            default:
                console.warn('알 수 없는 WebSocket 메시지 타입:', data.type);
        }
    };
    ws.onclose = () => { console.log('❌ WebSocket 연결 종료'); };
    ws.onerror = (error) => { console.error('WebSocket 오류 발생:', error); };
}

function sendWebSocketData(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    } else {
        console.warn('WebSocket이 연결되지 않아 데이터를 전송할 수 없습니다.', data);
    }
}


// =========================================================
// 5. 초기화
// =========================================================

window.onload = async () => {
    // 1. 역할 및 플레이어 ID를 먼저 설정합니다.
    getRoleAndPlayerId(); 
    
    // 2. WebSocket 연결 설정
    setupWebSocket();
    
    // 3. 캔버스 드로잉 리스너 설정
    setupCanvasListeners('p1');
    setupCanvasListeners('p2');
    
    // 4. 메인 UI 버튼 리스너 설정 (이 함수는 기존에 유효하게 구현되어 있다고 가정합니다)
    // setupMainUiEvents(); 
    
    // 5. 채점 버튼 리스너 설정 (교사 전용)
    setupScoringEvents(); 
    
    // 6. [NEW] 캐릭터 이름 및 이미지 설정
    setupCharacterUI();
    
    // 7. 초기 HP 표시 (5개 하트)
    updateHeartDisplay('p1', playerHP.p1);
    updateHeartDisplay('p2', playerHP.p2);
    
    // 8. 초기 레이아웃 설정
    setupQuizView();
    
    console.log(`[Init] 역할: ${isTeacher ? '교사' : '학생'}, ID: ${myPlayerId}`);
};
