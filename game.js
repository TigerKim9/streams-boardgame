// 스트림스 온라인 멀티플레이어 게임

class StreamsOnlineGame {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.playerId = null;
        this.playerName = null;
        this.isHost = false;
        this.players = [];
        this.myWorksheet = new Array(20).fill(null);
        this.currentTile = null;
        this.gameStarted = false;
        this.isSoloMode = false;
        this.tileBag = [];
        this.tilesDrawn = 0;

        this.init();
    }

    init() {
        // Socket.io 연결
        this.socket = io();

        this.setupSocketListeners();
        this.setupUIListeners();
    }

    setupSocketListeners() {
        // 방 생성 완료
        this.socket.on('roomCreated', (data) => {
            this.roomCode = data.roomCode;
            this.players = data.players;
            this.isHost = data.isHost;
            this.playerId = this.socket.id;

            this.showLobby();
        });

        // 방 참가 완료
        this.socket.on('roomJoined', (data) => {
            this.roomCode = data.roomCode;
            this.players = data.players;
            this.isHost = data.isHost;
            this.playerId = this.socket.id;

            this.showLobby();
        });

        // 다른 플레이어 참가
        this.socket.on('playerJoined', (data) => {
            this.players = data.players;
            this.updatePlayersList();
            this.showNotification(`${data.player.name}님이 참가했습니다!`);
        });

        // 게임 시작
        this.socket.on('gameStarted', (data) => {
            this.players = data.players;
            this.gameStarted = true;

            // 로비 숨기고 게임 화면 표시
            document.getElementById('lobby').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'block';
            document.getElementById('gameRoomCode').textContent = this.roomCode;

            this.setupGame();
            this.showNotification('게임이 시작되었습니다!');
        });

        // 타일 뽑기
        this.socket.on('tileDrawn', (data) => {
            this.currentTile = data.tile;
            document.getElementById('currentTile').textContent = data.tile === '⭐' ? '⭐' : data.tile;
            document.getElementById('remainingTiles').textContent = data.remainingTiles;

            if (this.isHost) {
                document.getElementById('drawTileBtn').disabled = true;
            }

            this.showNotification(`타일: ${data.tile}`);
        });

        // 타일 배치
        this.socket.on('tilePlaced', (data) => {
            const player = this.players.find(p => p.id === data.playerId);
            if (!player) return;

            // UI 업데이트
            const cell = document.querySelector(`.cell[data-player-id="${data.playerId}"][data-index="${data.index}"]`);
            if (cell) {
                cell.textContent = data.value;
                cell.classList.add('filled', 'highlight');

                if (data.isJoker) {
                    cell.classList.add('joker');
                }

                setTimeout(() => cell.classList.remove('highlight'), 500);
            }

            // 내 배치가 아니면 알림
            if (data.playerId !== this.playerId) {
                this.showNotification(`${data.playerName}님이 배치했습니다`);
            }

            // 대기 중인 플레이어 수 표시
            if (data.waitingCount > 0) {
                this.showNotification(`${data.waitingCount}명 대기 중...`);
            }
        });

        // 라운드 완료
        this.socket.on('roundComplete', (data) => {
            this.currentTile = null;
            document.getElementById('currentTile').textContent = '-';

            if (this.isHost) {
                document.getElementById('drawTileBtn').disabled = false;
            }

            // 모든 플레이어 점수 업데이트
            this.players.forEach(player => {
                this.analyzeStreams(player.id);
                this.updatePlayerScore(player.id);
            });

            this.showNotification('라운드 완료!');
        });

        // 점수 업데이트
        this.socket.on('scoreUpdate', (data) => {
            const scoreEl = document.getElementById(`score-${data.playerId}`);
            if (scoreEl) {
                scoreEl.textContent = `${data.score}점`;
            }
        });

        // 게임 종료
        this.socket.on('gameOver', (data) => {
            this.players = data.players;
            this.endGame();
        });

        // 게임 재시작
        this.socket.on('gameRestarted', (data) => {
            this.players = data.players;
            this.restartToLobby();
        });

        // 플레이어 나감
        this.socket.on('playerLeft', (data) => {
            this.players = data.players;

            if (data.newHost === this.playerId) {
                this.isHost = true;
            }

            if (this.gameStarted) {
                // 게임 중이면 플레이어 보드 업데이트
                const playerBoard = document.getElementById(`player-${data.playerId}`);
                if (playerBoard) {
                    playerBoard.remove();
                }
            } else {
                // 대기실이면 목록 업데이트
                this.updatePlayersList();
            }

            this.showNotification(`${data.playerName}님이 나갔습니다`);
        });

        // 에러
        this.socket.on('error', (message) => {
            alert(message);
        });
    }

    setupUIListeners() {
        // 혼자 하기 버튼
        document.getElementById('soloPlayBtn').addEventListener('click', () => {
            const playerName = document.getElementById('playerNameInput').value.trim() || '나';
            this.playerName = playerName;
            this.startSoloGame();
        });

        // 방 만들기 버튼
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            const playerName = document.getElementById('playerNameInput').value.trim();

            if (!playerName) {
                alert('플레이어 이름을 입력하세요!');
                return;
            }

            this.playerName = playerName;
            this.socket.emit('createRoom', playerName);
        });

        // 방 참가하기 버튼
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            document.getElementById('joinRoomForm').style.display = 'block';
        });

        // 방 참가 취소
        document.getElementById('joinRoomCancelBtn').addEventListener('click', () => {
            document.getElementById('joinRoomForm').style.display = 'none';
            document.getElementById('roomCodeInput').value = '';
        });

        // 방 참가 확인
        document.getElementById('joinRoomConfirmBtn').addEventListener('click', () => {
            const playerName = document.getElementById('playerNameInput').value.trim();
            const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();

            if (!playerName) {
                alert('플레이어 이름을 입력하세요!');
                return;
            }

            if (!roomCode) {
                alert('방 코드를 입력하세요!');
                return;
            }

            this.playerName = playerName;
            this.socket.emit('joinRoom', { roomCode, playerName });
        });

        // 게임 시작 버튼 (호스트만)
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.socket.emit('startGame');
        });

        // 대기실 나가기
        document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
            if (confirm('대기실을 나가시겠습니까?')) {
                window.location.reload();
            }
        });

        // 타일 뽑기
        document.getElementById('drawTileBtn').addEventListener('click', () => {
            if (this.isSoloMode) {
                this.drawTileSolo();
            } else if (this.isHost) {
                this.socket.emit('drawTile');
            }
        });

        // 다시 하기
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            if (this.isSoloMode) {
                // 싱글플레이어 모드는 로컬에서 재시작
                this.restartSoloGame();
            } else {
                // 멀티플레이어 모드는 서버에 재시작 요청
                if (this.isHost) {
                    this.socket.emit('restartGame');
                } else {
                    alert('방장만 게임을 재시작할 수 있습니다.');
                }
            }
        });
    }

    showLobby() {
        // 설정 섹션 숨기고 방 섹션 표시
        document.querySelector('.setup-section').style.display = 'none';
        document.getElementById('roomSection').style.display = 'block';
        document.getElementById('roomCodeDisplay').textContent = this.roomCode;

        if (this.isHost) {
            document.getElementById('startGameBtn').style.display = 'inline-block';
        }

        this.updatePlayersList();
    }

    updatePlayersList() {
        const container = document.getElementById('playersListContent');
        container.innerHTML = '';

        this.players.forEach((player, index) => {
            const playerEl = document.createElement('div');
            playerEl.className = 'lobby-player';

            if (player.id === this.players[0].id) {
                playerEl.classList.add('host');
            }

            playerEl.innerHTML = `
                <div class="lobby-player-name">
                    ${index + 1}. ${player.name}
                    ${player.id === this.players[0].id ? ' (방장)' : ''}
                </div>
            `;

            container.appendChild(playerEl);
        });
    }

    setupGame() {
        // 플레이어 보드 생성
        const container = document.getElementById('playersContainer');
        container.innerHTML = '';

        const playerColors = ['#667eea', '#f093fb', '#4facfe', '#43e97b'];

        this.players.forEach((player, index) => {
            const playerBoard = document.createElement('div');
            playerBoard.className = 'player-board';
            playerBoard.id = `player-${player.id}`;

            const isMe = player.id === this.playerId;

            const header = document.createElement('div');
            header.className = 'player-header';
            header.innerHTML = `
                <div>
                    <span class="player-name" style="color: ${playerColors[index]}">${player.name}${isMe ? ' (나)' : ''}</span>
                </div>
                <div class="player-score" id="score-${player.id}">0점</div>
            `;

            const worksheet = document.createElement('div');
            worksheet.className = 'worksheet';
            worksheet.id = `worksheet-${player.id}`;

            // 20개의 칸 생성
            for (let i = 0; i < 20; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.playerId = player.id;
                cell.dataset.index = i;
                cell.innerHTML = `<span class="cell-index">${i + 1}</span>`;

                // 내 보드에만 클릭 이벤트
                if (isMe) {
                    cell.addEventListener('click', () => this.placeNumber(i));
                }

                worksheet.appendChild(cell);
            }

            const streamDisplay = document.createElement('div');
            streamDisplay.className = 'stream-display';
            streamDisplay.id = `stream-${player.id}`;

            playerBoard.appendChild(header);
            playerBoard.appendChild(worksheet);
            playerBoard.appendChild(streamDisplay);
            container.appendChild(playerBoard);
        });

        // 호스트만 타일 뽑기 버튼 표시
        if (this.isHost) {
            document.getElementById('drawTileBtn').style.display = 'inline-block';
        } else {
            document.getElementById('drawTileBtn').style.display = 'none';
        }

        document.getElementById('currentTurnCard').style.display = 'none';
    }

    placeNumber(index) {
        // 싱글플레이어 모드
        if (this.isSoloMode) {
            this.placeTileSolo(index);
            return;
        }

        // 멀티플레이어 모드
        if (!this.currentTile) {
            alert('타일이 뽑히지 않았습니다!');
            return;
        }

        if (this.myWorksheet[index] !== null) {
            alert('이미 숫자가 배치된 칸입니다!');
            return;
        }

        // 숫자 배치
        const isJoker = this.currentTile === '⭐';
        const value = isJoker ? '⭐' : this.currentTile;

        this.myWorksheet[index] = {
            value: value,
            isJoker: isJoker
        };

        // 서버에 알림
        this.socket.emit('placeTile', { index });

        // 점수 업데이트
        setTimeout(() => {
            const streams = this.analyzeStreams(this.playerId);
            const score = this.calculateTotalScore(streams);
            this.socket.emit('updateScore', { score, streams });
        }, 100);
    }

    analyzeStreams(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return [];

        const worksheet = playerId === this.playerId ? this.myWorksheet : player.worksheet;
        const streamDisplay = document.getElementById(`stream-${playerId}`);
        const streams = [];
        let currentStream = [];

        // 스트림 끊김 표시 초기화
        document.querySelectorAll(`.cell[data-player-id="${playerId}"].stream-break`).forEach(cell => {
            cell.classList.remove('stream-break');
        });

        // 스트림 분석
        for (let i = 0; i < 20; i++) {
            const cell = worksheet[i];

            if (cell === null) {
                continue;
            }

            if (currentStream.length === 0) {
                currentStream.push(cell.value);
            } else {
                // 이전 값 찾기 (조커가 아닌 마지막 값)
                let lastValue = null;
                for (let j = currentStream.length - 1; j >= 0; j--) {
                    if (currentStream[j] !== '⭐') {
                        lastValue = currentStream[j];
                        break;
                    }
                }

                // 조커는 항상 오름차순을 유지
                if (cell.value === '⭐') {
                    currentStream.push(cell.value);
                } else if (lastValue === null) {
                    // 이전이 모두 조커인 경우
                    currentStream.push(cell.value);
                } else if (cell.value >= lastValue) {
                    // 오름차순 체크 (같은 값도 허용)
                    currentStream.push(cell.value);
                } else {
                    // 스트림 끊김
                    streams.push([...currentStream]);
                    currentStream = [cell.value];

                    // UI에 스트림 끊김 표시
                    const prevCell = document.querySelector(`.cell[data-player-id="${playerId}"][data-index="${i - 1}"]`);
                    if (prevCell) {
                        prevCell.classList.add('stream-break');
                    }
                }
            }
        }

        if (currentStream.length > 0) {
            streams.push(currentStream);
        }

        // 스트림 표시
        if (streams.length > 0 && streamDisplay) {
            streamDisplay.innerHTML = '<h4 style="font-size: 0.9em; color: #667eea; margin-bottom: 10px;">현재 스트림:</h4>';
            streams.forEach((stream, idx) => {
                const score = this.calculateStreamScore(stream.length);
                const streamDiv = document.createElement('div');
                streamDiv.className = 'stream';
                streamDiv.style.fontSize = '0.85em';
                streamDiv.textContent = `스트림 ${idx + 1}: [${stream.join(', ')}] - ${stream.length}칸 (${score}점)`;
                streamDisplay.appendChild(streamDiv);
            });
        }

        return streams;
    }

    calculateStreamScore(length) {
        // 점수 = n × (n + 1) / 2
        return (length * (length + 1)) / 2;
    }

    calculateTotalScore(streams) {
        let totalScore = 0;
        streams.forEach(stream => {
            totalScore += this.calculateStreamScore(stream.length);
        });
        return totalScore;
    }

    updatePlayerScore(playerId) {
        const streams = this.analyzeStreams(playerId);
        const score = this.calculateTotalScore(streams);
        const scoreEl = document.getElementById(`score-${playerId}`);
        if (scoreEl) {
            scoreEl.textContent = `${score}점`;
        }
    }

    endGame() {
        // 최종 점수 계산
        this.players.forEach(player => {
            this.updatePlayerScore(player.id);
        });

        // 승자 찾기
        const scores = this.players.map(p => {
            const scoreEl = document.getElementById(`score-${p.id}`);
            return {
                player: p,
                score: parseInt(scoreEl.textContent) || 0
            };
        });

        scores.sort((a, b) => b.score - a.score);
        const maxScore = scores[0].score;
        const winners = scores.filter(s => s.score === maxScore);

        // 게임 오버 모달 표시
        const modal = document.getElementById('gameOverModal');
        const finalScoreDiv = document.getElementById('finalScore');
        const breakdownDiv = document.getElementById('streamBreakdown');

        if (winners.length > 1) {
            finalScoreDiv.textContent = '무승부!';
        } else {
            finalScoreDiv.textContent = `${winners[0].player.name} 승리!`;
        }

        // 전체 결과 표시
        let breakdownHTML = '<h4>최종 결과:</h4>';

        scores.forEach((item, rank) => {
            const streams = this.analyzeStreams(item.player.id);
            const isWinner = item.score === maxScore;
            const playerColors = ['#667eea', '#f093fb', '#4facfe', '#43e97b'];
            const color = playerColors[this.players.indexOf(item.player)] || '#667eea';

            breakdownHTML += `
                <div style="margin: 15px 0; padding: 15px; background: ${isWinner ? '#fff3cd' : 'white'}; border-radius: 10px; border: 2px solid ${isWinner ? '#ffc107' : '#ddd'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 1.2em; color: ${color}">${rank + 1}. ${item.player.name}</strong>
                        ${isWinner ? '<span style="background: #ffd700; padding: 3px 10px; border-radius: 15px; font-size: 0.9em;">🏆 승자</span>' : ''}
                    </div>
                    <div style="font-size: 1.1em; font-weight: bold; color: #764ba2; margin-bottom: 10px;">
                        총 점수: ${item.score}점
                    </div>
                    <div style="font-size: 0.9em;">
                        ${streams.map((stream, idx) => {
                            const score = this.calculateStreamScore(stream.length);
                            return `스트림 ${idx + 1}: ${stream.length}칸 (${score}점)`;
                        }).join(' | ')}
                    </div>
                </div>
            `;
        });

        breakdownDiv.innerHTML = breakdownHTML;
        modal.classList.add('show');

        // 버튼 비활성화
        document.getElementById('drawTileBtn').disabled = true;

        this.showNotification('게임 종료!');
    }

    restartToLobby() {
        // 게임 상태 초기화
        this.myWorksheet = new Array(20).fill(null);
        this.currentTile = null;
        this.gameStarted = false;

        // 게임 화면 숨기고 로비 표시
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('gameOverModal').classList.remove('show');
        document.getElementById('lobby').style.display = 'block';

        // 로비 UI 업데이트
        this.showLobby();

        this.showNotification('게임이 재시작되었습니다. 방장이 게임을 시작할 수 있습니다.');
    }

    restartSoloGame() {
        // 게임 상태 초기화
        this.myWorksheet = new Array(20).fill(null);
        this.currentTile = null;
        this.tileBag = this.createTileBag();
        this.tilesDrawn = 0;

        // 플레이어 워크시트 초기화
        this.players[0].worksheet = new Array(20).fill(null);
        this.players[0].score = 0;

        // 게임 오버 모달 숨기기
        document.getElementById('gameOverModal').classList.remove('show');

        // 게임 화면 재설정
        this.setupGame();

        // 타일 뽑기 버튼 활성화
        document.getElementById('drawTileBtn').disabled = false;

        this.showNotification('게임이 재시작되었습니다!');
    }

    showNotification(message) {
        // 간단한 알림 표시 (나중에 토스트로 개선 가능)
        console.log('알림:', message);
    }

    // 싱글플레이어 모드 메서드들
    startSoloGame() {
        this.isSoloMode = true;
        this.isHost = true;
        this.playerId = 'solo-player';
        this.gameStarted = true;

        // 플레이어 설정
        this.players = [{
            id: this.playerId,
            name: this.playerName,
            worksheet: new Array(20).fill(null),
            score: 0
        }];

        // 타일백 생성
        this.tileBag = this.createTileBag();
        this.tilesDrawn = 0;

        // 로비 숨기고 게임 화면 표시
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        document.getElementById('gameRoomCode').textContent = '혼자하기 모드';

        this.setupGame();
        this.showNotification('게임 시작!');
    }

    createTileBag() {
        const tiles = [];

        // 0-99 숫자를 각각 2개씩
        for (let i = 0; i <= 99; i++) {
            tiles.push(i);
            tiles.push(i);
        }

        // 조커(별) 타일 5개 추가
        for (let i = 0; i < 5; i++) {
            tiles.push('⭐');
        }

        // 타일 섞기 (Fisher-Yates shuffle)
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }

        return tiles;
    }

    drawTileSolo() {
        if (this.tilesDrawn >= 20) {
            this.endGame();
            return;
        }

        if (this.tileBag.length === 0) {
            alert('타일이 모두 소진되었습니다!');
            return;
        }

        const tile = this.tileBag.pop();
        this.currentTile = tile;
        this.tilesDrawn++;

        document.getElementById('currentTile').textContent = tile === '⭐' ? '⭐' : tile;
        document.getElementById('remainingTiles').textContent = 21 - this.tilesDrawn;
        document.getElementById('drawTileBtn').disabled = true;

        this.showNotification(`타일: ${tile}`);
    }

    placeTileSolo(index) {
        if (!this.currentTile) {
            alert('타일이 뽑히지 않았습니다!');
            return;
        }

        if (this.myWorksheet[index] !== null) {
            alert('이미 숫자가 배치된 칸입니다!');
            return;
        }

        // 숫자 배치
        const isJoker = this.currentTile === '⭐';
        const value = isJoker ? '⭐' : this.currentTile;

        this.myWorksheet[index] = {
            value: value,
            isJoker: isJoker
        };

        // UI 업데이트
        const cell = document.querySelector(`.cell[data-player-id="${this.playerId}"][data-index="${index}"]`);
        if (cell) {
            cell.textContent = value;
            cell.classList.add('filled', 'highlight');

            if (isJoker) {
                cell.classList.add('joker');
            }

            setTimeout(() => cell.classList.remove('highlight'), 500);
        }

        // 점수 업데이트
        setTimeout(() => {
            const streams = this.analyzeStreams(this.playerId);
            const score = this.calculateTotalScore(streams);
            const scoreEl = document.getElementById(`score-${this.playerId}`);
            if (scoreEl) {
                scoreEl.textContent = `${score}점`;
            }
        }, 100);

        // 다음 타일을 위해 준비
        this.currentTile = null;
        document.getElementById('currentTile').textContent = '-';
        document.getElementById('drawTileBtn').disabled = false;

        // 게임 종료 체크
        if (this.tilesDrawn >= 20) {
            this.endGame();
        }
    }
}

// 게임 시작
let game;

window.addEventListener('DOMContentLoaded', () => {
    game = new StreamsOnlineGame();
});
