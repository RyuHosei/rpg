const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const positionDisplay = document.getElementById('position');

const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;

// BGM用のAudio Context
let audioContext = null;
let bgmPlaying = false;
let currentNoteTimeout = null;

// 音楽の設定
const tempo = 140; // BPM
const noteLength = (60 / tempo) * 1000; // ミリ秒

// 冒険風のメロディ（音階：C4を基準）
const melody = [
    { note: 'C5', duration: 0.25 },
    { note: 'E5', duration: 0.25 },
    { note: 'G5', duration: 0.25 },
    { note: 'C6', duration: 0.25 },
    { note: 'G5', duration: 0.25 },
    { note: 'E5', duration: 0.25 },
    { note: 'D5', duration: 0.5 },
    { note: 'C5', duration: 0.25 },
    { note: 'D5', duration: 0.25 },
    { note: 'E5', duration: 0.25 },
    { note: 'G5', duration: 0.25 },
    { note: 'F5', duration: 0.5 },
    { note: 'E5', duration: 0.5 }
];

// 音符の周波数マッピング
const noteFrequencies = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50
};

// 音を再生する関数
function playNote(frequency, duration, startTime) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'square'; // 8bitゲーム風の音
    oscillator.frequency.value = frequency;

    // エンベロープ（音量の変化）
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

// BGMを再生する関数
function playBGM() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    let index = 0;

    function playNextNote() {
        if (!bgmPlaying) return;

        const note = melody[index];
        const frequency = noteFrequencies[note.note];
        const duration = note.duration * (60 / tempo);

        playNote(frequency, duration, audioContext.currentTime);

        index = (index + 1) % melody.length;

        currentNoteTimeout = setTimeout(playNextNote, note.duration * noteLength);
    }

    bgmPlaying = true;
    playNextNote();
}

// BGMを停止する関数
function stopBGM() {
    bgmPlaying = false;
    if (currentNoteTimeout) {
        clearTimeout(currentNoteTimeout);
        currentNoteTimeout = null;
    }
}

// マップデータ (0: 草地, 1: 木, 2: 水, 3: 道, 4: 岩, 5: スタート, 6: ゴール)
const map = [];

// 迷路生成関数
function generateMaze() {
    // 全体を壁で埋める
    for (let y = 0; y < MAP_HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            map[y][x] = 1; // 壁
        }
    }

    // 迷路生成（深さ優先探索）
    const visited = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        visited[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            visited[y][x] = false;
        }
    }

    function carve(x, y) {
        visited[y][x] = true;
        map[y][x] = 0; // 通路

        // ランダムな方向の配列
        const directions = [
            [0, -2], [2, 0], [0, 2], [-2, 0]
        ];

        // シャッフル
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx > 0 && nx < MAP_WIDTH - 1 && ny > 0 && ny < MAP_HEIGHT - 1 && !visited[ny][nx]) {
                // 間の壁を削除
                map[y + dy / 2][x + dx / 2] = 0;
                carve(nx, ny);
            }
        }
    }

    // スタート地点から迷路を生成
    carve(1, 1);

    // ランダムに追加の通路を作成（迷路を少し簡単に）
    for (let i = 0; i < 30; i++) {
        const x = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
        const y = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        if (map[y][x] === 1) {
            map[y][x] = 0;
        }
    }

    // スタートとゴールを配置
    const startX = 1;
    const startY = 1;
    const goalX = MAP_WIDTH - 2;
    const goalY = MAP_HEIGHT - 2;

    map[startY][startX] = 5; // スタート
    map[goalY][goalX] = 6; // ゴール

    // スタートとゴールの周辺を通路にする（到達可能にする）
    // スタート周辺
    if (startX > 0) map[startY][startX - 1] = 0;
    if (startX < MAP_WIDTH - 1) map[startY][startX + 1] = 0;
    if (startY > 0) map[startY - 1][startX] = 0;
    if (startY < MAP_HEIGHT - 1) map[startY + 1][startX] = 0;

    // ゴール周辺
    if (goalX > 0) map[goalY][goalX - 1] = 0;
    if (goalX < MAP_WIDTH - 1) map[goalY][goalX + 1] = 0;
    if (goalY > 0) map[goalY - 1][goalX] = 0;
    if (goalY < MAP_HEIGHT - 1) map[goalY + 1][goalX] = 0;

    // 装飾として水や岩を追加（スタートとゴール周辺を除く）
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            // スタートとゴールの周辺（上下左右1マス）は装飾しない
            const nearStart = Math.abs(x - startX) <= 1 && Math.abs(y - startY) <= 1;
            const nearGoal = Math.abs(x - goalX) <= 1 && Math.abs(y - goalY) <= 1;

            if (!nearStart && !nearGoal && map[y][x] === 1 && Math.random() < 0.1) {
                map[y][x] = Math.random() < 0.5 ? 2 : 4; // 水か岩
            }
        }
    }
}

generateMaze();

// プレイヤーの初期位置（スタート地点）
const player = {
    x: 1,
    y: 1,
    direction: 'down'
};

// スライムの配列
const slimes = [];

// スライムを配置する関数
function placeSlimes() {
    slimes.length = 0; // 配列をクリア
    const numSlimes = 5; // スライムの数

    for (let i = 0; i < numSlimes; i++) {
        let x, y;
        let attempts = 0;

        // 通路で、プレイヤーやゴールから離れた位置を探す
        do {
            x = Math.floor(Math.random() * MAP_WIDTH);
            y = Math.floor(Math.random() * MAP_HEIGHT);
            attempts++;
        } while (
            (map[y][x] !== 0 && map[y][x] !== 3) || // 通路または道でない
            (x === player.x && y === player.y) || // プレイヤーと同じ位置
            (x === 1 && y === 1) || // スタート地点
            (x === MAP_WIDTH - 2 && y === MAP_HEIGHT - 2) || // ゴール地点
            (attempts < 100 && Math.abs(x - player.x) + Math.abs(y - player.y) < 5) // プレイヤーから近すぎる
        );

        slimes.push({
            x: x,
            y: y,
            direction: ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)]
        });
    }
}

// 歩けないタイル
const collidableTiles = [1, 2, 4];

// タイルの色
const tileColors = {
    0: '#90EE90', // 草地
    1: '#228B22', // 木
    2: '#4169E1', // 水
    3: '#DEB887', // 道
    4: '#808080', // 岩
    5: '#98FB98', // スタート（明るい緑）
    6: '#FFD700'  // ゴール（金色）
};

// プレイヤーの色
const playerColor = '#FF6347';

function drawMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileType = map[y][x];
            ctx.fillStyle = tileColors[tileType];
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // グリッド線
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // タイルの詳細を描画
            if (tileType === 1) { // 木
                ctx.fillStyle = '#1a5f1a';
                ctx.beginPath();
                ctx.arc(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 8, 0, Math.PI * 2);
                ctx.fill();
            } else if (tileType === 2) { // 水
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            } else if (tileType === 4) { // 岩
                ctx.fillStyle = '#606060';
                ctx.fillRect(x * TILE_SIZE + 8, y * TILE_SIZE + 8, TILE_SIZE - 16, TILE_SIZE - 16);
            } else if (tileType === 5) { // スタート
                ctx.fillStyle = '#006400';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('S', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
            } else if (tileType === 6) { // ゴール
                ctx.fillStyle = '#FF4500';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('G', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
                // 星のマークを追加
                ctx.strokeStyle = '#FF4500';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const centerX = x * TILE_SIZE + TILE_SIZE / 2;
                const centerY = y * TILE_SIZE + TILE_SIZE / 2;
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const radius = i % 2 === 0 ? 10 : 5;
                    const px = centerX + Math.cos(angle) * radius;
                    const py = centerY + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
    }
}

function drawPlayer() {
    const centerX = player.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = player.y * TILE_SIZE + TILE_SIZE / 2;

    // プレイヤーがスタートまたはゴールにいる場合、そのマークを再描画
    const currentTile = map[player.y][player.x];
    if (currentTile === 5) { // スタート
        ctx.fillStyle = '#006400';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', centerX, centerY);
    } else if (currentTile === 6) { // ゴール
        ctx.fillStyle = '#FF4500';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('G', centerX, centerY);
    }

    // マントを描画（向きによって位置を変える）
    ctx.fillStyle = '#DC143C'; // 赤いマント
    ctx.beginPath();
    switch (player.direction) {
        case 'down':
            ctx.moveTo(centerX - 6, centerY - 4);
            ctx.lineTo(centerX - 8, centerY + 8);
            ctx.lineTo(centerX + 8, centerY + 8);
            ctx.lineTo(centerX + 6, centerY - 4);
            break;
        case 'up':
            ctx.moveTo(centerX - 6, centerY + 4);
            ctx.lineTo(centerX - 8, centerY - 8);
            ctx.lineTo(centerX + 8, centerY - 8);
            ctx.lineTo(centerX + 6, centerY + 4);
            break;
        case 'left':
            ctx.moveTo(centerX + 4, centerY - 6);
            ctx.lineTo(centerX + 8, centerY - 8);
            ctx.lineTo(centerX + 8, centerY + 8);
            ctx.lineTo(centerX + 4, centerY + 6);
            break;
        case 'right':
            ctx.moveTo(centerX - 4, centerY - 6);
            ctx.lineTo(centerX - 8, centerY - 8);
            ctx.lineTo(centerX - 8, centerY + 8);
            ctx.lineTo(centerX - 4, centerY + 6);
            break;
    }
    ctx.closePath();
    ctx.fill();

    // 体（青い鎧）
    ctx.fillStyle = '#4169E1'; // ロイヤルブルー
    ctx.fillRect(centerX - 6, centerY - 2, 12, 10);

    // 鎧の装飾
    ctx.fillStyle = '#FFD700'; // 金色
    ctx.fillRect(centerX - 5, centerY - 1, 2, 8);
    ctx.fillRect(centerX + 3, centerY - 1, 2, 8);

    // 頭（肌色）
    ctx.fillStyle = '#FDBCB4';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    // 髪（金髪）
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(centerX - 3, centerY - 8, 3, 0, Math.PI * 2);
    ctx.arc(centerX, centerY - 9, 3, 0, Math.PI * 2);
    ctx.arc(centerX + 3, centerY - 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // 目
    ctx.fillStyle = '#000000';
    ctx.fillRect(centerX - 3, centerY - 6, 1, 1);
    ctx.fillRect(centerX + 2, centerY - 6, 1, 1);

    // 剣を描画（向きによって位置を変える）
    ctx.strokeStyle = '#C0C0C0'; // 銀色の剣
    ctx.lineWidth = 2;
    ctx.beginPath();

    switch (player.direction) {
        case 'down':
            // 剣を右側に持つ
            ctx.moveTo(centerX + 8, centerY);
            ctx.lineTo(centerX + 8, centerY + 10);
            // 剣の柄
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(centerX + 7, centerY + 10, 2, 3);
            // 剣の鍔
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(centerX + 6, centerY + 9, 4, 2);
            break;
        case 'up':
            // 剣を右側に持つ（上向き）
            ctx.moveTo(centerX + 8, centerY - 2);
            ctx.lineTo(centerX + 8, centerY - 12);
            // 剣の柄
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(centerX + 7, centerY - 2, 2, 3);
            // 剣の鍔
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(centerX + 6, centerY - 3, 4, 2);
            break;
        case 'left':
            // 剣を前に構える
            ctx.moveTo(centerX - 12, centerY);
            ctx.lineTo(centerX - 2, centerY);
            // 剣の柄
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(centerX - 2, centerY - 1, 3, 2);
            // 剣の鍔
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(centerX - 3, centerY - 2, 2, 4);
            break;
        case 'right':
            // 剣を前に構える
            ctx.moveTo(centerX + 2, centerY);
            ctx.lineTo(centerX + 12, centerY);
            // 剣の柄
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(centerX - 1, centerY - 1, 3, 2);
            // 剣の鍔
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(centerX + 1, centerY - 2, 2, 4);
            break;
    }
    ctx.stroke();

    // 盾（左側に持つ、向きによって見え方を変える）
    if (player.direction === 'down' || player.direction === 'up') {
        ctx.fillStyle = '#8B4513'; // 茶色の盾
        ctx.beginPath();
        ctx.arc(centerX - 8, centerY + 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // 盾の装飾
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(centerX - 8, centerY + 2, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawSlimes() {
    slimes.forEach(slime => {
        const centerX = slime.x * TILE_SIZE + TILE_SIZE / 2;
        const centerY = slime.y * TILE_SIZE + TILE_SIZE / 2;

        // スライムの体（緑色のゼリー状）
        ctx.fillStyle = '#32CD32'; // ライムグリーン
        ctx.beginPath();
        // 下半分を楕円形に
        ctx.ellipse(centerX, centerY + 2, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // ハイライト（光沢）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(centerX - 3, centerY - 1, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 目（2つの黒い点）
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 4, centerY, 2, 0, Math.PI * 2);
        ctx.arc(centerX + 4, centerY, 2, 0, Math.PI * 2);
        ctx.fill();

        // 目のハイライト（白い点）
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 1, 1, 0, Math.PI * 2);
        ctx.arc(centerX + 5, centerY - 1, 1, 0, Math.PI * 2);
        ctx.fill();
    });
}

// スライムの移動ロジック
function moveSlimes() {
    slimes.forEach(slime => {
        // 移動方向を決定
        const directions = [
            { dx: 0, dy: -1, name: 'up' },
            { dx: 0, dy: 1, name: 'down' },
            { dx: -1, dy: 0, name: 'left' },
            { dx: 1, dy: 0, name: 'right' }
        ];

        // ランダムに方向をシャッフル
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        // 移動可能な方向を見つける
        for (const dir of directions) {
            const newX = slime.x + dir.dx;
            const newY = slime.y + dir.dy;

            if (canMove(newX, newY)) {
                slime.x = newX;
                slime.y = newY;
                slime.direction = dir.name;
                break;
            }
        }
    });

    // スライム移動後に衝突をチェック
    if (checkSlimeCollision()) {
        setTimeout(() => {
            gameOver();
        }, 100);
    }

    render();
}

// スライムを1秒ごとに移動
setInterval(moveSlimes, 1000);

// 衝突判定（プレイヤーとスライムが同じ位置にいるか）
function checkSlimeCollision() {
    for (const slime of slimes) {
        if (player.x === slime.x && player.y === slime.y) {
            return true;
        }
    }
    return false;
}

// ゲームオーバー処理
function gameOver() {
    alert('ゲームオーバー！\nスライムに捕まってしまいました...\n新しい迷路でリトライします。');
    // ゲームをリセット
    generateMaze();
    player.x = 1;
    player.y = 1;
    player.direction = 'down';
    placeSlimes();
    updatePosition();
    render();
}

function updatePosition() {
    positionDisplay.textContent = `X: ${player.x}, Y: ${player.y}`;
}

function canMove(x, y) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
        return false;
    }
    return !collidableTiles.includes(map[y][x]);
}

function movePlayer(dx, dy, direction) {
    const newX = player.x + dx;
    const newY = player.y + dy;

    player.direction = direction;

    if (canMove(newX, newY)) {
        player.x = newX;
        player.y = newY;
        updatePosition();

        // スライムとの衝突をチェック
        if (checkSlimeCollision()) {
            setTimeout(() => {
                gameOver();
            }, 100);
            render();
            return;
        }

        // ゴールに到達したかチェック
        if (map[newY][newX] === 6) {
            setTimeout(() => {
                alert('おめでとうございます！ゴールに到達しました！\n新しい迷路を生成します。');
                // 新しい迷路を生成
                generateMaze();
                player.x = 1;
                player.y = 1;
                player.direction = 'down';
                placeSlimes();
                updatePosition();
                render();
            }, 100);
        }
    }

    render();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMap();
    drawSlimes();
    drawPlayer();
}

// キーボード操作
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            e.preventDefault();
            movePlayer(0, -1, 'up');
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            e.preventDefault();
            movePlayer(0, 1, 'down');
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            e.preventDefault();
            movePlayer(-1, 0, 'left');
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            e.preventDefault();
            movePlayer(1, 0, 'right');
            break;
    }
});

// タッチ操作用の十字キー
document.getElementById('btnUp').addEventListener('click', () => {
    movePlayer(0, -1, 'up');
});

document.getElementById('btnDown').addEventListener('click', () => {
    movePlayer(0, 1, 'down');
});

document.getElementById('btnLeft').addEventListener('click', () => {
    movePlayer(-1, 0, 'left');
});

document.getElementById('btnRight').addEventListener('click', () => {
    movePlayer(1, 0, 'right');
});

// タッチデバイス用：タップ時の反応を改善
const buttons = [
    document.getElementById('btnUp'),
    document.getElementById('btnDown'),
    document.getElementById('btnLeft'),
    document.getElementById('btnRight')
];

buttons.forEach(button => {
    // タッチ開始時
    button.addEventListener('touchstart', (e) => {
        e.preventDefault(); // デフォルトの動作を防止
        button.click(); // クリックイベントを発火
    });
});

// BGMトグルボタン
const bgmToggleButton = document.getElementById('bgmToggle');
bgmToggleButton.addEventListener('click', () => {
    if (bgmPlaying) {
        stopBGM();
        bgmToggleButton.textContent = '🔇 BGM OFF';
        bgmToggleButton.style.background = 'linear-gradient(145deg, #999, #666)';
    } else {
        playBGM();
        bgmToggleButton.textContent = '🔊 BGM ON';
        bgmToggleButton.style.background = 'linear-gradient(145deg, #667eea, #764ba2)';
    }
});

// 初期描画
placeSlimes();
updatePosition();
render();
