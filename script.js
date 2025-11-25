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

// 캔버스 해상도 설정 (기본 해상도로 변경)
const CANVAS_WIDTH = 550; 
const CANVAS_HEIGHT = 400; 

canvasP1.width = CANVAS_WIDTH; canvasP1.height = CANVAS_HEIGHT;
canvasP2.width = CANVAS_WIDTH; canvasP2.height = CANVAS_HEIGHT;

// Firestore 및 인증 관련 전역 변수 설정 (사용자 인증 및 데이터 저장을 위해 필요)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// 드로잉 상태를 저장할 객체
const drawingState = {
    p1: {
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        color: '#000000',
        mode: 'pen',
        ctx: ctxP1,
        canvas: canvasP1,
    },
    p2: {
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        color: '#000000',
        mode: 'pen',
        ctx: ctxP2,
        canvas: canvasP2,
    }
};

let currentSubject = '';
let currentDifficulty = '';
let userId = null;
let db = null;
let auth = null;

// Firebase 및 인증 설정 함수
async function initializeFirebase() {
    // Firebase SDK import
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
    const { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
    const { getFirestore, doc, setDoc, onSnapshot, collection, query, where, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
    const { setLogLevel } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    // setLogLevel('Debug'); // 디버그 로그 활성화

    // Firebase 설정이 비어 있는지 확인하는 로직 강화 및 에러 메시지 개선
    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0 || !firebaseConfig.projectId) {
        console.error("FATAL ERROR: Firebase config is missing. The environment variable __firebase_config was empty or invalid. Please refresh the page or try restarting the app.");
        return;
    }

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    if (initialAuthToken) {
        await signInWithCustomToken(auth, initialAuthToken).catch(error => {
            console.error("Error signing in with custom token:", error);
            signInAnonymously(auth); // Fallback to anonymous sign-in
        });
    } else {
        await signInAnonymously(auth);
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            console.log("User authenticated. UID:", userId);
        } else {
            // 사용자 ID가 없는 경우 임시 ID 사용 ( Firestore 보안 규칙에 따라 변경될 수 있음)
            userId = crypto.randomUUID(); 
            console.log("User signed out or anonymous. Using temporary ID:", userId);
        }
        // 인증 완료 후 데이터 리스너 설정
        setupDataListeners();
    });
}

// 캔버스 초기화 및 스타일 설정 함수
function setupCanvasContext(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = drawingState.p1.color; // 초기 색상은 검은색

    // 배경을 흰색으로 초기화
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// 캔버스 초기화
setupCanvasContext(ctxP1);
setupCanvasContext(ctxP2);

// 드로잉 함수
function draw(e, state, isLocal) {
    if (!state.isDrawing) return;

    // 터치 이벤트 처리
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    const rect = state.canvas.getBoundingClientRect();
    const scaleX = state.canvas.width / rect.width;
    const scaleY = state.canvas.height / rect.height;

    const currentX = (clientX - rect.left) * scaleX;
    const currentY = (clientY - rect.top) * scaleY;

    state.ctx.beginPath();
    
    // 지우개 모드
    if (state.mode === 'eraser') {
        state.ctx.globalCompositeOperation = 'destination-out';
        state.ctx.lineWidth = 20; // 지우개 크기
    } else {
        // 펜 모드
        state.ctx.globalCompositeOperation = 'source-over';
        state.ctx.lineWidth = 5;
        state.ctx.strokeStyle = state.color;
    }
    
    state.ctx.moveTo(state.lastX, state.lastY);
    state.ctx.lineTo(currentX, currentY);
    state.ctx.stroke();

    [state.lastX, state.lastY] = [currentX, currentY];

    // 로컬 드로잉인 경우에만 Firestore에 저장
    if (isLocal) {
        saveDrawingData(state.canvas.id, {
            x1: state.lastX,
            y1: state.lastY,
            x2: currentX,
            y2: currentY,
            color: state.color,
            mode: state.mode,
            lineWidth: state.mode === 'eraser' ? 20 : 5
        });
    }
}

// Firestore에 드로잉 데이터 저장 (실시간 동기화를 위해 단순화된 예시)
function saveDrawingData(canvasId, data) {
    // 실제 앱에서는 성능을 위해 드로잉 이벤트의 빈도를 조절해야 합니다.
    // 여기서는 간단히 마지막 그리기 데이터를 저장합니다.
    if (!db || !userId) return;

    const docRef = doc(db, "artifacts", appId, "public", "data", "quiz_sessions", "shared_drawing");
    
    // 데이터 구조: { p1: [path_data], p2: [path_data] }
    // 여기서는 동기화 데모를 위해 캔버스별 마지막 드로잉 좌표를 저장합니다.
    
    const canvasKey = canvasId === 'canvas-p1' ? 'p1_drawing' : 'p2_drawing';

    setDoc(docRef, { 
        [canvasKey]: JSON.stringify(data), // 드로잉 데이터를 문자열로 직렬화
        timestamp: Date.now() 
    }, { merge: true }).catch(e => console.error("Error saving drawing data: ", e));
}


// Firestore에서 드로잉 데이터 동기화
function setupDataListeners() {
    if (!db || !userId) {
        console.warn("Firestore not initialized or userId not set.");
        return;
    }

    const docRef = doc(db, "artifacts", appId, "public", "data", "quiz_sessions", "shared_drawing");

    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // P1 데이터 동기화
            if (data.p1_drawing) {
                const drawingData = JSON.parse(data.p1_drawing);
                drawRemote(drawingData, drawingState.p1);
            }

            // P2 데이터 동기화
            if (data.p2_drawing) {
                const drawingData = JSON.parse(data.p2_drawing);
                drawRemote(drawingData, drawingState.p2);
            }
        }
    }, (error) => {
        console.error("Error listening to drawing data:", error);
    });
}

// 원격 데이터를 캔버스에 그리는 함수
function drawRemote(data, state) {
    const ctx = state.ctx;
    ctx.beginPath();
    
    // 지우개 모드 처리
    if (data.mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.lineWidth = data.lineWidth;
    ctx.strokeStyle = data.color;
    
    ctx.moveTo(data.x1, data.y1);
    ctx.lineTo(data.x2, data.y2);
    ctx.stroke();
}


// 이벤트 리스너 설정
function setupCanvasEvents(canvas, player) {
    const state = drawingState[player];
    const ctx = state.ctx;
    
    // 마우스 및 터치 이벤트 핸들러
    const startDrawing = (e) => {
        e.preventDefault();
        state.isDrawing = true;
        
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        [state.lastX, state.lastY] = [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
    };

    const stopDrawing = () => {
        state.isDrawing = false;
        // Firestore에 최종 경로 저장 또는 상태 업데이트 (선택 사항)
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', (e) => draw(e, state, true));

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    canvas.addEventListener('touchmove', (e) => draw(e, state, true));

    // 툴 버튼 리스너
    document.querySelectorAll(`.tool-btn[data-player="${player}"]`).forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll(`.tool-btn[data-player="${player}"]`).forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');

            state.mode = button.dataset.mode || 'pen';
            if (button.dataset.color) {
                state.color = button.dataset.color;
            }

            if (button.classList.contains('clear-btn')) {
                // 전체 지우기
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
        });
    });
}

// P1, P2 캔버스에 이벤트 리스너 설정
setupCanvasEvents(canvasP1, 'p1');
setupCanvasEvents(canvasP2, 'p2');


// 메인 화면 UI 로직
document.querySelectorAll('.subject-btn').forEach(button => {
    button.addEventListener('click', () => {
        currentSubject = button.dataset.subject;
        // 주제 버튼을 누르면 난이도 선택 화면 표시
        document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');

        difficultySelection.style.display = 'block';
    });
});

document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => {
        currentDifficulty = button.dataset.difficulty;
        
        // 난이도 버튼을 누르면 퀴즈 화면 표시
        showQuizScreen();
    });
});

backToMainBtn.addEventListener('click', showMainScreen);

function showQuizScreen() {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    
    // 현재 문제/난이도 표시 업데이트
    let subjectText = '';
    let difficultyText = '';

    switch(currentSubject) {
        case 'polynomial': subjectText = '다항식'; break;
        case 'equation': subjectText = '방정식과 부등식'; break;
        case 'permutation': subjectText = '순열과 조합'; break;
        case 'matrix': subjectText = '행렬'; break;
        case 'geometry': subjectText = '도형의 방정식'; break;
        case 'set': subjectText = '집합과 명제'; break;
        case 'function': subjectText = '함수와 그래프'; break;
        default: subjectText = '미정';
    }

    switch(currentDifficulty) {
        case 'hard': difficultyText = '상 (BOSS)'; break;
        case 'medium': difficultyText = '중 (CHALLENGE)'; break;
        case 'easy': difficultyText = '하 (TRAINING)'; break;
        default: difficultyText = '미정';
    }

    currentSubjectDifficulty.textContent = `${subjectText} / ${difficultyText}`;
    
    // --- 문제 이미지 로딩 로직 ---
    const problemText = `${subjectText} ${difficultyText} 문제`;
    
    // 1. 플레이스홀더 이미지 URL 설정 (문제 이미지를 동적으로 생성)
    const placeholderUrl = `https://placehold.co/800x250/007bff/ffffff?text=${encodeURIComponent(problemText)}`;
    
    // 2. 이미지 로딩 에러 핸들러 설정
    problemImage.onerror = () => {
        console.error("Failed to load problem image from placehold.co. Falling back to simple text.");
        // 에러 발생 시 단순한 fallback 이미지로 변경 (빨간색 배경)
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=문제+이미지+로딩+실패`;
    };

    // 3. 이미지 소스 설정 (로딩 시작)
    problemImage.src = placeholderUrl;
    // --- 문제 이미지 로딩 로직 끝 ---
}

function showMainScreen() {
    mainScreen.style.display = 'block';
    quizScreen.style.display = 'none';
    difficultySelection.style.display = 'none';

    // 선택 상태 초기화
    document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
    currentSubject = '';
    currentDifficulty = '';
    
    // 이미지 에러 핸들러 초기화 (다음 문제 로드 시 다시 설정할 수 있도록)
    problemImage.onerror = null; 
}


// 앱 초기화
window.onload = initializeFirebase;
