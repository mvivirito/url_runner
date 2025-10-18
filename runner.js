'use strict';

var GRID_WIDTH = 40;
var GRID_HEIGHT = 4;
var PLAYER_CELL = 1;
var OBSTACLE_CELL = 2;
var BRAILLE_SPACE = '\u2800';

var grid;
var playerY;
var playerVelocityY;
var obstacles;
var score;
var frameCount;
var gamePaused = false;
var urlRevealed = false;
var whitespaceReplacementChar;
var gameOver = false;

var GRAVITY = 0.5;
var JUMP_STRENGTH = -2.5;
var FLOAT_GRAVITY = 0.05; // Reduced gravity when holding jump for long float
var OBSTACLE_SPEED = 1;
var OBSTACLE_SPAWN_INTERVAL = 60; // frames

var jumpHeld = false;

function main() {
  detectBrowserUrlWhitespaceEscaping();
  cleanUrl();
  setupEventHandlers();
  drawMaxScore();
  initUrlRevealed();
  startGame();

  var lastFrameTime = Date.now();
  window.requestAnimationFrame(function frameHandler() {
    var now = Date.now();
    if (!gamePaused && now - lastFrameTime >= tickTime()) {
      updateWorld();
      drawWorld();
      lastFrameTime = now;
    }
    window.requestAnimationFrame(frameHandler);
  });
}

function detectBrowserUrlWhitespaceEscaping() {
  history.replaceState(null, null, '#' + BRAILLE_SPACE + BRAILLE_SPACE);
  if (location.hash.indexOf(BRAILLE_SPACE) == -1) {
    console.warn('Browser is escaping whitespace characters on URL');
    var replacementData = pickWhitespaceReplacementChar();
    whitespaceReplacementChar = replacementData[0];
    $('#url-escaping-note').classList.remove('invisible');
    $('#replacement-char-description').textContent = replacementData[1];
  }
}

function cleanUrl() {
  history.replaceState(null, null, location.pathname.replace(/\b\/$/, ''));
}

function setupEventHandlers() {
  document.onkeydown = function (event) {
    var key = event.keyCode;
    // Space, Up arrow, or W
    if (key === 32 || key === 38 || key === 87) {
      event.preventDefault();
      if (!jumpHeld) {
        jump();
        jumpHeld = true;
      }
    }
  };

  document.onkeyup = function (event) {
    var key = event.keyCode;
    if (key === 32 || key === 38 || key === 87) {
      jumpHeld = false;
    }
  };

  var mouseHeld = false;
  document.onmousedown = function () {
    if (!mouseHeld && !gameOver) {
      jump();
      mouseHeld = true;
      jumpHeld = true;
    }
  };

  document.onmouseup = function () {
    mouseHeld = false;
    jumpHeld = false;
  };

  $('#jump-btn').ontouchstart = function (e) {
    e.preventDefault();
    if (!gameOver) {
      jump();
      jumpHeld = true;
    }
  };

  $('#jump-btn').ontouchend = function (e) {
    e.preventDefault();
    jumpHeld = false;
  };

  window.onblur = function pauseGame() {
    gamePaused = true;
    window.history.replaceState(null, null, location.hash + '[paused]');
  };

  window.onfocus = function unpauseGame() {
    gamePaused = false;
    if (!gameOver) {
      drawWorld();
    }
  };

  $('#reveal-url').onclick = function (e) {
    e.preventDefault();
    setUrlRevealed(!urlRevealed);
  };

  document.querySelectorAll('.expandable').forEach(function (expandable) {
    var expand = expandable.querySelector('.expand-btn');
    var collapse = expandable.querySelector('.collapse-btn');
    var content = expandable.querySelector('.expandable-content');
    expand.onclick = collapse.onclick = function () {
      expand.classList.remove('hidden');
      content.classList.remove('hidden');
      expandable.classList.toggle('expanded');
    };
    expandable.ontransitionend = function () {
      var expanded = expandable.classList.contains('expanded');
      expand.classList.toggle('hidden', expanded);
      content.classList.toggle('hidden', !expanded);
    };
  });
}

function initUrlRevealed() {
  setUrlRevealed(Boolean(localStorage.urlRevealed));
}

function setUrlRevealed(value) {
  urlRevealed = value;
  $('#url-container').classList.toggle('invisible', !urlRevealed);
  if (urlRevealed) {
    localStorage.urlRevealed = 'y';
  } else {
    delete localStorage.urlRevealed;
  }
}

function startGame() {
  grid = new Array(GRID_WIDTH * GRID_HEIGHT);
  playerY = GRID_HEIGHT - 1; // Start on ground
  playerVelocityY = 0;
  obstacles = [];
  score = 0;
  frameCount = 0;
  gameOver = false;
  jumpHeld = false;
}

function jump() {
  if (gameOver) {
    startGame();
    return;
  }
  
  // Only jump if on or near ground
  if (playerY >= GRID_HEIGHT - 1.5) {
    playerVelocityY = JUMP_STRENGTH;
  }
}

function updateWorld() {
  if (gameOver) {
    return;
  }

  frameCount++;

  // Update player physics with float mechanic
  // Apply float when holding jump and falling (positive velocity)
  var currentGravity = jumpHeld ? FLOAT_GRAVITY : GRAVITY;
  playerVelocityY += currentGravity;
  playerY += playerVelocityY;

  // Ground collision
  if (playerY >= GRID_HEIGHT - 1) {
    playerY = GRID_HEIGHT - 1;
    playerVelocityY = 0;
  }

  // Ceiling collision
  if (playerY < 0) {
    playerY = 0;
    playerVelocityY = 0;
  }

  // Spawn obstacles with increasing height
  if (frameCount % OBSTACLE_SPAWN_INTERVAL === 0) {
    // Every 10 obstacles, increase max height by 1 (max 3 pixels tall)
    var maxHeight = Math.min(3, Math.floor(score / 10) + 1);
    var height = Math.floor(Math.random() * maxHeight) + 1;
    obstacles.push({
      x: GRID_WIDTH - 1,
      height: height
    });
  }

  // Update obstacles
  for (var i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= OBSTACLE_SPEED;
    
    // Remove off-screen obstacles
    if (obstacles[i].x < -2) {
      obstacles.splice(i, 1);
      score++;
    }
  }

  // Check collisions
  var playerX = 2; // Player is always at x=2
  var playerYRounded = Math.round(playerY);
  
  for (var i = 0; i < obstacles.length; i++) {
    var obs = obstacles[i];
    // Check if player overlaps with obstacle
    if (obs.x >= playerX - 1 && obs.x <= playerX + 1) {
      for (var h = 0; h < obs.height; h++) {
        var obstacleY = GRID_HEIGHT - 1 - h;
        if (playerYRounded === obstacleY) {
          endGame();
          gameOver = true;
          return;
        }
      }
    }
  }
}

function endGame() {
  var maxScore = parseInt(localStorage.maxScore || 0);
  if (score > 0 && score > maxScore) {
    localStorage.maxScore = score;
    localStorage.maxScoreGrid = gridString();
    drawMaxScore();
    showMaxScore();
  }
}

function drawWorld() {
  // Clear grid
  for (var i = 0; i < grid.length; i++) {
    grid[i] = null;
  }

  // Draw player
  var playerX = 2;
  var playerYRounded = Math.round(playerY);
  setCellAt(playerX, playerYRounded, PLAYER_CELL);

  // Draw obstacles
  for (var i = 0; i < obstacles.length; i++) {
    var obs = obstacles[i];
    var obsX = Math.round(obs.x);
    if (obsX >= 0 && obsX < GRID_WIDTH) {
      for (var h = 0; h < obs.height; h++) {
        var y = GRID_HEIGHT - 1 - h;
        setCellAt(obsX, y, OBSTACLE_CELL);
      }
    }
  }

  var hash = '#|' + gridString() + '|[score:' + score + ']';

  if (gameOver) {
    hash += '[GAME OVER - click to restart]';
  }

  if (urlRevealed) {
    $('#url').textContent = location.href.replace(/#.*$/, '') + hash;
  }

  if (whitespaceReplacementChar) {
    hash = hash.replace(/\u2800/g, whitespaceReplacementChar);
  }

  history.replaceState(null, null, hash);

  if (decodeURIComponent(location.hash) !== hash) {
    console.warn(
      'history.replaceState() throttling detected. Using location.hash fallback'
    );
    location.hash = hash;
  }
}

function gridString() {
  var str = '';
  for (var x = 0; x < GRID_WIDTH; x += 2) {
    // Unicode Braille patterns - same technique as snake game
    var n = 0
      | bitAt(x, 0) << 0
      | bitAt(x, 1) << 1
      | bitAt(x, 2) << 2
      | bitAt(x + 1, 0) << 3
      | bitAt(x + 1, 1) << 4
      | bitAt(x + 1, 2) << 5
      | bitAt(x, 3) << 6
      | bitAt(x + 1, 3) << 7;
    str += String.fromCharCode(0x2800 + n);
  }
  return str;
}

function tickTime() {
  // Fixed tick rate for consistent game speed
  return 50; // 20 FPS
}

function cellAt(x, y) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
    return null;
  }
  return grid[x + y * GRID_WIDTH];
}

function bitAt(x, y) {
  return cellAt(x, y) ? 1 : 0;
}

function setCellAt(x, y, cellType) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
    return;
  }
  grid[x + y * GRID_WIDTH] = cellType;
}

function drawMaxScore() {
  var maxScore = localStorage.maxScore;
  if (maxScore == null) {
    return;
  }

  var maxScorePoints = maxScore == 1 ? '1 point' : maxScore + ' points';
  var maxScoreGrid = localStorage.maxScoreGrid;

  $('#max-score-points').textContent = maxScorePoints;
  $('#max-score-grid').textContent = maxScoreGrid;
  $('#max-score-container').classList.remove('hidden');

  $('#share').onclick = function (e) {
    e.preventDefault();
    shareScore(maxScorePoints, maxScoreGrid);
  };
}

function showMaxScore() {
  if ($('#max-score-container.expanded')) return;
  $('#max-score-container .expand-btn').click();
}

function shareScore(scorePoints, grid) {
  var message = '|' + grid + '| Got ' + scorePoints +
    ' playing this runner game on the browser URL!';
  var url = $('link[rel=canonical]').href;
  if (navigator.share) {
    navigator.share({text: message, url: url});
  } else {
    navigator.clipboard.writeText(message + '\n' + url)
      .then(function () { showShareNote('copied to clipboard') })
      .catch(function () { showShareNote('clipboard write failed') });
  }
}

function showShareNote(message) {
  var note = $('#share-note');
  note.textContent = message;
  note.classList.remove('invisible');
  setTimeout(function () { note.classList.add('invisible'); }, 1000);
}

function pickWhitespaceReplacementChar() {
  var candidates = [
    ['૟', 'strange symbols'],
    ['⟋', 'some weird slashes']
  ];

  var N = 5;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = '30px system-ui';
  var targetWidth = ctx.measureText(BRAILLE_SPACE.repeat(N)).width;

  for (var i = 0; i < candidates.length; i++) {
    var char = candidates[i][0];
    var str = char.repeat(N);
    var width = ctx.measureText(str).width;
    var similarWidth = Math.abs(targetWidth - width) / targetWidth <= 0.1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(str, 0, 30);
    var pixelData = ctx.getImageData(0, 0, width, 30).data;
    var totalPixels = pixelData.length / 4;
    var coloredPixels = 0;
    for (var j = 0; j < totalPixels; j++) {
      var alpha = pixelData[j * 4 + 3];
      if (alpha != 0) {
        coloredPixels++;
      }
    }
    var notTooDark = coloredPixels / totalPixels < 0.15;

    if (similarWidth && notTooDark) {
      return candidates[i];
    }
  }

  return ['░', 'some kind of "fog"'];
}

var $ = document.querySelector.bind(document);

main();
