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

// 캔버스 해상도 설정
const CANVAS_WIDTH = 550; 
const CANVAS_HEIGHT = 400; 

canvasP1.width = CANVAS_WIDTH; canvasP1.height = CANVAS_HEIGHT;
canvasP2.width = CANVAS_WIDTH; canvasP2.height = CANVAS_HEIGHT;

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
let problemData = null; // 문제 데이터를 저장할 전역 변수

// 주제 키와 표시 이름을 매핑
const SUBJECT_NAMES = {
    'polynomial': '다항식',
    'equation': '방정식과 부등식',
    'permutation': '순열과 조합',
    'matrix': '행렬',
    'geometry': '도형의 방정식',
    'set': '집합과 명제',
    'function': '함수와 그래프'
};

/**
 * [중요] 파일 경로 매핑 테이블: 논리적 경로 -> 실제 파일 이름
 * JSON 파일에 정의된 논리적인 경로(키)를 
 * 이 환경에 실제로 업로드된 파일 이름(값)으로 매핑합니다.
 * 파일을 추가할 때마다 이 객체를 업데이트해야 합니다.
 */
const FILE_PATH_MAP = {
    // 현재 다항식 - 하 (EASY)의 첫 번째 문제를 실제 업로드된 파일 이름으로 매핑합니다.
    "/images/polynomial/easy_1.png": "image_926f5c.png", 
    
    // 다른 파일들도 이 형식으로 추가해야 합니다. 예시:
    // "/images/polynomial/easy_2.png": "실제_업로드된_파일_이름_2.png", 
    // "/images/polynomial/hard_1.png": "실제_업로드된_파일_이름_3.png"
};

/**
 * 논리적 이미지 경로를 실제 로드 가능한 파일 이름으로 변환합니다.
 * @param {string} logicalPath JSON에 정의된 논리적 경로
 * @returns {string} 로드에 사용될 실제 파일 이름
 */
function resolveImagePath(logicalPath) {
    // 맵에 경로가 정의되어 있으면 실제 파일 이름 반환
    if (FILE_PATH_MAP[logicalPath]) {
        return FILE_PATH_MAP[logicalPath];
    }
    // 맵에 없으면 경로 그대로 반환 (로딩 실패의 원인이 될 수 있음)
    return logicalPath;
}


// --- 문제 데이터 로딩 함수 ---
async function fetchProblemData() {
    try {
        const response = await fetch('problem.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        problemData = await response.json();
        console.log("Problem data loaded successfully.");
    } catch (error) {
        console.error("Failed to load problem.json:", error);
        problemData = {}; 
    }
}
// ----------------------------

// 캔버스 초기화 및 스타일 설정 함수
function setupCanvasContext(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = drawingState.p1.color; 

    // 배경을 흰색으로 초기화
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// 캔버스 초기화
setupCanvasContext(ctxP1);
setupCanvasContext(ctxP2);

// 드로잉 함수
function draw(e, state) {
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
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', (e) => draw(e, state));

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    canvas.addEventListener('touchmove', (e) => draw(e, state));

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
function setupMainUiEvents() {
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
}

function showQuizScreen() {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';

    if (!problemData) {
        currentSubjectDifficulty.textContent = "오류: 문제 데이터를 로드하지 못했습니다.";
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=문제+데이터+오류`;
        return;
    }

    const subjectData = problemData[currentSubject];
    const problemArray = subjectData ? subjectData[currentDifficulty] : null;

    if (!subjectData || !problemArray || problemArray.length === 0) {
        currentSubjectDifficulty.textContent = "오류: 해당 주제/난이도의 문제 배열을 찾을 수 없습니다.";
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=문제+데이터+오류`;
        return;
    }
    
    // 1. 문제 배열에서 랜덤으로 하나 선택
    const randomIndex = Math.floor(Math.random() * problemArray.length);
    const selectedProblem = problemArray[randomIndex];
    const logicalPath = selectedProblem.url;
    
    // 2. 논리적 경로를 실제 파일 이름으로 변환
    const actualImagePath = resolveImagePath(logicalPath); 

    // 콘솔에 로딩 시도 경로 로그
    console.log("Attempting to load image from LOGICAL URL:", logicalPath);
    console.log("Resolved to ACTUAL FILE NAME:", actualImagePath);

    
    // 현재 문제/난이도 표시 업데이트
    const subjectText = SUBJECT_NAMES[currentSubject] || '미정';
    const difficultyText = subjectData.difficulty_map[currentDifficulty] || '미정';
    currentSubjectDifficulty.textContent = `${subjectText} / ${difficultyText} (ID: ${selectedProblem.id})`;
    
    // --- 문제 이미지 로딩 로직 ---
    // 3. 이미지 로딩 에러 핸들러 설정
    problemImage.onerror = () => {
        console.error(`Failed to load image: ${actualImagePath}. Falling back to error text.`);
        // 에러 발생 시 폴백 이미지에 실패 경로 표시 (JSON 경로 + 실제 경로 모두 표시)
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!+JSON경로:+${logicalPath}+/ 실제파일명:+${actualImagePath}`;
    };

    // 4. 이미지 소스 설정 (로딩 시작)
    // resolveImagePath를 거친 실제 파일 이름으로 로드 시도
    problemImage.src = actualImagePath;
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


// 앱 초기화: 문제 데이터 로드 후 UI 이벤트 설정
window.onload = async () => {
    await fetchProblemData();
    setupMainUiEvents();
};
