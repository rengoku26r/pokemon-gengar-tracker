let allEpisodes = [];

let groupedData = {
    seasons: {},
    movies: {},
    others: {}
};

let currentCategory = 'seasons';
let currentSeries = null;

let watchedEpisodes = {};
let savedLinks = {};

let authToken = localStorage.getItem('token') || null;
let currentUser = null;

const seriesList = document.getElementById('series-list');
const episodeList = document.getElementById('episode-list');
const sectionTitle = document.getElementById('section-title');
const episodeCount = document.getElementById('episode-count');
const progressText = document.getElementById('progress-text');
const progressBarFill = document.getElementById('progress-bar-fill');
const authBtn = document.getElementById('auth-btn');
const searchInput = document.getElementById('search-input');
const seriesActions = document.getElementById('series-actions');
const navRight = document.querySelector('.nav-right');

const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');

const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');

async function init() {
    bindEvents();

    await loadEpisodes();

    if (authToken) {
        await fetchUser();
        await fetchProgress();
        await fetchLinks();
    }

    updateProgressUI();
}

function bindEvents() {

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {

            document.querySelectorAll('.tab-btn')
                .forEach(b => b.classList.remove('active'));

            btn.classList.add('active');

            currentCategory = btn.dataset.tab;

            currentSeries = null;

            renderSidebar();
        });
    });

    authBtn.addEventListener('click', () => {

        if (!currentUser) {
            openModal();
        }
    });

    modalClose.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    tabLogin.addEventListener('click', () => {
        switchAuthTab('login');
    });

    tabSignup.addEventListener('click', () => {
        switchAuthTab('signup');
    });

    document.getElementById('btn-login')
        .addEventListener('click', login);

    document.getElementById('btn-signup')
        .addEventListener('click', signup);

    searchInput.addEventListener('input', handleSearch);
}

async function loadEpisodes() {

    try {

        const response = await fetch('pokemon_all_episodes_complete.csv');

        const csvText = await response.text();

        allEpisodes = parseCSV(csvText);

        categorizeEpisodes();

        renderSidebar();

    } catch (error) {

        console.error(error);

        episodeList.innerHTML = `
            <div class="loading-state">
                Failed to load episodes CSV.
            </div>
        `;
    }
}

function parseCSV(csvText) {

    const lines = csvText.trim().split('\n');

    const headers = lines[0]
        .split(',')
        .map(h => h.trim());

    const episodes = [];

    for (let i = 1; i < lines.length; i++) {

        if (!lines[i].trim()) continue;

        const values = [];
        let current = '';
        let insideQuotes = false;

        for (let char of lines[i]) {

            if (char === '"') {
                insideQuotes = !insideQuotes;
                continue;
            }

            if (char === ',' && !insideQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current.trim());

        if (!values) continue;

        const obj = {};

        headers.forEach((header, index) => {

            let value = values[index] || '';

            value = value.replace(/^"|"$/g, '');

            obj[header] = value.trim();
        });

        episodes.push(obj);
    }

    return episodes;
}

function categorizeEpisodes() {

    groupedData = {
        seasons: {},
        movies: {},
        others: {}
    };

    const seasonMap = {

        // SEASONS

        "Season 1": "Season 1 : Indigo League",
        "Season 2": "Season 2 : Adventures on the Orange Islands",
        "Season 3": "Season 3 : The Johto Journeys",
        "Season 4": "Season 4 : Johto League Champions",
        "Season 5": "Season 5 : Master Quest",
        "Season 6": "Season 6 : Advanced",
        "Season 7": "Season 7 : Advanced Challenge",
        "Season 8": "Season 8 : Advanced Battle",
        "Season 9": "Season 9 : Battle Frontier",

        "Season 10": "Season 10 : Diamond and Pearl",
        "Season 11": "Season 11 : Diamond and Pearl - Battle Dimension",
        "Season 12": "Season 12 : Diamond and Pearl - Galactic Battles",
        "Season 13": "Season 13 : Diamond and Pearl - Sinnoh League Victors",

        "Season 14": "Season 14 : Black & White",
        "Season 15": "Season 15 : Black & White - Rival Destinies",
        "Season 16": "Season 16 : Black & White - Adventures in Unova",

        "Season 17": "Season 17 : XY",
        "Season 18": "Season 18 : XY - Kalos Quest",
        "Season 19": "Season 19 : XYZ",

        "Season 20": "Season 20 : Sun & Moon",
        "Season 21": "Season 21 : Sun & Moon - Ultra Adventures",
        "Season 22": "Season 22 : Sun & Moon - Ultra Legends",

        "Season 23": "Season 23 : Journeys",
        "Season 24": "Season 24 : Master Journeys",
        "Season 25": "Season 25 : Ultimate Journeys",

        "Season 26": "Season 26 : Pokémon Horizons",
        "Season 27": "Season 27 : The Search for Laqua",
        "Season 28": "Season 28 : Rising Hope"
    };

    allEpisodes.forEach(ep => {

        const rawSeries = (ep.Series || '').trim();

        const lower = rawSeries.toLowerCase();

        const code = ep.Code || '';

        const name = ep.Name || '';



        // =========================
        // MOVIES TAB
        // =========================

        if (
            lower.includes('movie') ||
            lower.includes('film')
        ) {

            // M22 ONLY -> 3D MOVIE

            if (
                code === 'M22' ||
                name.includes('Mewtwo Strikes Back - Evolution')
            ) {

                if (!groupedData.movies["3D Animated Movie"]) {
                    groupedData.movies["3D Animated Movie"] = [];
                }

                groupedData.movies["3D Animated Movie"].push(ep);
            }

            // DETECTIVE PIKACHU

            else if (
                lower.includes('detective pikachu') ||
                name.toLowerCase().includes('detective pikachu')
            ) {

                if (!groupedData.movies["Live Action Movie"]) {
                    groupedData.movies["Live Action Movie"] = [];
                }

                groupedData.movies["Live Action Movie"].push(ep);
            }

            // ALL OTHER MOVIES

            else {

                if (!groupedData.movies["Classic Anime Movies"]) {
                    groupedData.movies["Classic Anime Movies"] = [];
                }

                groupedData.movies["Classic Anime Movies"].push(ep);
            }

            return;
        }



        // =========================
        // SEASONS TAB
        // =========================

        let matchedSeason = false;

        Object.keys(seasonMap).forEach(seasonKey => {

            const regex = new RegExp(`^${seasonKey}(\\D|$)`);

            if (regex.test(rawSeries)) {

                const properName = seasonMap[seasonKey];

                if (!groupedData.seasons[properName]) {
                    groupedData.seasons[properName] = [];
                }

                groupedData.seasons[properName].push(ep);

                matchedSeason = true;
            }
        });

        if (matchedSeason) return;



        if (!groupedData.others[rawSeries]) {
            groupedData.others[rawSeries] = [];
        }

        groupedData.others[rawSeries].push(ep);

    });
}

function renderSidebar() {

    seriesList.innerHTML = '';

    const data = groupedData[currentCategory];

    const keys = Object.keys(data);

    if (!keys.length) {

        seriesList.innerHTML = `
            <div class="loading-state">
                No entries found.
            </div>
        `;

        return;
    }

    keys.forEach(series => {

        const episodes = data[series];

        const watchedCount = episodes.filter(ep =>
            watchedEpisodes[ep.Code]
        ).length;

        const percent = episodes.length
            ? (watchedCount / episodes.length) * 100
            : 0;

        const item = document.createElement('div');

        item.className = 'series-item';

        if (series === currentSeries) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <div class="series-item-name">
                ${series}
            </div>

            <div class="series-progress-wrap">

                <span class="series-count">
                    ${watchedCount}/${episodes.length}
                </span>

                <div class="series-mini-bar">
                    <div 
                        class="series-mini-fill"
                        style="width:${percent}%"
                    ></div>
                </div>

            </div>
        `;

        item.addEventListener('click', () => {

            currentSeries = series;

            renderSidebar();

            renderEpisodes(episodes);
        });

        seriesList.appendChild(item);
    });

    // AUTO LOAD FIRST SERIES

    if (!currentSeries && keys.length) {

        currentSeries = keys[0];

        renderSidebar();

        renderEpisodes(data[currentSeries]);
    }
}

function renderEpisodes(episodes) {

    if (!episodes) return;

    episodeList.innerHTML = '';

    if (!searchInput.value.trim()) {
        sectionTitle.textContent = currentSeries || 'Episodes';
    }

    episodeCount.textContent = `${episodes.length} Episodes`;

    seriesActions.innerHTML = '';

    // MARK ALL WATCHED

    if (currentUser && episodes.length) {

        const markBtn = document.createElement('button');

        markBtn.className = 'btn-mark-all';

        markBtn.textContent = 'Mark All Watched';
        const unmarkBtn = document.createElement('button');

        unmarkBtn.className = 'btn-mark-all';

        unmarkBtn.textContent = 'Unmark All';

        unmarkBtn.addEventListener('click', async () => {

            const updates = episodes.map(ep => ({
                code: ep.Code,
                watched: false
            }));

            await batchUpdateProgress(updates);

            updates.forEach(update => {
                delete watchedEpisodes[update.code];
            });

            renderEpisodes(episodes);

            renderSidebar();

            updateProgressUI();
        });

        markBtn.addEventListener('click', async () => {

            const updates = episodes.map(ep => ({
                code: ep.Code,
                watched: true
            }));

            await batchUpdateProgress(updates);

            updates.forEach(update => {
                watchedEpisodes[update.code] = true;
            });

            renderEpisodes(episodes);

            renderSidebar();

            updateProgressUI();
        });

        seriesActions.appendChild(markBtn);
        seriesActions.appendChild(unmarkBtn);
    }

    episodes.forEach(ep => {

        const code = ep.Code || `EP-${Math.random()}`;

        const watched = !!watchedEpisodes[code];

        const card = document.createElement('div');

        card.className = `
            episode-item
            ${watched ? 'watched' : ''}
        `;

        card.innerHTML = `
            <span class="episode-code">
                ${code}
            </span>

            <div class="episode-body">

                <div class="episode-name">
                    ${ep.Name || 'Unknown Episode'}
                </div>

                ${savedLinks[code] ? `
                    <a 
                        href="${savedLinks[code]}"
                        target="_blank"
                        class="watch-link"
                    >
                        Watch Again
                    </a>
                ` : ''}

                ${ep.Note ? `
                    <div class="episode-note">
                        ${ep.Note}
                    </div>
                ` : ''}

            </div>

            ${currentUser ? `
                <button class="watch-btn ${watched ? 'active' : ''}">
                    <svg 
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                    >
                        <path d="M20 6 9 17l-5-5"/>
                    </svg>
                </button>
                <button class="save-link-btn">
                    🔗
                </button>
            ` : `<div class="watch-btn-hidden"></div>`}
        `;

        // WATCH BUTTON

        if (currentUser) {

            const btn = card.querySelector('.watch-btn');

            btn.addEventListener('click', async () => {

                const newValue = !watchedEpisodes[code];

                await updateProgress(code, newValue);

                if (newValue) {
                    watchedEpisodes[code] = true;
                } else {
                    delete watchedEpisodes[code];
                }

                renderEpisodes(episodes);

                renderSidebar();

                updateProgressUI();
            });
        }

        if (currentUser) {

            const linkBtn = card.querySelector('.save-link-btn');

            linkBtn.addEventListener('click', async () => {

                const currentLink = savedLinks[code] || '';

                const url = prompt(
                    'Enter watch link:',
                    currentLink
                );

                if (url === null) return;

                await saveLink(code, url);

                if (url.trim()) {
                    savedLinks[code] = url.trim();
                } else {
                    delete savedLinks[code];
                }

                renderEpisodes(episodes);
            });
        }

        episodeList.appendChild(card);
    });
}

function handleSearch() {

    const value = searchInput.value
        .toLowerCase()
        .trim();

    if (!value) {

        if (currentSeries) {

            renderEpisodes(
                groupedData[currentCategory][currentSeries]
            );
        }

        return;
    }

    const results = allEpisodes.filter(ep => {

        return (
            ep.Name?.toLowerCase().includes(value) ||
            ep.Code?.toLowerCase().includes(value) ||
            ep.Series?.toLowerCase().includes(value)
        );
    });

    sectionTitle.textContent = 'Search Results';

    episodeCount.textContent = `${results.length} Matches`;

    renderEpisodes(results);
}

function updateProgressUI() {

    const total = allEpisodes.length;

    const watched = Object.keys(watchedEpisodes).length;

    const percent = total
        ? Math.round((watched / total) * 100)
        : 0;

    progressText.textContent =
        `${watched} / ${total} Watched(${percent} %)`;

    progressBarFill.style.width = `${percent} % `;
}

function switchAuthTab(tab) {

    if (tab === 'login') {

        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');

        formLogin.classList.remove('hidden');
        formSignup.classList.add('hidden');

    } else {

        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');

        formSignup.classList.remove('hidden');
        formLogin.classList.add('hidden');
    }
}

function openModal() {
    modalOverlay.classList.add('visible');
}

function closeModal() {
    modalOverlay.classList.remove('visible');
}

async function signup() {

    const username = document
        .getElementById('signup-username')
        .value
        .trim();

    const email = document
        .getElementById('signup-email')
        .value
        .trim();

    const password = document
        .getElementById('signup-password')
        .value
        .trim();

    const error = document.getElementById('signup-error');

    error.textContent = '';

    try {

        const res = await fetch('/api/auth/register', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {

            error.textContent = data.error;

            return;
        }

        authToken = data.token;

        localStorage.setItem('token', authToken);

        currentUser = data;

        updateAuthUI();

        closeModal();

    } catch (err) {

        error.textContent = 'Signup failed';
    }
}

async function login() {

    const email = document
        .getElementById('login-email')
        .value
        .trim();

    const password = document
        .getElementById('login-password')
        .value
        .trim();

    const error = document.getElementById('login-error');

    error.textContent = '';

    try {

        const res = await fetch('/api/auth/login', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {

            error.textContent = data.error;

            return;
        }

        authToken = data.token;

        localStorage.setItem('token', authToken);

        currentUser = data;

        await fetchProgress();

        updateAuthUI();

        renderSidebar();

        if (currentSeries) {

            renderEpisodes(
                groupedData[currentCategory][currentSeries]
            );
        }

        closeModal();

    } catch (err) {

        error.textContent = 'Login failed';
    }
}

async function logout() {

    try {

        await fetch('/api/auth/logout', {

            method: 'POST',

            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

    } catch { }

    authToken = null;

    currentUser = null;

    watchedEpisodes = {};

    localStorage.removeItem('token');

    updateAuthUI();

    renderSidebar();

    if (currentSeries) {

        renderEpisodes(
            groupedData[currentCategory][currentSeries]
        );
    }

    updateProgressUI();
}

async function fetchUser() {

    try {

        const res = await fetch('/api/user', {

            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        if (!res.ok) {
            throw new Error();
        }

        currentUser = await res.json();

        updateAuthUI();

    } catch {

        localStorage.removeItem('token');

        authToken = null;
    }
}

async function fetchProgress() {

    try {

        const res = await fetch('/api/progress', {

            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        if (!res.ok) return;

        const data = await res.json();

        watchedEpisodes = data.progress || {};

        updateProgressUI();

    } catch { }
}

async function updateProgress(code, watched) {

    if (!authToken) return;

    await fetch('/api/progress', {

        method: 'PUT',

        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
        },

        body: JSON.stringify({
            episodeCode: code,
            watched
        })
    });
}

async function batchUpdateProgress(updates) {

    if (!authToken) return;

    await fetch('/api/progress/batch', {

        method: 'PUT',

        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
        },

        body: JSON.stringify({ updates })
    });
}

async function fetchLinks() {

    try {

        const res = await fetch('/api/links', {

            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        if (!res.ok) return;

        const data = await res.json();

        savedLinks = data.links || {};

    } catch { }
}


async function saveLink(code, url) {

    await fetch('/api/links', {

        method: 'PUT',

        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
        },

        body: JSON.stringify({
            code,
            url
        })
    });
}

function updateAuthUI() {

    const existingLogout = document.getElementById('logout-btn');

    if (existingLogout) {
        existingLogout.remove();
    }

    if (currentUser) {

        authBtn.textContent = currentUser.username;

        authBtn.classList.add('logged-in');

        const logoutBtn = document.createElement('button');

        logoutBtn.id = 'logout-btn';

        logoutBtn.className = 'btn-auth';

        logoutBtn.textContent = 'Logout';

        logoutBtn.addEventListener('click', logout);

        navRight.appendChild(logoutBtn);

    } else {

        authBtn.textContent = 'Login';

        authBtn.classList.remove('logged-in');
    }
}

init();