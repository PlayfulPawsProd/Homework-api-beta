// --- START OF FILE chores.js ---

// Nyaa~! Mika & Kana's Chore Helper! Making tasks fun! ♡
// (Or at least... tolerable. *Tsk* - Kana)

const ChoreHelper = (() => {
    // --- Settings & Constants ---
    const STORAGE_KEY_CHORES = 'mikaChores_list_v1';
    const STORAGE_KEY_BALANCE = 'mikaChores_balance_v1';
    const STORAGE_KEY_HISTORY = 'mikaChores_history_v1';
    const STORAGE_KEY_PIN_HASH = 'mikaChores_pinHash_v1'; // Store a hashed version!
    const STORAGE_KEY_LAST_DAY = 'mikaChores_lastDay_v1';
    const REWARD_NAME = 'Bows'; // Reward currency name
    const REWARD_EMOJI = '🎀'; // Reward currency emoji

    // --- State ---
    let gameUiContainer = null;
    let messageCallback = null; // For API commentary -> index.html log
    let apiCaller = null;       // For API commentary -> index.html call
    let currentUserName = "Kiddo"; // Default, updated via init
    let currentPersonaInGame = 'Mika'; // Updated via init
    let chores = []; // { id: number, name: string, value: number, completed: boolean }
    let currentBalance = 0;
    let history = []; // { timestamp: number, message: string }
    let parentPinHash = null; // Store the hashed PIN (simple obfuscation)
    let isParentMode = false; // To track if parent management is unlocked
    let lastDayReset = null; // Stores the YYYY-MM-DD string of the last reset

    // --- DOM Element References (Assigned dynamically) ---
    // These are pointers to the elements we create in the UI functions
    let choreListElement = null;
    let balanceDisplayElement = null;
    let commentaryElement = null;
    let parentModeButton = null;
    let parentManagementArea = null;
    let addChoreForm = null;
    let historyViewArea = null;
    let statsPiggyBankElement = null;
    let statsTotalEarnedElement = null;
    let mainChoreViewArea = null; // Container for the main view

    // --- Helper Functions ---

    /** _getTimestamp(): Returns current timestamp. */
    function _getTimestamp() { return Date.now(); }

    /** _getCurrentDateString(): Returns 'YYYY-MM-DD'. */
    function _getCurrentDateString() { return new Date().toISOString().slice(0, 10); }

    /** _hashPin(pin): VERY simple obfuscation (NOT SECURE). Just encodes to Base64. */
    function _hashPin(pin) {
        try {
            // WARNING: This is NOT cryptographically secure hashing.
            // It's just simple obfuscation using Base64.
            // A determined user could easily reverse this.
            // For real security, use the Web Crypto API (more complex).
            return btoa(pin + "mika-salt"); // Simple Base64 encoding with a salt
        } catch (e) {
            console.error("Hashing failed:", e);
            return null; // Fallback
        }
    }

    /** _verifyPin(pin): Obfuscates input PIN and compares to stored hash. */
    function _verifyPin(pin) {
        if (!parentPinHash) return false; // No PIN set
        const inputHash = _hashPin(pin);
        return inputHash === parentPinHash;
    }

    /** _saveState(): Saves chores, balance, history, pin hash, last day to localStorage. */
    function _saveState() {
        try {
            localStorage.setItem(STORAGE_KEY_CHORES, JSON.stringify(chores));
            localStorage.setItem(STORAGE_KEY_BALANCE, JSON.stringify(currentBalance));
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            if (parentPinHash) localStorage.setItem(STORAGE_KEY_PIN_HASH, parentPinHash);
            else localStorage.removeItem(STORAGE_KEY_PIN_HASH); // Remove if null
            localStorage.setItem(STORAGE_KEY_LAST_DAY, lastDayReset || '');
            console.log("Chore state saved.");
        } catch (e) {
            console.error("Failed to save chore state:", e);
        }
    }

    /** _loadState(): Loads state from localStorage. */
    function _loadState() {
        try {
            const storedChores = localStorage.getItem(STORAGE_KEY_CHORES);
            const storedBalance = localStorage.getItem(STORAGE_KEY_BALANCE);
            const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
            const storedPinHash = localStorage.getItem(STORAGE_KEY_PIN_HASH);
            const storedLastDay = localStorage.getItem(STORAGE_KEY_LAST_DAY);

            chores = storedChores ? JSON.parse(storedChores) : [];
            // Ensure 'completed' property exists
            chores = chores.map(c => ({ ...c, completed: c.completed || false }));
            currentBalance = storedBalance ? JSON.parse(storedBalance) : 0;
            history = storedHistory ? JSON.parse(storedHistory) : [];
            parentPinHash = storedPinHash || null;
            lastDayReset = storedLastDay || null;
            console.log("Chore state loaded.");
        } catch (e) {
            console.error("Failed to load chore state:", e);
            // Reset to defaults on error
            chores = []; currentBalance = 0; history = []; parentPinHash = null; lastDayReset = null;
        }
    }

    /** _resetDailyChores(): Checks date, unchecks chores if new day. */
    function _resetDailyChores() {
        const todayStr = _getCurrentDateString();
        if (lastDayReset !== todayStr) {
            console.log(`New day detected (${todayStr}). Resetting daily chores.`);
            let choresReset = false;
            chores.forEach(chore => {
                if (chore.completed) {
                    chore.completed = false;
                    choresReset = true;
                }
            });
            lastDayReset = todayStr;
            if (choresReset) {
                _saveState(); // Save the reset state
            }
        } else {
            console.log("Chores already up-to-date for today.");
        }
    }

    /** _updateBalanceDisplay(): Updates the UI element showing current balance. */
    function _updateBalanceDisplay() {
        if (balanceDisplayElement) {
            balanceDisplayElement.textContent = `Balance: ${currentBalance} ${REWARD_EMOJI}`;
            balanceDisplayElement.title = `Current available ${REWARD_NAME}`;
        }
         // Also update stats if history view is active
         if (statsPiggyBankElement && historyViewArea && historyViewArea.style.display !== 'none') {
             statsPiggyBankElement.textContent = `${currentBalance} ${REWARD_EMOJI}`;
         }
    }

    /** _addHistoryEntry(message): Adds a message to the history array and saves. */
    function _addHistoryEntry(message) {
        if (!message) return;
        history.push({ timestamp: _getTimestamp(), message });
        // Optional: Limit history length
        // if (history.length > 100) history.shift();
        _saveState();
        // If history view is active, re-render it
        if (historyViewArea && historyViewArea.style.display !== 'none') {
            const listContainer = historyViewArea.querySelector('#history-list-container');
            if(listContainer) _renderHistoryList(listContainer);
        }
    }

    /** _calculateTotalEarned(): Calculates total ever earned from history. */
    function _calculateTotalEarned() {
        // Note: This iterates history every time. Could be cached if performance becomes an issue.
        let total = 0;
        const regex = /\(\+(\d+)\s*🎀\)/; // Matches (+Number Emoji)
        history.forEach(entry => {
            const match = entry.message.match(regex);
            if (match && match[1]) {
                total += parseInt(match[1], 10);
            }
        });
        return total;
    }


    // --- UI Rendering Functions ---

    /** Clears the main game container */
    function _clearUI() {
        if(gameUiContainer) gameUiContainer.innerHTML = '';
        // Reset references
        mainChoreViewArea = choreListElement = balanceDisplayElement = commentaryElement = parentModeButton = null;
        parentManagementArea = addChoreForm = historyViewArea = statsPiggyBankElement = statsTotalEarnedElement = null;
        isParentMode = false; // Ensure parent mode is off when clearing UI
    }

    /** _createMainUI(): Creates the main chore list view. */
    function _createMainUI() {
        _clearUI(); // Clear previous UI first

        mainChoreViewArea = document.createElement('div');
        mainChoreViewArea.style.width = '100%';
        mainChoreViewArea.style.height = '100%';
        mainChoreViewArea.style.display = 'flex';
        mainChoreViewArea.style.flexDirection = 'column';
        mainChoreViewArea.style.padding = '10px';
        mainChoreViewArea.style.boxSizing = 'border-box';

        // Header Area (Balance, Redeem, Parent Mode, History)
        const headerArea = document.createElement('div');
        headerArea.style.display = 'flex';
        headerArea.style.justifyContent = 'space-between';
        headerArea.style.alignItems = 'center';
        headerArea.style.marginBottom = '10px';
        headerArea.style.flexShrink = '0';

        balanceDisplayElement = document.createElement('span');
        balanceDisplayElement.style.fontWeight = 'bold';
        balanceDisplayElement.style.fontSize = '1.1em';
        _updateBalanceDisplay(); // Set initial value
        headerArea.appendChild(balanceDisplayElement);

        const buttonGroup = document.createElement('div');

        const redeemButton = document.createElement('button');
        redeemButton.textContent = `Redeem ${REWARD_EMOJI}!`;
        redeemButton.className = 'rps-choice-button';
        redeemButton.style.marginLeft = '10px';
        redeemButton.onclick = _handleRedeem;
        buttonGroup.appendChild(redeemButton);

        const historyButton = document.createElement('button');
        historyButton.textContent = 'History 📜';
        historyButton.className = 'rps-choice-button secondary';
        historyButton.style.marginLeft = '5px';
        historyButton.onclick = _createHistoryUI;
        buttonGroup.appendChild(historyButton);

        parentModeButton = document.createElement('button');
        parentModeButton.textContent = '⚙️ Parent';
        parentModeButton.className = 'rps-choice-button secondary';
        parentModeButton.style.marginLeft = '5px';
        parentModeButton.onclick = _handleParentModeToggle;
        buttonGroup.appendChild(parentModeButton);

        headerArea.appendChild(buttonGroup);
        mainChoreViewArea.appendChild(headerArea);

        // Chore List Area
        choreListElement = document.createElement('div');
        choreListElement.id = 'chore-list';
        choreListElement.style.flexGrow = '1';
        choreListElement.style.overflowY = 'auto';
        choreListElement.style.border = '1px solid var(--game-cell-border)';
        choreListElement.style.borderRadius = '5px';
        choreListElement.style.padding = '10px';
        choreListElement.style.marginBottom = '10px';
        mainChoreViewArea.appendChild(choreListElement);

        // Commentary Area
        commentaryElement = document.createElement('div');
        commentaryElement.id = 'chore-commentary';
        commentaryElement.style.minHeight = '2em'; // Reserve space
        commentaryElement.style.textAlign = 'center';
        commentaryElement.style.fontStyle = 'italic';
        commentaryElement.style.color = 'var(--mika-message-name)'; // Use persona color
        commentaryElement.style.flexShrink = '0';
        mainChoreViewArea.appendChild(commentaryElement);

        // Hidden Parent Management Area (created but not appended yet)
        _createParentManagementUI();

        gameUiContainer.appendChild(mainChoreViewArea);
        _renderChoreList(); // Populate the list
    }

    /** _renderChoreList(): Clears and redraws the chore list based on `chores` state. */
    function _renderChoreList() {
        if (!choreListElement) return;
        choreListElement.innerHTML = ''; // Clear existing list

        if (chores.length === 0) {
            choreListElement.textContent = 'No chores added yet! Ask a parent to add some using the ⚙️ button.';
            choreListElement.style.textAlign = 'center';
            choreListElement.style.paddingTop = '20px';
            return;
        }

        chores.forEach(chore => {
            const choreDiv = document.createElement('div');
            choreDiv.style.display = 'flex';
            choreDiv.style.alignItems = 'center';
            choreDiv.style.padding = '8px 5px';
            choreDiv.style.borderBottom = '1px dashed var(--input-border)';
            choreDiv.style.opacity = chore.completed ? 0.6 : 1;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = chore.completed;
            checkbox.id = `chore-${chore.id}`;
            checkbox.style.marginRight = '10px';
            checkbox.style.transform = 'scale(1.3)'; // Make checkbox slightly larger
            checkbox.onchange = (e) => _handleChoreCheck(chore.id, e.target.checked);

            const label = document.createElement('label');
            label.htmlFor = `chore-${chore.id}`;
            label.textContent = `${chore.name} (+${chore.value} ${REWARD_EMOJI})`;
            label.style.flexGrow = '1';
            label.style.textDecoration = chore.completed ? 'line-through' : 'none';
            label.style.cursor = 'pointer';

            choreDiv.appendChild(checkbox);
            choreDiv.appendChild(label);
            choreListElement.appendChild(choreDiv);
        });
    }

    /** _createParentManagementUI(): Creates the UI elements for managing chores (initially hidden). */
    function _createParentManagementUI() {
        parentManagementArea = document.createElement('div');
        parentManagementArea.id = 'parent-management-area';
        parentManagementArea.style.display = 'none'; // Hidden by default
        parentManagementArea.style.padding = '15px';
        parentManagementArea.style.border = '2px solid var(--popup-border)';
        parentManagementArea.style.borderRadius = '8px';
        parentManagementArea.style.marginTop = '10px';
        parentManagementArea.style.backgroundColor = 'var(--game-board-bg)';
        parentManagementArea.style.maxHeight = '70vh'; // Limit height
        parentManagementArea.style.overflowY = 'auto';

        const title = document.createElement('h3');
        title.textContent = 'Parent Controls';
        title.style.textAlign = 'center';
        title.style.marginTop = '0';
        parentManagementArea.appendChild(title);

        // --- Add Chore Form ---
        addChoreForm = document.createElement('form');
        addChoreForm.style.marginBottom = '20px';
        addChoreForm.style.paddingBottom = '15px';
        addChoreForm.style.borderBottom = '1px solid var(--input-border)';

        const addTitle = document.createElement('h4');
        addTitle.textContent = 'Add New Chore';
        addTitle.style.marginBottom = '10px';
        addChoreForm.appendChild(addTitle);

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Chore Name: ';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'add-chore-name';
        nameInput.required = true;
        nameInput.style.margin = '5px';
        nameInput.style.padding = '5px';
        addChoreForm.appendChild(nameLabel);
        addChoreForm.appendChild(nameInput);
        addChoreForm.appendChild(document.createElement('br'));

        const valueLabel = document.createElement('label');
        valueLabel.textContent = `Value (${REWARD_EMOJI}): `;
        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.id = 'add-chore-value';
        valueInput.min = '0';
        valueInput.required = true;
        valueInput.style.margin = '5px';
        valueInput.style.padding = '5px';
        valueInput.style.width = '60px';
        addChoreForm.appendChild(valueLabel);
        addChoreForm.appendChild(valueInput);
        addChoreForm.appendChild(document.createElement('br'));

        const addButton = document.createElement('button');
        addButton.type = 'submit';
        addButton.textContent = 'Add Chore';
        addButton.className = 'rps-choice-button';
        addButton.style.marginTop = '10px';
        addChoreForm.appendChild(addButton);

        addChoreForm.onsubmit = _handleAddChore;
        parentManagementArea.appendChild(addChoreForm);

         // --- Bonus Points ---
         const bonusArea = document.createElement('div');
         bonusArea.style.marginBottom = '20px';
         bonusArea.style.paddingBottom = '15px';
         bonusArea.style.borderBottom = '1px solid var(--input-border)';
         const bonusTitle = document.createElement('h4');
         bonusTitle.textContent = 'Add Bonus';
         bonusTitle.style.marginBottom = '10px';
         bonusArea.appendChild(bonusTitle);
         const bonusValueLabel = document.createElement('label');
         bonusValueLabel.textContent = `Bonus ${REWARD_EMOJI}: `;
         const bonusValueInput = document.createElement('input');
         bonusValueInput.type = 'number';
         bonusValueInput.id = 'bonus-value-input';
         bonusValueInput.min = '1';
         bonusValueInput.style.margin = '5px';
         bonusValueInput.style.padding = '5px';
         bonusValueInput.style.width = '60px';
         const bonusAddButton = document.createElement('button');
         bonusAddButton.textContent = `Add Bonus ${REWARD_EMOJI}`;
         bonusAddButton.className = 'rps-choice-button';
         bonusAddButton.style.marginLeft = '10px';
         bonusAddButton.onclick = () => {
             const amount = parseInt(bonusValueInput.value, 10);
             if (amount > 0) {
                 currentBalance += amount;
                 _addHistoryEntry(`Bonus Added! (+${amount} ${REWARD_EMOJI})`);
                 _updateBalanceDisplay();
                 _saveState();
                 _triggerApiCommentary('bonusAdded', { amount: amount });
                 bonusValueInput.value = ''; // Clear input
                 alert(`Added ${amount} ${REWARD_EMOJI} bonus!`);
             } else {
                 alert("Please enter a valid bonus amount.");
             }
         };
         bonusArea.appendChild(bonusValueLabel);
         bonusArea.appendChild(bonusValueInput);
         bonusArea.appendChild(bonusAddButton);
         parentManagementArea.appendChild(bonusArea);


        // --- Existing Chores List ---
        const existingTitle = document.createElement('h4');
        existingTitle.textContent = 'Manage Existing Chores';
        existingTitle.style.marginBottom = '10px';
        parentManagementArea.appendChild(existingTitle);

        const existingChoresList = document.createElement('div');
        existingChoresList.id = 'manage-chore-list'; // For easy selection later
        parentManagementArea.appendChild(existingChoresList);
        _renderManageChoreList(existingChoresList); // Populate it

        // --- PIN Management ---
        const pinArea = document.createElement('div');
        pinArea.style.marginTop = '20px';
        pinArea.style.paddingTop = '15px';
        pinArea.style.borderTop = '1px solid var(--input-border)';
        const pinTitle = document.createElement('h4');
        pinTitle.textContent = 'Set/Change Parent PIN';
        pinTitle.style.marginBottom = '10px';
        pinArea.appendChild(pinTitle);

        const pinInput = document.createElement('input');
        pinInput.type = 'password'; // Use password type
        pinInput.id = 'parent-pin-set';
        pinInput.placeholder = 'Enter 4-digit PIN';
        pinInput.maxLength = 4;
        pinInput.pattern = "\\d{4}"; // Basic pattern for 4 digits
        pinInput.style.marginRight = '10px';
        pinInput.style.padding = '5px';
        pinArea.appendChild(pinInput);

        const setPinButton = document.createElement('button');
        setPinButton.textContent = parentPinHash ? 'Change PIN' : 'Set PIN';
        setPinButton.className = 'rps-choice-button secondary';
        setPinButton.onclick = () => {
            const newPin = pinInput.value;
            if (newPin && /^\d{4}$/.test(newPin)) {
                _handleSetPin(newPin);
                pinInput.value = ''; // Clear after setting
                 setPinButton.textContent = 'Change PIN'; // Update button text
            } else {
                alert("Please enter a valid 4-digit PIN.");
            }
        };
        pinArea.appendChild(setPinButton);
        parentManagementArea.appendChild(pinArea);


        // --- Close Button ---
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close Parent Controls';
        closeButton.className = 'rps-choice-button secondary';
        closeButton.style.marginTop = '20px';
        closeButton.style.display = 'block'; // Center easily
        closeButton.style.marginLeft = 'auto';
        closeButton.style.marginRight = 'auto';
        closeButton.onclick = _hideParentManagementUI;
        parentManagementArea.appendChild(closeButton);

        // Note: Don't append parentManagementArea to gameUiContainer here.
        // It gets appended temporarily when needed.
    }

    /** _renderManageChoreList(container): Renders chores with delete buttons for parent mode. */
    function _renderManageChoreList(container) {
        if (!container) container = document.getElementById('manage-chore-list');
        if (!container) return;
        container.innerHTML = ''; // Clear

        if (chores.length === 0) {
            container.textContent = 'No chores to manage yet.';
            return;
        }

        chores.forEach(chore => {
            const itemDiv = document.createElement('div');
            itemDiv.style.display = 'flex';
            itemDiv.style.justifyContent = 'space-between';
            itemDiv.style.alignItems = 'center';
            itemDiv.style.padding = '5px 0';
            itemDiv.style.borderBottom = '1px solid var(--input-border)';

            const choreInfo = document.createElement('span');
            choreInfo.textContent = `${chore.name} (${chore.value} ${REWARD_EMOJI})`;

            // Add Edit/Delete buttons (Edit is complex, start with Delete)
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'rps-choice-button secondary'; // Maybe a smaller style?
            deleteButton.style.fontSize = '0.8em';
            deleteButton.style.padding = '3px 6px';
            deleteButton.style.marginLeft = '10px';
            deleteButton.onclick = () => _handleDeleteChore(chore.id);

            itemDiv.appendChild(choreInfo);
            itemDiv.appendChild(deleteButton);
            container.appendChild(itemDiv);
        });
    }

    /** _showParentManagementUI(): Shows the management UI after PIN entry. */
    function _showParentManagementUI() {
        if (!mainChoreViewArea || !parentManagementArea) return;
        mainChoreViewArea.style.display = 'none'; // Hide main view
        // Ensure the management list is up-to-date before showing
        const listContainer = parentManagementArea.querySelector('#manage-chore-list');
        if(listContainer) _renderManageChoreList(listContainer);
        gameUiContainer.appendChild(parentManagementArea); // Add to DOM
        parentManagementArea.style.display = 'block';
        isParentMode = true;
        console.log("Parent mode entered.");
    }

    /** _hideParentManagementUI(): Hides management UI, shows main chore list. */
    function _hideParentManagementUI() {
        if (!mainChoreViewArea || !parentManagementArea) return;
        if(parentManagementArea.parentNode === gameUiContainer) {
            gameUiContainer.removeChild(parentManagementArea); // Remove from DOM
        }
        parentManagementArea.style.display = 'none';
        mainChoreViewArea.style.display = 'flex'; // Show main view
        isParentMode = false;
        console.log("Parent mode exited.");
    }

    /** _createHistoryUI(): Creates and displays the history view page. */
    function _createHistoryUI() {
        _clearUI(); // Clear current view

        historyViewArea = document.createElement('div');
        historyViewArea.id = 'chore-history-view';
        historyViewArea.style.width = '100%';
        historyViewArea.style.height = '100%';
        historyViewArea.style.display = 'flex';
        historyViewArea.style.flexDirection = 'column';
        historyViewArea.style.padding = '10px';
        historyViewArea.style.boxSizing = 'border-box';

        const title = document.createElement('h3');
        title.textContent = 'Chore History & Stats';
        title.style.textAlign = 'center';
        title.style.flexShrink = '0';
        historyViewArea.appendChild(title);

        const backButton = document.createElement('button');
        backButton.textContent = '← Back to Chores';
        backButton.className = 'rps-choice-button secondary';
        backButton.style.marginBottom = '10px';
        backButton.style.alignSelf = 'center'; // Center button
         backButton.style.flexShrink = '0';
        backButton.onclick = _createMainUI; // Go back to main chore list
        historyViewArea.appendChild(backButton);

        // Stats Area
        const statsArea = document.createElement('div');
        statsArea.style.marginBottom = '10px';
        statsArea.style.padding = '10px';
        statsArea.style.border = '1px solid var(--input-border)';
        statsArea.style.borderRadius = '5px';
        statsArea.style.textAlign = 'center';
        statsArea.style.flexShrink = '0';

        statsPiggyBankElement = document.createElement('p');
        statsPiggyBankElement.id = 'stats-piggy-bank';
        statsPiggyBankElement.style.margin = '5px 0';
        statsPiggyBankElement.innerHTML = `Current Balance (Piggy Bank): <strong id="piggy-bank-value"></strong>`;

        statsTotalEarnedElement = document.createElement('p');
        statsTotalEarnedElement.id = 'stats-total-earned';
        statsTotalEarnedElement.style.margin = '5px 0';
        statsTotalEarnedElement.innerHTML = `Total Earned Ever: <strong id="total-earned-value"></strong>`;

        statsArea.appendChild(statsPiggyBankElement);
        statsArea.appendChild(statsTotalEarnedElement);
        historyViewArea.appendChild(statsArea);

        // History List Container
        const historyListContainer = document.createElement('div');
        historyListContainer.id = 'history-list-container';
        historyListContainer.style.flexGrow = '1';
        historyListContainer.style.overflowY = 'auto';
        historyListContainer.style.border = '1px solid var(--input-border)';
        historyListContainer.style.borderRadius = '5px';
        historyListContainer.style.padding = '10px';
        historyViewArea.appendChild(historyListContainer);

        gameUiContainer.appendChild(historyViewArea);

        // Populate stats and history list
        _updateStatsDisplay(); // Initial stats update
        // Find the specific value elements to update
        const piggyBankValueEl = document.getElementById('piggy-bank-value');
        const totalEarnedValueEl = document.getElementById('total-earned-value');
        if (piggyBankValueEl) piggyBankValueEl.textContent = `${currentBalance} ${REWARD_EMOJI}`;
        if (totalEarnedValueEl) totalEarnedValueEl.textContent = `${_calculateTotalEarned()} ${REWARD_EMOJI}`;

        _renderHistoryList(historyListContainer);
    }

    /** _renderHistoryList(container): Renders the history entries into the container. */
    function _renderHistoryList(container) {
        if (!container) return;
        container.innerHTML = ''; // Clear existing list

        if (history.length === 0) {
            container.textContent = 'No chore history yet!';
            container.style.textAlign = 'center';
            return;
        }

        // Show newest entries first
        [...history].reverse().forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.style.padding = '4px 0';
            entryDiv.style.fontSize = '0.9em';
            entryDiv.style.borderBottom = '1px dotted var(--input-border)';

            const dateSpan = document.createElement('span');
            dateSpan.style.color = 'var(--system-message-text)';
            dateSpan.style.fontSize = '0.8em';
            dateSpan.style.marginRight = '10px';
            dateSpan.textContent = new Date(entry.timestamp).toLocaleString();

            const messageSpan = document.createElement('span');
            messageSpan.textContent = entry.message;

            entryDiv.appendChild(dateSpan);
            entryDiv.appendChild(messageSpan);
            container.appendChild(entryDiv);
        });
    }


    // --- Commentary Functions ---

    /** _showCannedCommentary(type, value = 0): Displays a quick, non-API message in commentaryElement. */
    function _showCannedCommentary(type, value = 0) {
        if (!commentaryElement) return;
        let msg = "";
        const cannedResponses = {
            Mika: {
                // choreDone needs value passed in
                choreDone: [`+ ${value} ${REWARD_EMOJI}! Keep going! (*^▽^*)`, `Nice one! +${value} ${REWARD_EMOJI}!`, `Got it! +${value} ${REWARD_EMOJI} ☆`],
                randomDaily: [`Keep up the great work, ${currentUserName}! (๑˃ᴗ˂)ﻭ`, `Don't forget your chores today~ Hehe! (ΦωΦ)`, `Making Master proud! ♡`],
                redeemEmpty: [`Your piggy bank is empty, silly! (⌒_⌒;) Do some chores!`],
            },
            Kana: {
                 // choreDone needs value passed in
                choreDone: [`+${value} ${REWARD_NAME}.`, `Done. +${value} ${REWARD_NAME}.`],
                randomDaily: [`Are those chores done yet?`, `Still waiting... (¬_¬)`, `Just get it over with.`],
                redeemEmpty: [`Empty. Do something first.`],
            }
        };
        const personaMsgs = cannedResponses[currentPersonaInGame] || cannedResponses.Mika;
        if (personaMsgs[type] && personaMsgs[type].length > 0) {
            const randomIndex = Math.floor(Math.random() * personaMsgs[type].length);
            msg = personaMsgs[type][randomIndex];

            commentaryElement.textContent = msg;
             // Fade out after a few seconds
             commentaryElement.style.opacity = '1';
             setTimeout(() => {
                 if(commentaryElement) {
                    commentaryElement.style.transition = 'opacity 0.5s ease-out';
                    commentaryElement.style.opacity = '0';
                    // Reset after fade
                    setTimeout(() => {
                         if(commentaryElement) {
                            commentaryElement.textContent = '';
                            commentaryElement.style.opacity = '1';
                            commentaryElement.style.transition = '';
                         }
                    }, 500);
                 }
             }, 2500); // Visible for 2.5 seconds
        }
    }

    /** _triggerApiCommentary(eventType, details): Builds prompt and calls API via apiCaller. */
    async function _triggerApiCommentary(eventType, details = {}) {
        // Ensure external functions are available
        if (!apiCaller || !messageCallback) {
             console.warn("API Caller or Message Callback not available for commentary.");
             _sendMessageToLog(`System: Cannot trigger commentary for ${eventType} - dependencies missing.`);
             return;
         }
        let prompt = "";
        const kidName = currentUserName; // Use the kid's actual name
        const reward = REWARD_NAME;
        const emoji = REWARD_EMOJI;

        // Build the role instruction based on the current persona
        const baseRoleMika = `[ROLE: You are Mika, the cheerful catgirl helper. ${kidName} is using the chore app.]`;
        const baseRoleKana = `[ROLE: You are Kana, the sarcastic catgirl helper. ${kidName} is using the chore app.]`;
        const baseRole = (currentPersonaInGame === 'Mika') ? baseRoleMika : baseRoleKana;

        // Build the rest of the prompt based on the event
        switch (eventType) {
            case 'allChoresDone':
                prompt = (currentPersonaInGame === 'Mika')
                    ? `${baseRole} ${kidName} just finished ALL chores for the day, earning ${details.earnedToday} ${reward}! Cheer them on enthusiastically! Be super proud! Use cute noises/emojis like (*^▽^*), (≧∀≦), (ﾉ´ヮ´)ﾉ*:･ﾟ✧, (๑˃ᴗ˂)ﻭ, (ΦωΦ), (=^･ω･^=), *purrrr*, *giggle*, Nyaa~! ☆(≧∀≦*)ﾉ`
                    : `${baseRole} ${kidName} finally finished all chores, earning ${details.earnedToday} ${reward}. Give a sarcastic but maybe slightly impressed acknowledgement. Keep it short and dry. Use emojis like (¬_¬), *Tsk*, *Sigh*, (￣_￣), 😼.`;
                break;
            case 'bonusAdded':
                prompt = (currentPersonaInGame === 'Mika')
                    ? `${baseRole} The parent just gave ${kidName} a bonus of ${details.amount} ${reward}! React with surprise and excitement! Tell them they must be doing super well! Use cute noises/emojis! Yay! (ﾉ´ヮ´)ﾉ*:･ﾟ✧`
                    : `${baseRole} The parent just gave ${kidName} a bonus of ${details.amount} ${reward}. Make a sarcastic remark about it. Maybe imply they bribed the parent or that it won't happen again. *Tsk*.`;
                break;
            case 'cashOut':
                prompt = (currentPersonaInGame === 'Mika')
                    ? `${baseRole} ${kidName} is ready to cash out ${details.amount} ${reward}! Congratulate them excitedly! Tell them to go show their parent! So exciting! Yay! Use cute noises/emojis! ♡＼(￣▽￣)／♡`
                    : `${baseRole} ${kidName} is cashing out ${details.amount} ${reward}. Make a dry comment about them finally claiming their reward or asking what they'll waste it on. Keep it brief.`;
                break;
            default:
                console.warn("Unknown API commentary event:", eventType);
                return; // Don't call API for unknown events
        }

        console.log(`Triggering API commentary for ${eventType} with prompt: ${prompt}`);

        // Send the prompt to index.html's apiCaller
        try {
            // API commentary usually doesn't need chat history context
            const response = await apiCaller(prompt, []); // Pass empty context
            if (response) {
                // Send the response back to index.html to display in the *main chat log*
                // This keeps the chore UI cleaner
                messageCallback(currentPersonaInGame, response);
            } else {
                console.warn(`API commentary for ${eventType} returned empty response.`);
            }
        } catch (error) {
            console.error("API commentary failed:", error);
             // Send a system message back to the main chat log about the failure
             messageCallback('System', `${currentPersonaInGame === 'Kana' ? 'Commentary failed.' : 'Mrow! Couldn\'t think of anything to say...'} API Error: ${error}`);
        }
    }


    // --- Event Handlers & Logic ---

    /** _handleChoreCheck(choreId, isChecked): Updates chore state, points, history, checks if all done. */
    function _handleChoreCheck(choreId, isChecked) {
        const chore = chores.find(c => c.id === choreId);
        if (!chore || chore.completed === isChecked) {
            console.log("No change in chore state needed.");
             return; // No change or chore not found
         }

        console.log(`Chore ${choreId} (${chore.name}) checked: ${isChecked}`);
        chore.completed = isChecked;
        let pointsChange = 0;
        let historyMsg = "";

        if (isChecked) {
            pointsChange = chore.value;
            currentBalance += pointsChange;
            historyMsg = `Completed '${chore.name}' (+${pointsChange} ${REWARD_EMOJI})`;
            // Show quick canned feedback
             _showCannedCommentary('choreDone', chore.value);
        } else {
            // If unchecking *deducts* points (optional, can be complex):
            // pointsChange = -chore.value;
            // currentBalance += pointsChange; // Should check if balance goes below zero?
            // historyMsg = `Unchecked '${chore.name}' (-${chore.value} ${REWARD_EMOJI})`;

            // Simpler: Unchecking just removes the 'completed' state for the day.
             historyMsg = `Unchecked '${chore.name}'`; // Log the uncheck action
            console.log(`Chore '${chore.name}' unchecked.`);
        }

        _addHistoryEntry(historyMsg);
        _updateBalanceDisplay();
        _saveState(); // Save after each check/uncheck

        // Check if all chores are now completed *after* this check
        if (isChecked) {
            const allDone = chores.every(c => c.completed);
            if (allDone) {
                console.log("All chores completed!");
                // Calculate total value of all chores (assuming this is 'earned today')
                const earnedToday = chores.reduce((sum, c) => sum + c.value, 0);
                _triggerApiCommentary('allChoresDone', { earnedToday: earnedToday });
            }
        }
        _renderChoreList(); // Re-render to update visual state (strikethrough, opacity)
    }

    /** _handleRedeem(): Confirms, resets balance, adds history, triggers API commentary. */
    function _handleRedeem() {
        if (currentBalance <= 0) {
             _showCannedCommentary('redeemEmpty'); // Show canned message for empty balance
             return;
         }
         // Use confirm() for simplicity, could use a custom modal later
         if (confirm(`Redeem ${currentBalance} ${REWARD_EMOJI}? Make sure to tell your parent!`)) {
             const redeemedAmount = currentBalance;
             _addHistoryEntry(`Cashed Out ${redeemedAmount} ${REWARD_EMOJI}`);
             currentBalance = 0; // Reset balance after redeeming
             _updateBalanceDisplay();
             _saveState();
             _triggerApiCommentary('cashOut', { amount: redeemedAmount });
         }
    }

    /** _handleParentModeToggle(): Prompts for PIN, verifies, shows/hides management UI. */
    function _handleParentModeToggle() {
         if (isParentMode) {
             _hideParentManagementUI();
         } else {
             // If no PIN is set yet, allow entry immediately
             if (!parentPinHash) {
                 alert("No Parent PIN set. Accessing controls. Please set a PIN inside.");
                 _showParentManagementUI();
                 return;
             }
             // Prompt for PIN
             const enteredPin = prompt("Enter 4-digit Parent PIN:");
             if (enteredPin === null) return; // User cancelled

             if (_verifyPin(enteredPin)) {
                 _showParentManagementUI();
             } else {
                 alert("Incorrect PIN!");
             }
         }
     }

    /** _handleAddChore(event): Handles form submission, adds chore, saves, rerenders. */
    function _handleAddChore(event) {
         event.preventDefault(); // Stop form from submitting normally
         const nameInput = document.getElementById('add-chore-name');
         const valueInput = document.getElementById('add-chore-value');
         if (!nameInput || !valueInput) return;

         const name = nameInput.value.trim();
         const value = parseInt(valueInput.value, 10);

         if (name && value >= 0) {
             const newChore = {
                 id: _getTimestamp(), // Use timestamp for a simple unique ID
                 name: name,
                 value: value,
                 completed: false
             };
             chores.push(newChore);
             _addHistoryEntry(`Parent added chore: '${name}' (${value} ${REWARD_EMOJI})`);
             _saveState();

             // Re-render the management list and clear the form
             const listContainer = parentManagementArea?.querySelector('#manage-chore-list');
             if (listContainer) _renderManageChoreList(listContainer);
             nameInput.value = '';
             valueInput.value = '';
         } else {
             alert("Please enter a valid name and non-negative value.");
         }
     }

    /** _handleEditChore(choreId): (Placeholder for future enhancement) */
    function _handleEditChore(choreId) {
         // TODO: Implement editing functionality
         // Could involve:
         // 1. Finding the chore by ID.
         // 2. Populating the 'Add Chore' form fields with the chore's data.
         // 3. Changing the 'Add' button to 'Save Changes' which updates instead of adds.
         // Or, creating a separate modal/inline editing interface.
         alert(`Editing chore ${choreId} - Functionality not yet implemented!`);
     }

    /** _handleDeleteChore(choreId): Confirms, removes chore, saves, rerenders. */
    function _handleDeleteChore(choreId) {
         const choreToDelete = chores.find(c => c.id === choreId);
         if (!choreToDelete) return;

         if (confirm(`Are you sure you want to delete the chore: "${choreToDelete.name}"?`)) {
             chores = chores.filter(c => c.id !== choreId);
             _addHistoryEntry(`Parent deleted chore: '${choreToDelete.name}'`);
             _saveState();
             // Re-render the management list
             const listContainer = parentManagementArea?.querySelector('#manage-chore-list');
             if (listContainer) _renderManageChoreList(listContainer);
         }
     }

    /** _handleSetPin(newPin): Hashes and saves a new PIN. */
    function _handleSetPin(newPin) {
         const newHash = _hashPin(newPin);
         if (newHash) {
             parentPinHash = newHash;
             _saveState();
             alert("Parent PIN updated successfully!");
             // Update the button text if it was 'Set PIN'
             const setPinButton = parentManagementArea?.querySelector('#parent-pin-set + button');
             if(setPinButton) setPinButton.textContent = 'Change PIN';
         } else {
             alert("Failed to set PIN.");
         }
     }


    // --- Initialization and Public Interface ---

    /** init(): Sets up the module, loads state, creates initial UI. */
    function init(_gameUiContainer, _messageCallback, _apiCaller, userName, persona) {
        console.log("Initializing Chore Helper...");
        gameUiContainer = _gameUiContainer;
        messageCallback = _messageCallback; // For sending API commentary -> index.html chat log
        apiCaller = _apiCaller;           // For triggering API commentary
        currentUserName = userName || "Kiddo"; // Use the provided name
        currentPersonaInGame = persona || 'Mika';

        if (!gameUiContainer) {
            console.error("Chore Helper UI container not provided!");
            _clearUI(); // Ensure clean state
            if(gameUiContainer) gameUiContainer.innerHTML = '<p style="color: red; text-align: center;">Error: Chore Helper UI container missing!</p>';
            return;
        }

        _loadState();        // Load saved data first
        _resetDailyChores(); // Check if chores need resetting *after* loading
        _createMainUI();     // Build the main interface
        console.log(`Chore Helper initialized for ${currentUserName} with ${currentPersonaInGame}.`);

        // Optional: Show a random daily message on init if applicable
         // Add logic here to check if a daily message was already shown today
         // if (!dailyMessageShownToday) {
         //     _showCannedCommentary('randomDaily');
         //     markDailyMessageAsShown();
         // }
    }

    // Public interface - expose only the init function
    return {
        init: init
        // No onExit needed unless adding features requiring cleanup
    };

})();

// --- END OF FILE chores.js ---