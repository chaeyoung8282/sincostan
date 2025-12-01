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
        ctx: ctxP1, canvas: canvasP1, player: 'p1' // player 속성 추가
    },
    p2: {
        isDrawing: false, lastX: 0, lastY: 0, color: '#000000', mode: 'pen',
        ctx: ctxP2, canvas: canvasP2, player: 'p2' // player 속성 추가
    }
};

let currentSubject = '';
let currentDifficulty = '';
let ws = null; // WebSocket 객체

// 💡 [NEW] 전역 상태 변수
let isTeacher = false; // 역할 분리용
let myPlayerId = 'p1'; // P1, P2 또는 teacher
let playerHP = { // 플레이어 HP 상태 (최대 HP 5로 가정)
    p1: 5.0,
    p2: 5.0
};


// ... (기존 문제 데이터, SUBJECT_NAMES, FILE_PATH_MAP, resolveImagePath 함수는 변경 없이 유지)

// 캔버스 초기화 및 스타일 설정 함수
function setupCanvasContext(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    // 배경을 흰색으로 초기화
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

setupCanvasContext(ctxP1);
setupCanvasContext(ctxP2);


// =========================================================
// 0. [NEW] 역할/플레이어 식별 로직 및 HP 관리
// =========================================================

/**
 * URL 파라미터를 파싱하여 역할과 플레이어 ID를 설정합니다.
 */
function getRoleAndPlayerId() {
    const params = new URLSearchParams(window.location.search);
    
    // 1. 교사 역할 설정 (?role=teacher)
    if (params.get('role') === 'teacher') {
        isTeacher = true;
        myPlayerId = 'teacher'; 
    // 2. 학생 역할 설정 (?player=p1 또는 ?player=p2)
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
        // 🚨 파라미터가 없는 경우 -> P1 학생으로 간주
        isTeacher = false;
        myPlayerId = 'p1';
    }
}

/**
 * HP 상태에 따라 하트 아이콘을 업데이트합니다.
 */
function updateHeartDisplay(playerId, hp) {
    const heartDisplay = document.getElementById(`hearts-${playerId}`);
    let html = '';
    
    // HP 업데이트 및 0과 5 사이로 제한
    playerHP[playerId] = Math.max(0, Math.min(5.0, hp)); 

    let tempHp = playerHP[playerId];
    
    // 하트 아이콘 생성
    for (let i = 0; i < 5; i++) { // 최대 5개 하트
        if (tempHp >= 1.0) {
            html += '<span class="heart-icon">❤️</span>'; // 꽉 찬 하트
            tempHp -= 1.0;
        } else if (tempHp >= 0.5) {
            html += '<span class="heart-icon">💔</span>'; // 반 하트 (깨진 하트로 표시)
            tempHp = 0;
        } else {
            html += '<span class="heart-icon">🤍</span>'; // 빈 하트
        }
    }
    
    heartDisplay.innerHTML = html;
}

// =========================================================
// 1. 드로잉 및 캔버스 관련 로직 (WS 전송 추가)
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

    // 학생 모드일 경우, 자신의 캔버스에만 리스너를 추가합니다.
    if (!isTeacher && playerId !== myPlayerId) {
        canvas.style.pointerEvents = 'none'; // 클릭 불가 처리
        return; 
    }

    // 캔버스의 실제 표시 크기(CSS 크기)와 내부 해상도의 비율을 계산하여 좌표 보정
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

        // 로컬 드로잉
        performDrawing(playerId, state.lastX, state.lastY, x, y, state.color, state.mode);

        // 서버로 드로잉 데이터 전송
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
        scoreButtonsP1.style.display = 'none'; // 초기에는 숨김
        scoreButtonsP2.style.display = 'none'; // 초기에는 숨김
        solvingContainer.style.flexDirection = 'row'; 
        player1Area.querySelector('.writing-canvas').style.height = '400px'; 
        player2Area.querySelector('.writing-canvas').style.height = '400px'; 
        
    } else {
        // 학생 모드
        if (myPlayerId === 'p1') {
            // P1 학생: P1만 크게 표시
            player1Area.style.display = 'block';
            player2Area.style.display = 'none';
            player1Area.style.minWidth = '100%'; 
            player1Area.querySelector('.writing-canvas').style.height = '600px'; // 캔버스 높이 키우기
            player1Area.querySelector('h3').textContent = '나의 풀이';
        } else {
            // P2 학생: P2만 크게 표시
            player1Area.style.display = 'none';
            player2Area.style.display = 'block';
            player2Area.style.minWidth = '100%';
            player2Area.querySelector('.writing-canvas').style.height = '600px'; 
            player2Area.querySelector('h3').textContent = '나의 풀이';
        }
        // 학생은 채점 버튼 및 다른 학생 영역은 보이지 않음
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
    scoreEffectOverlay.style.display = 'none'; // 효과 제거

    // 💡 [NEW] 교사일 경우에만 WS 메시지를 보내 다른 클라이언트를 동기화
    if (isTeacher) {
        sendWebSocketData({ type: 'back_to_main' });
    }
    
    // 선택 상태 초기화
    document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
    currentSubject = '';
    currentDifficulty = '';
    
    // 이미지 에러 핸들러 초기화
    problemImage.onerror = null; 
}


// =========================================================
// 3. [NEW] 채점 및 효과 로직
// =========================================================

/**
 * 채점 버튼 이벤트 설정 (교사 전용)
 */
function setupScoringEvents() {
    document.querySelectorAll('.grade-btn').forEach(button => {
        // 학생은 채점 버튼을 클릭할 수 없음
        if (!isTeacher) { return; }
        
        button.addEventListener('click', (e) => {
            const playerId = e.target.getAttribute('data-player');
            const result = e.target.getAttribute('data-result'); // 'correct' or 'incorrect'
            
            let newHp = playerHP[playerId];
            if (result === 'correct') {
                newHp += 1.0; // +1 하트
            } else if (result === 'incorrect') {
                newHp -= 0.5; // -0.5 하트
            }
            
            // HP 업데이트 (로컬 및 제한)
            updateHeartDisplay(playerId, newHp);
            
            // WS 동기화
            sendWebSocketData({
                type: 'score_update',
                playerId: playerId,
                result: result,
                newHp: playerHP[playerId] // updateHeartDisplay에서 제한된 최종 HP 값 전송
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
    const playerNum = playerId.slice(-1); // P1 -> 1, P2 -> 2
    let message = '';
    let bgColor = '';
    
    if (result === 'correct') {
        message = `P${playerNum} 정답! (❤️ +1)`;
        bgColor = 'rgba(40, 167, 69, 0.9)'; // 초록색
    } else {
        message = `P${playerNum} 오답.. (💔 -0.5)`;
        bgColor = 'rgba(220, 53, 69, 0.9)'; // 빨간색
    }
    
    scoreEffectMessage.textContent = message;
    scoreEffectMessage.style.backgroundColor = bgColor;
    scoreEffectOverlay.style.display = 'flex';
    
    setTimeout(() => {
        scoreEffectOverlay.style.display = 'none';
    }, 2000);
}


/**
 * 퀴즈 화면을 표시하고 문제를 로드합니다.
 */
async function showQuizScreen() {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    
    // ... (기존 문제 로드 로직 유지)
    
    const subjectName = SUBJECT_NAMES[currentSubject] || '주제';
    const difficultyName = problemData[currentSubject]?.difficulty_map[currentDifficulty] || '난이도';
    const loadingMessage = `${subjectName} / ${difficultyName} 문제를 서버에 요청 중...`;
    
    currentSubjectDifficulty.textContent = loadingMessage;
    problemImage.src = `https://placehold.co/800x250/3498db/ffffff?text=${encodeURIComponent(loadingMessage)}`;
    
    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    const subjectData = problemData[currentSubject];
    const problemKey = `${currentSubject}-${currentDifficulty}`;
    
    const fullProblemArray = subjectData ? subjectData[currentDifficulty] : null;

    if (!subjectData || !fullProblemArray || fullProblemArray.length === 0) {
        currentSubjectDifficulty.textContent = "오류: 해당 주제/난이도의 문제 배열을 찾을 수 없습니다.";
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=JSON+데이터+누락!`;
        return;
    }

    // 1. [문제 중복 방지 로직] 사용 가능한 문제 목록 초기화 및 관리
    if (!availableProblems[problemKey] || availableProblems[problemKey].length === 0) {
        availableProblems[problemKey] = [...fullProblemArray];
        if (fullProblemArray.length > 0) {
            console.log(`[문제 시스템] ${subjectName} / ${difficultyName} 문제 목록이 초기화되었습니다. (${fullProblemArray.length}개)`);
        }
    }

    const currentProblemArray = availableProblems[problemKey];
    const randomIndex = Math.floor(Math.random() * currentProblemArray.length);
    const selectedProblem = currentProblemArray[randomIndex];
    currentProblemArray.splice(randomIndex, 1);
    
    const logicalPath = selectedProblem.url;
    let actualImagePath;
    
    // ... (이미지 로딩 로직 유지)

    currentSubjectDifficulty.textContent = `${subjectName} / ${difficultyName} (ID: ${selectedProblem.id}) (남은 문제: ${currentProblemArray.length}개)`;
    
    // 이미지 로딩 에러 핸들러 설정
    problemImage.onerror = () => {
        console.error(`이미지 로드 실패 (404): ${actualImagePath}. 폴백 텍스트로 대체합니다.`); 
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!+실제파일명:+${actualImagePath}`;
    };
    
    problemImage.src = actualImagePath;
    
    // 💡 [NEW] HP 상태 표시 및 레이아웃 설정
    updateHeartDisplay('p1', playerHP.p1);
    updateHeartDisplay('p2', playerHP.p2);
    setupQuizView(); // 역할에 따라 레이아웃 및 버튼 표시/숨김 설정
}

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
                    showMainScreen(); 
                }
                break;
            case 'score_update': // 💡 [NEW] 점수 업데이트 동기화
                // 교사 포함 모든 클라이언트의 HP를 업데이트하고 효과를 표시합니다.
                updateHeartDisplay(data.playerId, data.newHp);
                showScoreEffect(data.result, data.playerId);
                
                // 교사일 경우, 채점 버튼 다시 표시
                if (isTeacher) {
                    scoreButtonsP1.style.display = 'block';
                    scoreButtonsP2.style.display = 'block';
                }
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
    
    // 4. 메인 UI 버튼 리스너 설정
    setupMainUiEvents();
    
    // 5. [NEW] 채점 버튼 리스너 설정 (교사 전용)
    setupScoringEvents(); 
    
    // 6. 초기 HP 표시 (최대 5개 하트)
    updateHeartDisplay('p1', playerHP.p1);
    updateHeartDisplay('p2', playerHP.p2);
    
    // 7. 초기 레이아웃 설정
    setupQuizView();
    
    console.log(`[Init] 역할: ${isTeacher ? '교사' : '학생'}, ID: ${myPlayerId}`);
};
