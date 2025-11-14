const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 정적 파일 제공
app.use(express.static(path.join(__dirname)));

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 게임 방 관리
const rooms = new Map();

// 방 코드 생성
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 타일 주머니 생성
function createTileBag() {
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

    // 타일 섞기
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    return tiles;
}

io.on('connection', (socket) => {
    console.log('✅ 새 플레이어 Socket.io 연결:', socket.id);

    // 방 생성
    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            host: socket.id,
            players: [{
                id: socket.id,
                name: playerName,
                worksheet: new Array(20).fill(null),
                tilesPlaced: 0,
                score: 0
            }],
            tiles: createTileBag(),
            currentTile: null,
            tilesDrawn: 0,
            currentPlayerIndex: 0,
            gameStarted: false,
            waitingForPlacements: [],
            autoDrawEnabled: false
        };

        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.roomCode = roomCode;

        console.log(`방 생성: ${roomCode} (호스트: ${playerName})`);

        socket.emit('roomCreated', {
            roomCode: roomCode,
            players: room.players,
            isHost: true
        });
    });

    // 방 참가
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit('error', '존재하지 않는 방입니다.');
            return;
        }

        if (room.gameStarted) {
            socket.emit('error', '이미 게임이 시작되었습니다.');
            return;
        }

        if (room.players.length >= 4) {
            socket.emit('error', '방이 가득 찼습니다.');
            return;
        }

        const player = {
            id: socket.id,
            name: playerName,
            worksheet: new Array(20).fill(null),
            tilesPlaced: 0,
            score: 0
        };

        room.players.push(player);
        socket.join(roomCode);
        socket.roomCode = roomCode;

        console.log(`${playerName}이(가) 방 ${roomCode}에 참가`);

        // 참가한 플레이어에게
        socket.emit('roomJoined', {
            roomCode: roomCode,
            players: room.players,
            isHost: false
        });

        // 방의 다른 플레이어들에게
        socket.to(roomCode).emit('playerJoined', {
            player: player,
            players: room.players
        });
    });

    // 게임 시작 (호스트만 가능)
    socket.on('startGame', () => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);

        if (!room || room.host !== socket.id) {
            socket.emit('error', '호스트만 게임을 시작할 수 있습니다.');
            return;
        }

        room.gameStarted = true;
        room.tiles = createTileBag();

        console.log(`방 ${roomCode} 게임 시작`);

        io.to(roomCode).emit('gameStarted', {
            players: room.players
        });
    });

    // 타일 뽑기 (호스트만 가능)
    socket.on('drawTile', () => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);

        if (!room || room.host !== socket.id) {
            socket.emit('error', '호스트만 타일을 뽑을 수 있습니다.');
            return;
        }

        if (room.waitingForPlacements.length > 0) {
            socket.emit('error', '모든 플레이어가 배치를 완료해야 합니다.');
            return;
        }

        if (room.tilesDrawn >= 20) {
            socket.emit('error', '게임이 종료되었습니다.');
            return;
        }

        if (room.tiles.length === 0) {
            socket.emit('error', '타일이 모두 소진되었습니다.');
            return;
        }

        const tile = room.tiles.pop();
        room.currentTile = tile;
        room.waitingForPlacements = room.players.map(p => p.id);

        console.log(`방 ${roomCode}: 타일 ${tile} 뽑음`);

        io.to(roomCode).emit('tileDrawn', {
            tile: tile,
            remainingTiles: 20 - room.tilesDrawn
        });
    });

    // 타일 배치
    socket.on('placeTile', ({ index }) => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);

        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        if (player.worksheet[index] !== null) {
            socket.emit('error', '이미 숫자가 배치된 칸입니다.');
            return;
        }

        // 숫자 배치
        const isJoker = room.currentTile === '⭐';
        const value = isJoker ? '⭐' : room.currentTile;

        player.worksheet[index] = {
            value: value,
            isJoker: isJoker
        };

        player.tilesPlaced++;

        // 대기 목록에서 제거
        room.waitingForPlacements = room.waitingForPlacements.filter(id => id !== socket.id);

        console.log(`${player.name}이(가) ${value}를 ${index}에 배치`);

        // 모든 플레이어에게 배치 알림
        io.to(roomCode).emit('tilePlaced', {
            playerId: socket.id,
            playerName: player.name,
            index: index,
            value: value,
            isJoker: isJoker,
            waitingCount: room.waitingForPlacements.length
        });

        // 모든 플레이어가 배치 완료
        if (room.waitingForPlacements.length === 0) {
            room.tilesDrawn++;
            room.currentTile = null;

            console.log(`방 ${roomCode}: 라운드 ${room.tilesDrawn} 완료`);

            io.to(roomCode).emit('roundComplete', {
                tilesDrawn: room.tilesDrawn
            });

            // 게임 종료 체크
            if (room.tilesDrawn >= 20) {
                endGame(roomCode);
            } else if (room.autoDrawEnabled && room.tiles.length > 0) {
                // 자동 타일 뽑기가 활성화되어 있으면 자동으로 다음 타일 뽑기
                setTimeout(() => {
                    const tile = room.tiles.pop();
                    room.currentTile = tile;
                    room.waitingForPlacements = room.players.map(p => p.id);

                    console.log(`방 ${roomCode}: 자동으로 타일 ${tile} 뽑음`);

                    io.to(roomCode).emit('tileDrawn', {
                        tile: tile,
                        remainingTiles: 20 - room.tilesDrawn
                    });
                }, 500);
            }
        }
    });

    // 점수 업데이트
    socket.on('updateScore', ({ score, streams }) => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);

        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.score = score;

            io.to(roomCode).emit('scoreUpdate', {
                playerId: socket.id,
                score: score,
                streams: streams
            });
        }
    });

    // 게임 재시작 (호스트만 가능)
    socket.on('restartGame', () => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);

        if (!room || room.host !== socket.id) {
            socket.emit('error', '호스트만 게임을 재시작할 수 있습니다.');
            return;
        }

        console.log(`방 ${roomCode} 게임 재시작`);

        // 게임 상태 초기화
        room.gameStarted = false;
        room.tiles = createTileBag();
        room.currentTile = null;
        room.tilesDrawn = 0;
        room.waitingForPlacements = [];
        room.autoDrawEnabled = false;

        // 모든 플레이어의 워크시트와 점수 초기화
        room.players.forEach(player => {
            player.worksheet = new Array(20).fill(null);
            player.tilesPlaced = 0;
            player.score = 0;
        });

        // 모든 플레이어에게 재시작 알림
        io.to(roomCode).emit('gameRestarted', {
            players: room.players
        });
    });

    // 자동 타일 뽑기 토글
    socket.on('toggleAutoDraw', ({ enabled }) => {
        const roomCode = socket.roomCode;
        const room = rooms.get(roomCode);

        if (!room || room.host !== socket.id) {
            socket.emit('error', '호스트만 자동 타일 뽑기를 설정할 수 있습니다.');
            return;
        }

        room.autoDrawEnabled = enabled;

        console.log(`방 ${roomCode} 자동 타일 뽑기: ${enabled ? '활성화' : '비활성화'}`);

        // 모든 플레이어에게 자동 타일 뽑기 상태 알림
        io.to(roomCode).emit('autoDrawToggled', {
            enabled: enabled
        });
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log('플레이어 연결 해제:', socket.id);

        const roomCode = socket.roomCode;
        if (!roomCode) return;

        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        console.log(`${player.name}이(가) 방 ${roomCode}에서 나감`);

        // 플레이어 제거
        room.players = room.players.filter(p => p.id !== socket.id);

        // 방이 비었으면 삭제
        if (room.players.length === 0) {
            rooms.delete(roomCode);
            console.log(`방 ${roomCode} 삭제`);
            return;
        }

        // 호스트가 나갔으면 다음 플레이어를 호스트로
        if (room.host === socket.id) {
            room.host = room.players[0].id;
            console.log(`새 호스트: ${room.players[0].name}`);
        }

        // 대기 목록에서 제거
        room.waitingForPlacements = room.waitingForPlacements.filter(id => id !== socket.id);

        // 남은 플레이어들에게 알림
        io.to(roomCode).emit('playerLeft', {
            playerId: socket.id,
            playerName: player.name,
            players: room.players,
            newHost: room.host
        });
    });
});

function endGame(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    console.log(`방 ${roomCode} 게임 종료`);

    io.to(roomCode).emit('gameOver', {
        players: room.players
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ 스트림스 게임 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`   http://localhost:${PORT}`);
});
