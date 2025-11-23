// Configuration
let API_URL = localStorage.getItem('api_url') || '/api';
let CURRENT_GUILD_ID = localStorage.getItem('current_guild_id') || null;

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));

        item.classList.add('active');
        const page = item.dataset.page;
        document.getElementById(page).classList.add('active');
    });
});

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    toast.innerHTML = `
        <span style="font-size: 1.5rem;">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
    const apiUrlInput = document.getElementById('api-url-input');
    if (apiUrlInput) {
        apiUrlInput.value = API_URL === '/api' ? window.location.origin + '/api' : API_URL;
    }

    await fetchGuilds();
    refreshAllData();

    // Auto-refresh every 30 seconds
    setInterval(refreshAllData, 30000);
});

// Guild Selector
const guildSelector = document.getElementById('guild-selector');
if (guildSelector) {
    guildSelector.addEventListener('change', (e) => {
        CURRENT_GUILD_ID = e.target.value;
        localStorage.setItem('current_guild_id', CURRENT_GUILD_ID);
        refreshAllData();
    });
}

function refreshAllData() {
    fetchStats();
    fetchBrainrots();
    fetchGiveaways();
    showToast('Data refreshed!', 'success');
}

// API Functions
async function fetchGuilds() {
    try {
        const res = await fetch(`${API_URL}/guilds`);
        const guilds = await res.json();
        const selector = document.getElementById('guild-selector');
        selector.innerHTML = '<option value="">All Servers</option>';

        guilds.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = `${g.name} (${g.memberCount} members)`;
            if (g.id === CURRENT_GUILD_ID) option.selected = true;
            selector.appendChild(option);
        });
    } catch (e) {
        console.error('Error fetching guilds:', e);
        document.getElementById('guild-selector').innerHTML = '<option>Error loading servers</option>';
    }
}

async function fetchStats() {
    try {
        const url = CURRENT_GUILD_ID ? `${API_URL}/stats?guild_id=${CURRENT_GUILD_ID}` : `${API_URL}/stats`;
        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('stat-brainrots').textContent = data.brainrots_count || 0;
        document.getElementById('stat-giveaways').textContent = data.giveaways_count || 0;
    } catch (e) {
        console.error('Error fetching stats:', e);
    }

    try {
        const res = await fetch(`${API_URL}/crypto`);
        const data = await res.json();
        document.getElementById('stat-btc').textContent = `$${data.btc}`;
        document.getElementById('stat-eth').textContent = `$${data.eth}`;
    } catch (e) {
        console.error('Error fetching crypto:', e);
    }
}

async function fetchBrainrots() {
    try {
        const res = await fetch(`${API_URL}/brainrots`);
        const data = await res.json();
        const tbody = document.getElementById('brainrots-table');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No brainrots found</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            const traits = Array.isArray(item.traits) ? item.traits.join(', ') : item.traits || 'None';

            tr.innerHTML = `
                <td>${item.id}</td>
                <td><strong>${item.name}</strong></td>
                <td><span style="color: ${getRarityColor(item.rarity)}">${item.rarity}</span></td>
                <td>${item.mutation || 'Default'}</td>
                <td>${parseFloat(item.income_per_second).toFixed(2)}</td>
                <td>€${parseFloat(item.price_eur).toFixed(2)}</td>
                <td><strong>${item.quantity}</strong></td>
                <td>${item.owner_id || '-'}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick='editBrainrot(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
                        <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="deleteBrainrot(${item.id})">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error fetching brainrots:', e);
        showToast('Failed to fetch brainrots', 'error');
    }
}

async function fetchGiveaways() {
    try {
        const url = CURRENT_GUILD_ID ? `${API_URL}/giveaways?guild_id=${CURRENT_GUILD_ID}` : `${API_URL}/giveaways`;
        const res = await fetch(url);
        const data = await res.json();
        const tbody = document.getElementById('giveaways-table');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No giveaways found</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            const endsAt = new Date(item.end_time).toLocaleString();
            const isEnded = item.ended || new Date(item.end_time) < new Date();
            const status = isEnded
                ? '<span style="color: var(--danger)">✗ Ended</span>'
                : '<span style="color: var(--success)">✓ Active</span>';

            const participants = item.participants ? (Array.isArray(item.participants) ? item.participants.length : JSON.parse(item.participants || '[]').length) : 0;

            tr.innerHTML = `
                <td>${item.id}</td>
                <td><strong>${item.prize}</strong></td>
                <td>${item.winners_count}</td>
                <td>${participants}</td>
                <td>${endsAt}</td>
                <td>${status}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        ${!isEnded ? `<button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="endGiveaway(${item.id})">End</button>` : ''}
                        ${isEnded ? `<button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="rerollGiveaway(${item.id})">Reroll</button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error fetching giveaways:', e);
        showToast('Failed to fetch giveaways', 'error');
    }
}

async function deleteBrainrot(id) {
    if (!confirm('Are you sure you want to delete this brainrot?')) return;

    try {
        const res = await fetch(`${API_URL}/brainrots/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Brainrot deleted successfully!', 'success');
            fetchBrainrots();
            fetchStats();
        } else {
            throw new Error('Failed to delete');
        }
    } catch (e) {
        console.error(e);
        showToast('Error deleting brainrot', 'error');
    }
}

function editBrainrot(item) {
    document.getElementById('brainrot-id').value = item.id;
    document.getElementById('brainrot-name').value = item.name;
    document.getElementById('brainrot-rarity').value = item.rarity;
    document.getElementById('brainrot-mutation').value = item.mutation || 'Default';
    document.getElementById('brainrot-income').value = item.income_per_second;
    document.getElementById('brainrot-price').value = item.price_eur;
    document.getElementById('brainrot-traits').value = Array.isArray(item.traits) ? item.traits.join(', ') : (item.traits || '');
    document.getElementById('brainrot-quantity').value = item.quantity || 1;
    document.getElementById('brainrot-owner').value = item.owner_id || '';

    document.getElementById('brainrotModalTitle').textContent = 'Edit Brainrot';
    openModal('brainrotModal');
}

async function endGiveaway(id) {
    if (!confirm('Are you sure you want to end this giveaway?')) return;

    try {
        const res = await fetch(`${API_URL}/giveaways/${id}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            showToast('Giveaway ended successfully!', 'success');
            fetchGiveaways();
            fetchStats();
        } else {
            throw new Error('Failed to end giveaway');
        }
    } catch (e) {
        console.error(e);
        showToast('Error ending giveaway', 'error');
    }
}

async function rerollGiveaway(id) {
    if (!confirm('Are you sure you want to reroll this giveaway?')) return;

    try {
        const res = await fetch(`${API_URL}/giveaways/${id}/reroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            showToast('Giveaway rerolled successfully!', 'success');
            fetchGiveaways();
        } else {
            throw new Error('Failed to reroll giveaway');
        }
    } catch (e) {
        console.error(e);
        showToast('Error rerolling giveaway', 'error');
    }
}

// Form Handling
document.getElementById('addBrainrotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Process traits
    if (data.traits) {
        data.traits = data.traits.split(',').map(t => t.trim()).filter(t => t);
    } else {
        data.traits = [];
    }

    const id = data.id;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/brainrots/${id}` : `${API_URL}/brainrots`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal('brainrotModal');
            e.target.reset();
            document.getElementById('brainrot-id').value = '';
            document.getElementById('brainrotModalTitle').textContent = 'Add New Brainrot';
            showToast(id ? 'Brainrot updated!' : 'Brainrot added!', 'success');
            fetchBrainrots();
            fetchStats();
        } else {
            throw new Error('Failed to save brainrot');
        }
    } catch (e) {
        console.error(e);
        showToast('Error saving brainrot', 'error');
    }
});

document.getElementById('createGiveawayForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!CURRENT_GUILD_ID) {
        showToast('Please select a server first!', 'warning');
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.guild_id = CURRENT_GUILD_ID;

    try {
        const res = await fetch(`${API_URL}/giveaways`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal('giveawayModal');
            e.target.reset();
            showToast('Giveaway created!', 'success');
            fetchGiveaways();
            fetchStats();
        } else {
            throw new Error('Failed to create giveaway');
        }
    } catch (e) {
        console.error(e);
        showToast('Error creating giveaway', 'error');
    }
});

async function updateDefaultCrypto() {
    const crypto = document.getElementById('default-crypto-select').value;

    try {
        const res = await fetch(`${API_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'defaultCrypto', value: crypto })
        });

        if (res.ok) {
            showToast('Default crypto updated!', 'success');
        } else {
            throw new Error('Failed to update config');
        }
    } catch (e) {
        console.error(e);
        showToast('Error updating configuration', 'error');
    }
}

// Settings
function saveApiUrl() {
    const url = document.getElementById('api-url-input').value;
    const cleanUrl = url.endsWith('/api') ? url : url + '/api';
    localStorage.setItem('api_url', cleanUrl);
    API_URL = cleanUrl;
    showToast('API URL saved! Refreshing...', 'success');
    setTimeout(() => location.reload(), 1500);
}

// Utils
function getRarityColor(rarity) {
    const colors = {
        'Common': '#b2bec3',
        'Rare': '#0984e3',
        'Epic': '#a29bfe',
        'Legendary': '#fdcb6e',
        'Mythic': '#ff7675',
        'Brainrot God': '#e17055',
        'Secret': '#2d3436',
        'OG': '#ffeaa7'
    };
    return colors[rarity] || '#fff';
}

// Modal Functions
window.openModal = (id) => {
    if (id === 'brainrotModal' && !document.getElementById('brainrot-id').value) {
        document.getElementById('addBrainrotForm').reset();
        document.getElementById('brainrotModalTitle').textContent = 'Add New Brainrot';
    }
    document.getElementById(id).style.display = 'flex';
}

window.closeModal = (id) => {
    document.getElementById(id).style.display = 'none';
}

window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
}
