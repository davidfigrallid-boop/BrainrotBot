// Configuration
let API_URL = localStorage.getItem('api_url') || '/api';
let CURRENT_GUILD_ID = localStorage.getItem('current_guild_id') || null;
const PASSWORD = 'Azerty123_';

// Available Traits
const AVAILABLE_TRAITS = [
    'Bloodmoon', 'Taco', 'Galactic', 'Explosive', 'Bubblegum', 'Zombie', 'Glitch ed',
    'Claws', 'Fireworks', 'Nyan', 'Fire', 'Rain', 'Snowy', 'Cometstruck', 'Disco',
    'Water', 'TenB', 'Matteo Hat', 'Brazil Flag', 'Sleep', 'UFO', 'Mygame43',
    'Spider', 'Strawberry', 'Extinct', 'Paint', 'Sombrero', 'Tie', 'Wizard Hat',
    'Indonesia Flag', 'Meowl', 'Pumpkin', 'R.I.P.'
];

// Authentication
function checkAuth() {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (isAuthenticated) {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        initApp();
    } else {
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
}

function logout() {
    localStorage.removeItem('isAuthenticated');
    location.reload();
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('login-error');

    if (password === PASSWORD) {
        localStorage.setItem('isAuthenticated', 'true');
        checkAuth();
    } else {
        errorEl.textContent = 'Incorrect password';
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 3000);
    }
});

// Navigation
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event?.target?.closest('.nav-btn')?.classList.add('active');
}

// New Feature Functions (placeholders for API integration)
function fetchLogs() {
    showToast('Logs feature - use Discord command /logs setup', 'warning');
}

function fetchTikTokTracking() {
    showToast('TikTok tracking - use Discord command /tiktok add', 'warning');
}

function fetchUserStats() {
    showToast('User stats - use Discord command /info @user', 'warning');
}

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
function initApp() {
    const apiUrlInput = document.getElementById('api-url-input');
    if (apiUrlInput) {
        apiUrlInput.value = API_URL === '/api' ? window.location.origin + '/api' : API_URL;
    }

    initTraitsCheckboxes();
    fetchGuilds();
    refreshDashboard();
    fetchBrainrots();
    fetchGiveaways();
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// Guild Selector
const guildSelector = document.getElementById('guild-selector');
if (guildSelector) {
    guildSelector.addEventListener('change', (e) => {
        CURRENT_GUILD_ID = e.target.value;
        localStorage.setItem('current_guild_id', CURRENT_GUILD_ID);
        refreshDashboard();
        fetchGiveaways();
    });
}

// Refresh Functions
function refreshDashboard() {
    fetchStats();
    showToast('Dashboard refreshed!', 'success');
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

async function refreshDiscordList() {
    try {
        const res = await fetch(`${API_URL}/bot/refresh-list`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast('Discord list refreshed!', 'success');
        } else {
            throw new Error(data.error || 'Failed to refresh');
        }
    } catch (e) {
        console.error(e);
        showToast('Error refreshing Discord list', 'error');
    }
}

async function fetchStats() {
    try {
        const url = CURRENT_GUILD_ID ? `${API_URL}/stats?guild_id=${CURRENT_GUILD_ID}` : `${API_URL}/stats`;
        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('stat-brainrots').textContent = data.brainrots_count || 0;
        document.getElementById('stat-giveaways').textContent = data.giveaways_count || 0;

        if (document.getElementById('stat-sold')) {
            document.getElementById('stat-sold').textContent = data.sold_count || 0;
        }
        if (document.getElementById('stat-money')) {
            document.getElementById('stat-money').textContent = `€${parseFloat(data.money_made || 0).toFixed(2)}`;
        }
    } catch (e) {
        console.error('Error fetching stats:', e);
    }

    try {
        const res = await fetch(`${API_URL}/crypto`);
        const data = await res.json();
        document.getElementById('stat-btc').textContent = `$${data.btc}`;
        document.getElementById('stat-eth').textContent = `$${data.eth}`;
        if (document.getElementById('stat-ltc')) {
            document.getElementById('stat-ltc').textContent = `$${data.ltc}`;
        }
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
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">No brainrots found</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            const soldTitle = item.sold ? `Sold on ${new Date(item.sold_date).toLocaleDateString()} for €${item.sold_price}` : 'Available';

            tr.innerHTML = `
                <td>${item.id}</td>
                <td><strong>${item.name}</strong></td>
                <td><span style="color: ${getRarityColor(item.rarity)}">${item.rarity}</span></td>
                <td>${item.mutation || 'Default'}</td>
                <td>${parseFloat(item.income_per_second).toFixed(2)}</td>
                <td>€${parseFloat(item.price_eur).toFixed(2)}</td>
                <td><strong>${item.quantity}</strong></td>
                <td>${item.owner_id || '-'}</td>
                <td style="text-align: center;">
                    <input type="checkbox" ${item.sold ? 'checked' : ''} 
                           onchange="toggleSold(${item.id}, ${item.sold ? 'true' : 'false'})" 
                           title="${soldTitle}"
                           style="cursor: pointer; width: 18px; height: 18px;">
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick='editBrainrot(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
                        <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="deleteBrainrot(${item.id})">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        showToast('Brainrots refreshed!', 'success');
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
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No giveaways found</td></tr>';
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
                <td><code>${item.channel_id || 'N/A'}</code></td>
                <td>${endsAt}</td>
                <td>${status}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${!isEnded ? `<button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="endGiveaway(${item.id}, '${item.channel_id}')">End</button>` : ''}
                        ${isEnded ? `<button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="rerollGiveaway(${item.id}, '${item.channel_id}')">Reroll</button>` : ''}
                        <button class="btn btn-danger" style="padding: 0.5rem 1rem;" onclick="deleteGiveaway(${item.id})">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        showToast('Giveaways refreshed!', 'success');
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

async function toggleSold(id, currentlySold) {
    try {
        const sold = !currentlySold;
        let sold_price = null;

        if (sold) {
            sold_price = prompt('Prix de vente (€):');
            if (sold_price === null) return; // User cancelled
            sold_price = parseFloat(sold_price) || 0;
        }

        const res = await fetch(`${API_URL}/brainrots/${id}/sold`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sold, sold_price })
        });

        if (res.ok) {
            showToast(sold ? 'Brainrot marked as sold!' : 'Brainrot marked as available', 'success');
            fetchBrainrots();
            fetchStats();
        } else {
            throw new Error('Failed to update sold status');
        }
    } catch (e) {
        console.error(e);
        showToast('Error updating sold status', 'error');
    }
}

function editBrainrot(item) {
    document.getElementById('brainrot-id').value = item.id;
    document.getElementById('brainrot-name').value = item.name;
    document.getElementById('brainrot-rarity').value = item.rarity;
    document.getElementById('brainrot-mutation').value = item.mutation || 'Default';
    document.getElementById('brainrot-income').value = item.income_per_second;
    document.getElementById('brainrot-price').value = item.price_eur;

    // Reset and check traits
    document.querySelectorAll('.trait-checkbox').forEach(cb => cb.checked = false);
    const traits = Array.isArray(item.traits) ? item.traits : (item.traits ? [item.traits] : []);
    traits.forEach(trait => {
        const cb = document.querySelector(`.trait-checkbox[value="${trait}"]`);
        if (cb) cb.checked = true;
    });

    document.getElementById('brainrot-quantity').value = item.quantity || 1;
    document.getElementById('brainrot-owner').value = item.owner_id || '';

    document.getElementById('brainrotModalTitle').textContent = 'Edit Brainrot';
    openModal('brainrotModal');
}

async function endGiveaway(id, channelId) {
    if (!confirm('Are you sure you want to end this giveaway?')) return;

    try {
        const res = await fetch(`${API_URL}/giveaways/${id}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channelId })
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

async function rerollGiveaway(id, channelId) {
    if (!confirm('Are you sure you want to reroll this giveaway?')) return;

    try {
        const res = await fetch(`${API_URL}/giveaways/${id}/reroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channelId })
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

async function deleteGiveaway(id) {
    if (!confirm('Are you sure you want to delete this giveaway?')) return;

    try {
        const res = await fetch(`${API_URL}/giveaways/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Giveaway deleted successfully!', 'success');
            fetchGiveaways();
            fetchStats();
        } else {
            throw new Error('Failed to delete');
        }
    } catch (e) {
        console.error(e);
        showToast('Error deleting giveaway', 'error');
    }
}

// Form Handling
document.getElementById('addBrainrotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Process traits
    data.traits = getSelectedTraits();

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
            // Reset checkboxes
            document.querySelectorAll('.trait-checkbox').forEach(cb => cb.checked = false);

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

// Traits Helper Functions
function initTraitsCheckboxes() {
    const container = document.getElementById('traits-checkboxes');
    if (!container) return;

    container.innerHTML = AVAILABLE_TRAITS.map(trait => `
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" value="${trait}" class="trait-checkbox" style="width: 16px; height: 16px;">
            <span style="font-size: 0.9rem;">${trait}</span>
        </label>
    `).join('');
}

function getSelectedTraits() {
    return Array.from(document.querySelectorAll('.trait-checkbox:checked'))
        .map(cb => cb.value);
}

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

// Import/Export JSON Functions
function importBrainrotsJSON() {
    document.getElementById('import-json-textarea').value = '';
    openModal('importJsonModal');
}

async function processJSONImport() {
    const jsonText = document.getElementById('import-json-textarea').value.trim();

    if (!jsonText) {
        showToast('Veuillez coller du JSON', 'warning');
        return;
    }

    try {
        const brainrots = JSON.parse(jsonText);

        if (!Array.isArray(brainrots)) {
            throw new Error('Le JSON doit contenir un tableau de brainrots');
        }

        let successCount = 0;
        let errorCount = 0;

        for (const brainrot of brainrots) {
            try {
                const res = await fetch(`${API_URL}/brainrots`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(brainrot)
                });

                if (res.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to import brainrot: ${brainrot.name}`);
                }
            } catch (e) {
                errorCount++;
                console.error(`Error importing brainrot: ${brainrot.name}`, e);
            }
        }

        closeModal('importJsonModal');

        if (successCount > 0) {
            showToast(`${successCount} brainrot(s) importé(s) avec succès!`, 'success');
            fetchBrainrots();
            fetchStats();
        }

        if (errorCount > 0) {
            showToast(`${errorCount} brainrot(s) n'ont pas pu être importés`, 'warning');
        }

    } catch (e) {
        console.error('Error parsing JSON:', e);
        showToast('Erreur: JSON invalide', 'error');
    }
}

async function exportBrainrotsJSON() {
    try {
        const res = await fetch(`${API_URL}/brainrots`);
        const brainrots = await res.json();

        if (brainrots.length === 0) {
            showToast('Aucun brainrot à exporter', 'warning');
            return;
        }

        const jsonStr = JSON.stringify(brainrots, null, 2);
        document.getElementById('export-json-textarea').value = jsonStr;
        openModal('exportJsonModal');

    } catch (e) {
        console.error('Error exporting brainrots:', e);
        showToast('Erreur lors de l\'export des brainrots', 'error');
    }
}

function copyJSONToClipboard() {
    const textarea = document.getElementById('export-json-textarea');
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices

    try {
        document.execCommand('copy');
        showToast('JSON copié dans le presse-papier!', 'success');
    } catch (e) {
        // Fallback for modern browsers
        navigator.clipboard.writeText(textarea.value).then(() => {
            showToast('JSON copié dans le presse-papier!', 'success');
        }).catch(err => {
            console.error('Error copying to clipboard:', err);
            showToast('Erreur lors de la copie', 'error');
        });
    }
}

// Purge All Brainrots
async function purgeAllBrainrots() {
    const confirmation = confirm('⚠️ ATTENTION ⚠️\n\nÊtes-vous sûr de vouloir supprimer TOUS les brainrots ?\n\nCette action est IRRÉVERSIBLE !');

    if (!confirmation) return;

    const doubleConfirmation = confirm('Dernière confirmation !\n\nTapez OK pour supprimer définitivement tous les brainrots.');

    if (!doubleConfirmation) return;

    try {
        const res = await fetch(`${API_URL}/brainrots`);
        const brainrots = await res.json();

        if (brainrots.length === 0) {
            showToast('Aucun brainrot à supprimer', 'warning');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const brainrot of brainrots) {
            try {
                const deleteRes = await fetch(`${API_URL}/brainrots/${brainrot.id}`, {
                    method: 'DELETE'
                });

                if (deleteRes.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to delete brainrot ID: ${brainrot.id}`);
                }
            } catch (e) {
                errorCount++;
                console.error(`Error deleting brainrot ID: ${brainrot.id}`, e);
            }
        }

        if (successCount > 0) {
            showToast(`${successCount} brainrot(s) supprimé(s) !`, 'success');
            fetchBrainrots();
            fetchStats();
        }

        if (errorCount > 0) {
            showToast(`${errorCount} brainrot(s) n'ont pas pu être supprimés`, 'error');
        }

    } catch (e) {
        console.error('Error purging brainrots:', e);
        showToast('Erreur lors de la suppression', 'error');
    }
}
