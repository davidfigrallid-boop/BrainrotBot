// Configuration
let API_URL = localStorage.getItem('api_url') || 'http://localhost:3000/api';
let CURRENT_GUILD_ID = localStorage.getItem('current_guild_id') || null;
// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        if (tabId) {
            document.getElementById(tabId).classList.add('active');
        }
    });
});

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('api-url-input').value = API_URL;
    await fetchGuilds();
    refreshData();
});

// Guild Selector
document.getElementById('guild-selector').addEventListener('change', (e) => {
    CURRENT_GUILD_ID = e.target.value;
    localStorage.setItem('current_guild_id', CURRENT_GUILD_ID);
    refreshData();
});

function refreshData() {
    fetchStats();
    fetchBrainrots();
    fetchGiveaways();
}

// API Functions
async function fetchGuilds() {
    try {
        const res = await fetch(`${API_URL}/guilds`);
        const guilds = await res.json();
        const selector = document.getElementById('guild-selector');
        selector.innerHTML = '<option value="">Select Server</option>';

        guilds.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.name;
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

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td><span style="color: ${getRarityColor(item.rarity)}">${item.rarity}</span></td>
                <td>${item.mutation}</td>
                <td>${item.income_per_second}</td>
                <td>${item.price_eur}€</td>
                <td>${item.quantity}</td>
                <td>${item.owner_id || '-'}</td>
                <td>
                    <button class="btn-secondary" onclick='editBrainrot(${JSON.stringify(item)})'>Edit</button>
                    <button class="btn-danger" onclick="deleteBrainrot(${item.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error fetching brainrots:', e);
    }
}

async function fetchGiveaways() {
    try {
        const url = CURRENT_GUILD_ID ? `${API_URL}/giveaways?guild_id=${CURRENT_GUILD_ID}` : `${API_URL}/giveaways`;
        const res = await fetch(url);
        const data = await res.json();
        const tbody = document.getElementById('giveaways-table');
        tbody.innerHTML = '';

        data.forEach(item => {
            const tr = document.createElement('tr');
            const endsAt = new Date(item.end_time).toLocaleString();
            const isEnded = new Date(item.end_time) < new Date();
            const status = isEnded ? '<span style="color: var(--danger)">Ended</span>' : '<span style="color: var(--success)">Active</span>';

            tr.innerHTML = `
                <td>${item.prize}</td>
                <td>${item.winners_count}</td>
                <td>${endsAt}</td>
                <td>${item.rigged_winner_id || '-'}</td>
                <td>${status}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error fetching giveaways:', e);
    }
}

async function deleteBrainrot(id) {
    if (!confirm('Are you sure?')) return;
    try {
        await fetch(`${API_URL}/brainrots/${id}`, { method: 'DELETE' });
        fetchBrainrots();
        fetchStats();
    } catch (e) {
        alert('Error deleting brainrot');
    }
}

function editBrainrot(item) {
    document.getElementById('brainrot-id').value = item.id;
    document.getElementById('brainrot-name').value = item.name;
    document.getElementById('brainrot-rarity').value = item.rarity;
    document.getElementById('brainrot-mutation').value = item.mutation;
    document.getElementById('brainrot-income').value = item.income_per_second;
    document.getElementById('brainrot-price').value = item.price_eur;
    document.getElementById('brainrot-traits').value = Array.isArray(item.traits) ? item.traits.join(', ') : item.traits;
    document.getElementById('brainrot-quantity').value = item.quantity;
    document.getElementById('brainrot-owner').value = item.owner_id || '';

    document.getElementById('brainrotModalTitle').textContent = 'Edit Brainrot';
    openModal('brainrotModal');
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
        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        closeModal('brainrotModal');
        e.target.reset();
        document.getElementById('brainrot-id').value = ''; // Reset ID
        document.getElementById('brainrotModalTitle').textContent = 'Add New Brainrot';
        fetchBrainrots();
        fetchStats();
    } catch (e) {
        alert('Error saving brainrot');
    }
});

document.getElementById('createGiveawayForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!CURRENT_GUILD_ID) {
        alert('Please select a server first!');
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.guild_id = CURRENT_GUILD_ID;

    try {
        await fetch(`${API_URL}/giveaways`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        closeModal('giveawayModal');
        e.target.reset();
        alert('Giveaway created!');
        fetchStats();
    } catch (e) {
        alert('Error creating giveaway');
    }
});

async function updateDefaultCrypto() {
    const crypto = document.getElementById('default-crypto-select').value;
    try {
        await fetch(`${API_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'defaultCrypto', value: crypto })
        });
        alert('Default crypto updated!');
    } catch (e) {
        console.error(e);
    }
}

// Settings
function saveApiUrl() {
    const url = document.getElementById('api-url-input').value;
    localStorage.setItem('api_url', url);
    API_URL = url;
    alert('API URL saved!');
    location.reload();
}

// Utils
function getRarityColor(rarity) {
    const colors = {
        'Common': '#b2bec3',
        'Rare': '#0984e3',
        'Epic': '#a29bfe',
        'Legendary': '#fdcb6e',
        'Mythic': '#ff7675',
        'Brainrot God': '#a29bfe', // Rainbow-ish
        'Secret': '#2d3436',
        'OG': '#ffeaa7'
    };
    return colors[rarity] || '#fff';
}

// Modal
window.openModal = (id) => {
    if (id === 'brainrotModal' && !document.getElementById('brainrot-id').value) {
        document.getElementById('addBrainrotForm').reset();
        document.getElementById('brainrotModalTitle').textContent = 'Add New Brainrot';
    }
    document.getElementById(id).style.display = 'flex';
}
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
};
