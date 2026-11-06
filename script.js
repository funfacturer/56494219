// --- 🔑 SUPABASE SETTINGS ---
const SUPABASE_URL = "https://ntoibzgbrxcyftokdknw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NED7gCPsrovyU-kMa1FzcQ_y1_68Q53";

let supabaseClient = null;
let currentUser = null;
let authMode = 'login'; 

if (SUPABASE_URL && SUPABASE_URL !== "DEINE_SUPABASE_PROJEKT_URL") {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.error("Supabase-Verbindungsfehler:", e);
    }
}

// DOM-Elemente
const authBox = document.getElementById('auth-box');
const gameArea = document.getElementById('game-area');
const loggedUserEmail = document.getElementById('logged-user-email');
const holes = document.querySelectorAll('.hole');
const moles = document.querySelectorAll('.mole');
const scoreBoard = document.querySelector('#score');
const totalSpawnsBoard = document.querySelector('#total-spawns');
const timeLeftBoard = document.querySelector('#time-left');
const leaderboardList = document.getElementById('leaderboard-list');
const startBtn = document.getElementById('start-btn');
const logoutBtn = document.getElementById('logout-btn');
const authSubmitBtn = document.getElementById('auth-submit-btn');

let lastHole;
let score = 0;
let timeLeft = 30;
let countdownTimer;
let isPlaying = false; 

let spawnTimings = []; 
let activeTimeouts = [];
const SPAWN_DURATION = 600; 

// --- TAB WECHSEL LOGIK ---
function switchTab(mode) {
    authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    authSubmitBtn.textContent = mode === 'login' ? 'Einloggen' : 'Registrieren';
}

document.getElementById('tab-login').addEventListener('click', () => switchTab('login'));
document.getElementById('tab-login').addEventListener('touchstart', (e) => {
    e.preventDefault();
    switchTab('login');
}, { passive: false });

document.getElementById('tab-register').addEventListener('click', () => switchTab('register'));
document.getElementById('tab-register').addEventListener('touchstart', (e) => {
    e.preventDefault();
    switchTab('register');
}, { passive: false });

authSubmitBtn.addEventListener('click', handleAuth);
authSubmitBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleAuth();
}, { passive: false });

logoutBtn.addEventListener('click', logout);

async function handleAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
        alert("Bitte fülle alle Felder aus.");
        return;
    }

    if (!supabaseClient) {
        alert("Datenbankverbindung ist nicht bereit.");
        return;
    }

    if (authMode === 'register') {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            alert("Registrierungsfehler: " + error.message);
        } else {
            alert("Registrierung erfolgreich! Du kannst dich jetzt einloggen.");
            switchTab('login');
        }
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            alert("Login fehlgeschlagen: " + error.message);
        }
    }
}

async function logout() {
    if (supabaseClient) {
        // Bei Logout löschen wir auch den lokalen Spielernamen für maximale Privatsphäre
        localStorage.removeItem('mole_player_name');
        await supabaseClient.auth.signOut();
    }
}

// Beobachtung des Auth-Status
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            currentUser = session.user;
            
            // Wenn bereits ein Spielername gespeichert ist, zeigen wir diesen an, sonst die E-Mail
            const savedName = localStorage.getItem('mole_player_name');
            loggedUserEmail.textContent = savedName ? savedName : currentUser.email;
            
            authBox.classList.add('hidden');
            gameArea.classList.remove('hidden');
            fetchLeaderboard();
        } else {
            currentUser = null;
            authBox.classList.remove('hidden');
            gameArea.classList.add('hidden');
        }
    });
}

// --- SPIELLOGIK ---
function requestFullscreen() {
    const docElm = document.documentElement;
    if (docElm.requestFullscreen) {
        docElm.requestFullscreen();
    } else if (docElm.webkitRequestFullscreen) {
        docElm.webkitRequestFullscreen();
    }
}

async function fetchLeaderboard() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('mole_scores')
            .select('name, score, accuracy')
            .order('score', { ascending: false })
            .limit(3);

        if (error) throw error;

        leaderboardList.innerHTML = "";
        if (data.length === 0) {
            leaderboardList.innerHTML = `<li style="opacity: 0.5;">Noch keine Einträge vorhanden. Werde der Erste!</li>`;
        } else {
            data.forEach((entry, index) => {
                const li = document.createElement('li');
                li.className = `leaderboard-item ${index === 0 ? 'first' : ''}`;
                let crown = index === 0 ? "🥇 " : index === 1 ? "🥈 " : "🥉 ";
                li.innerHTML = `<span>${crown}${entry.name}</span> <span>${entry.score} Pkt. (${entry.accuracy}%)</span>`;
                leaderboardList.appendChild(li);
            });
        }
    } catch (err) {
        console.error("Fehler beim Laden des Leaderboards:", err);
    }
}

async function submitScore(name, finalScore, finalAccuracy) {
    if (!supabaseClient || !currentUser) return;
    try {
        const { error } = await supabaseClient
            .from('mole_scores')
            .insert([{ name: name, score: finalScore, accuracy: finalAccuracy }]);

        if (error) throw error;
        fetchLeaderboard();
    } catch (err) {
        console.error("Fehler beim Speichern des Highscores:", err);
    }
}

function generatePrecalculatedSession() {
    spawnTimings = [];
    let simulatedTime = 0;
    const gameDurationLimit = 30000;

    while (simulatedTime < gameDurationLimit) {
        spawnTimings.push({
            startTime: simulatedTime,
            duration: SPAWN_DURATION
        });
        simulatedTime += SPAWN_DURATION;
    }
    totalSpawnsBoard.textContent = spawnTimings.length;
}

function randomHole(holes) {
    const idx = Math.floor(Math.random() * holes.length);
    const hole = holes[idx];
    if (hole === lastHole) {
        return randomHole(holes);
    }
    lastHole = hole;
    return hole;
}

function runPrecalculatedSession() {
    spawnTimings.forEach(spawn => {
        const spawnTimeout = setTimeout(() => {
            const hole = randomHole(holes);
            const mole = hole.querySelector('.mole');
            
            mole.classList.add('up');

            const hideTimeout = setTimeout(() => {
                mole.classList.remove('up');
            }, spawn.duration);

            activeTimeouts.push(hideTimeout);
        }, spawn.startTime);

        activeTimeouts.push(spawnTimeout);
    });
}

startBtn.addEventListener('click', startGame);

function startGame() {
    if (isPlaying) return; 
    isPlaying = true;

    requestFullscreen();
    
    score = 0;
    timeLeft = 30;
    scoreBoard.textContent = score;
    timeLeftBoard.textContent = timeLeft;
    moles.forEach(mole => mole.classList.remove('up'));

    runPrecalculatedSession();
    
    countdownTimer = setInterval(() => {
        timeLeft--;
        timeLeftBoard.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            endGame();
        }
    }, 1000);
}

async function endGame() {
    isPlaying = false;
    activeTimeouts.forEach(clearTimeout);
    activeTimeouts = [];
    moles.forEach(mole => mole.classList.remove('up'));

    const totalPossible = spawnTimings.length;
    const hitRate = totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0;
    
    alert(
        `⏱️ Zeit abgelaufen!\n\n` +
        `🔨 Getroffen: ${score} von ${totalPossible} möglichen Maulwürfen\n` +
        `🎯 Deine Trefferquote: ${hitRate}%`
    );

    // --- 💾 AUTOMATISIERTE NAMENS-SPEICHERUNG ---
    let spielerName = localStorage.getItem('mole_player_name');

    // Falls noch kein Name gespeichert ist, fragen wir einmalig nach
    if (!spielerName) {
        const inputName = prompt("Trage einen Anzeigenamen für die Bestenliste ein:");
        if (inputName && inputName.trim() !== "") {
            spielerName = inputName.trim();
            localStorage.setItem('mole_player_name', spielerName);
            // Ändert die Statusanzeige oben direkt auf den Spielernamen
            loggedUserEmail.textContent = spielerName;
        }
    }

    // Wenn wir einen Namen haben (entweder neu eingegeben oder geladen), laden wir ihn hoch
    if (spielerName) {
        await submitScore(spielerName, score, hitRate);
    }

    generatePrecalculatedSession();
    score = 0;
    scoreBoard.textContent = score;
}

function bonk(e) {
    if(!e.isTrusted) return; 
    if (!isPlaying) return; 
    
    score++;
    this.classList.remove('up');
    scoreBoard.textContent = score;
}

moles.forEach(mole => {
    mole.addEventListener('click', bonk);
    mole.addEventListener('touchstart', function(e) {
        e.preventDefault(); 
        bonk.call(this, e);
    }, { passive: false });
});

if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('fs-prompt').style.display = 'none';
}

function adjustAppHeight() {
    const doc = document.documentElement;
    doc.style.setProperty('--app-height', `${window.innerHeight}px`);
}

adjustAppHeight();
window.addEventListener('resize', adjustAppHeight);
window.addEventListener('orientationchange', adjustAppHeight);

generatePrecalculatedSession();
