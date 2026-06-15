const API = 'https://ip-reputation-api.yusufziyakavuk11.workers.dev';

const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const ipv6Regex = /^[a-fA-F0-9:]+$/;

function countryFlag(code) {
    return code
        ? code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
        : '';
}

function scoreColor(score) {
    return score > 50 ? '#cc0000' : score > 10 ? '#cc7700' : '#007700';
}

function scoreBg(score) {
    return score > 50 ? '#fff0f0' : score > 10 ? '#fffaf0' : '#f0fff4';
}

function riskLabel(score) {
    if (score === null || score === undefined) return { label: '?', color: '#aaa' };
    if (score > 50) return { label: 'high', color: '#cc0000' };
    if (score > 10) return { label: 'medium', color: '#cc7700' };
    return { label: 'low', color: '#007700' };
}

let popularData = [];
let popularFilter = 'all';
let popularSort = 'count';

function renderPopular() {
    const content = document.querySelector('#colRight .col-content');

    let filtered = popularData.filter(({ score }) => {
        if (popularFilter === 'all') return true;
        if (popularFilter === 'high') return score !== null && score > 50;
        if (popularFilter === 'medium') return score !== null && score > 10 && score <= 50;
        if (popularFilter === 'low') return score !== null && score <= 10;
        return true;
    });

    if (popularSort === 'count') {
        filtered.sort((a, b) => b.count - a.count);
    } else if (popularSort === 'score-desc') {
        filtered.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else if (popularSort === 'score-asc') {
        filtered.sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
    }

    if (filtered.length === 0) {
        content.innerHTML = '<div style="color: #aaa; font-size: 0.85rem; font-family: monospace;">no results</div>';
        return;
    }

    content.innerHTML = filtered.map(({ ip, count, score }) => {
        const risk = riskLabel(score);
        const scoreDisplay = score !== null && score !== undefined ? `<span style="color:${risk.color}; font-weight:bold;">${score}%</span>` : '<span style="color:#aaa;">?%</span>';
        return `<div onclick="checkIP('${ip}')" style="padding: 6px 4px; border-bottom: 1px solid #ffccaa; font-family: monospace; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#fff5ee'" onmouseout="this.style.background='transparent'">
            <span>${ip}</span>
            <span style="display:flex; gap:6px; align-items:center;">
                ${scoreDisplay}
                <span style="color:#880000; font-weight:bold; font-size:0.75rem;">${count}x</span>
            </span>
        </div>`;
    }).join('');
}

async function loadLists() {
    const [recent, popular] = await Promise.all([
        fetch(`${API}/recent`).then(r => r.json()),
        fetch(`${API}/popular`).then(r => r.json())
    ]);

    document.querySelector('#colLeft .col-content').innerHTML =
        recent.length === 0
            ? '<div style="color: #aaa; font-size: 0.85rem; font-family: monospace;">no searches yet</div>'
            : recent.map(ip => `<div onclick="checkIP('${ip}')" style="padding: 6px 4px; border-bottom: 1px solid #ffccaa; font-family: monospace; font-size: 0.85rem; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#fff5ee'" onmouseout="this.style.background='transparent'">${ip}</div>`).join('');

    popularData = popular;
    renderPopular();
}

async function loadComments(ip) {
    const res = await fetch(`${API}/comments?ip=${ip}`);
    const comments = await res.json();

    const area = document.getElementById('result-area');
    const existing = document.getElementById('comment-section');
    if (existing) existing.remove();

    const section = document.createElement('div');
    section.id = 'comment-section';
    section.style = 'margin-top: 24px; font-family: monospace;';
    section.innerHTML = `
        <div style="font-weight: bold; color: #880000; border-bottom: 1px solid #ffccaa; padding-bottom: 6px; margin-bottom: 12px;">Comments</div>
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <input id="comment-username" placeholder="username" maxlength="32" style="width: 30%; min-width: 80px; padding: 8px; border: 1px solid #880000; outline: none; font-family: monospace;">
            <input id="comment-text" placeholder="comment" maxlength="500" style="flex: 1; min-width: 120px; padding: 8px; border: 1px solid #880000; outline: none; font-family: monospace;">
            <button onclick="submitComment('${ip}')" style="padding: 8px 16px; background: #880000; color: white; border: none; cursor: pointer; font-family: monospace; font-weight: bold;">POST</button>
        </div>
        <div id="comment-list">
            ${comments.length === 0
                ? '<div style="color: #aaa; font-size: 0.85rem;">no comments yet</div>'
                : comments.map(c => `
                    <div style="padding: 8px 0; border-bottom: 1px solid #ffccaa22;">
                        <span style="color: #880000; font-weight: bold;">${c.username}</span>
                        <span style="color: #aaa; font-size: 0.8rem; margin-left: 8px;">${new Date(c.date).toLocaleString()}</span>
                        <div style="margin-top: 4px;">${c.comment}</div>
                    </div>`).join('')
            }
        </div>
    `;
    area.appendChild(section);
}

async function submitComment(ip) {
    const username = document.getElementById('comment-username').value.trim();
    const comment = document.getElementById('comment-text').value.trim();
    if (!username || !comment) return;

    await fetch(`${API}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, username, comment })
    });

    document.getElementById('comment-text').value = '';
    loadComments(ip);
}

async function checkIP(ip) {
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        document.getElementById('result-area').innerHTML =
            '<div style="font-family: monospace; color: #cc0000; padding: 10px;">invalid IP address</div>';
        return;
    }

    document.getElementById('ip-search').value = ip;
    const result = document.getElementById('result-area');
    result.innerHTML = '<div style="font-family: monospace; color: #880000; padding: 10px;">checking...</div>';

    try {
        const res = await fetch(`${API}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
        const data = await res.json();

        if (!data.data) {
            result.innerHTML = `<div style="font-family: monospace; color: #cc0000; padding: 10px;">error: ${data.errors?.[0]?.detail || 'something went wrong'}</div>`;
            return;
        }

        const d = data.data;
        const score = d.abuseConfidenceScore;
        const sc = scoreColor(score);
        const sb = scoreBg(score);

        result.innerHTML = `
            <div style="font-family: monospace;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding: 12px 16px; background: ${sb}; border: 1px solid ${sc}; border-radius: 4px;">
                    <div>
                        <div style="font-size: 1.6rem; font-weight: bold; color: #880000;">${d.ipAddress}</div>
                        <div style="font-size: 0.95rem; color: #888; margin-top: 4px;">${d.isp} · ${countryFlag(d.countryCode)} ${d.countryCode}</div>
                    </div>
                    <div style="font-size: 2.4rem; font-weight: bold; color: ${sc};">${score}%</div>
                </div>

                <div style="width: 100%; background: #f0f0f0; border-radius: 4px; height: 10px; margin-bottom: 20px; overflow: hidden;">
                    <div style="width: ${score}%; height: 100%; background: ${sc}; border-radius: 4px; transition: width 0.5s;"></div>
                </div>

                <table style="width:100%; border-collapse: collapse; font-size: 1rem;">
                    <tr style="background: #ffccaa22;">
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa; color: #880000; font-weight: bold; width: 35%;">Country</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa;">${countryFlag(d.countryCode)} ${d.countryCode}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa; color: #880000; font-weight: bold;">ISP</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa;">${d.isp}</td>
                    </tr>
                    <tr style="background: #ffccaa22;">
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa; color: #880000; font-weight: bold;">Domain</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa;">${d.domain || '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa; color: #880000; font-weight: bold;">Total Reports</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa;">${d.totalReports}</td>
                    </tr>
                    <tr style="background: #ffccaa22;">
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa; color: #880000; font-weight: bold;">Last Reported</td>
                        <td style="padding: 10px 12px; border-bottom: 1px solid #ffccaa;">${d.lastReportedAt ? new Date(d.lastReportedAt).toLocaleString() : '-'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 12px; color: #880000; font-weight: bold;">VPN / Proxy / Tor</td>
                        <td style="padding: 10px 12px;">${[d.isVpn && 'VPN', d.isProxy && 'Proxy', d.isTor && 'Tor'].filter(Boolean).join(', ') || '-'}</td>
                    </tr>
                </table>
            </div>
        `;

        loadComments(ip);
        loadLists();

    } catch (e) {
        result.innerHTML = '<div style="font-family: monospace; color: #cc0000; padding: 10px;">network error, please try again</div>';
    }
}

document.getElementById('search-btn').addEventListener('click', () => {
    const ip = document.getElementById('ip-search').value.trim();
    if (!ip) return;
    checkIP(ip);
});

document.getElementById('ip-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const ip = e.target.value.trim();
        if (!ip) return;
        checkIP(ip);
    }
});

document.getElementById('popular-filter').addEventListener('change', (e) => {
    popularFilter = e.target.value;
    renderPopular();
});

document.getElementById('popular-sort').addEventListener('change', (e) => {
    popularSort = e.target.value;
    renderPopular();
});

fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { document.getElementById('ip-search').placeholder = d.ip; })
    .catch(() => { document.getElementById('ip-search').placeholder = 'enter an IP address'; });

loadLists();
