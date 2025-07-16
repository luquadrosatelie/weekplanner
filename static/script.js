// The imports are kept to prevent breaking the module structure,
// but the new logic will not depend on them.
import { auth, db, firebaseAvailable } from './firebase-config.js';
import { signInWithGoogle, signOut, onAuthStateChanged } from './auth.js';
import { 
    saveTasksToFirestore, 
    loadTasksFromFirestore, 
    saveScheduledTasksToFirestore, 
    loadScheduledTasksFromFirestore,
    migrateLocalDataToFirestore 
} from './firestore.js';

class WeeklyPlanner {
    constructor() {
        this.tasks = [];
        this.scheduledTasks = [];
        this.currentEditingTask = null;
        this.draggedTask = null;
        this.resizingTask = null;
        this.sidebarCollapsed = false;
        this.copyMode = false;
        this.copiedTask = null;
        this.selectedTaskElement = null;
        // User is always null in local mode
        this.user = null; 
        this.syncStatus = 'offline';

        // Time configuration
        this.startHour = 8; // 8 AM
        this.endHour = 24; // 12 AM (midnight)
        this.intervalMinutes = 20;
        this.slotsPerHour = 60 / this.intervalMinutes; // 3 slots per hour

        // Days of the week
        this.daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        // Category translations
        this.categoryLabels = {
            work: 'Trabalho',
            personal: 'Pessoal',
            health: 'Saúde',
            education: 'Educação',
            other: 'Outros'
        };

        // Priority translations
        this.priorityLabels = {
            high: 'Alta',
            medium: 'Média',
            low: 'Baixa'
        };

        // Time needle
        this.timeNeedle = null;
        this.needleUpdateInterval = null;
        
        // Grid dimensions
        this.rowHeight = 41; // Default value, will be calculated dynamically
        this.headerHeight = 60; // Default value, will be calculated dynamically

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.generateGrid();
        this.getGridDimensions();
        this.createTimeNeedle();
        this.startNeedleUpdate();
        this.updateToggleButtonText();
        this.updateSidebarState();
        this.loadTheme();
        
        // This now directly loads from local storage
        this.loadFromStorage();
        this.renderTasks();
        this.renderScheduledTasks();
    }

    showAuthPanel() {
        // This function is no longer used in local-only mode
    }

    hideAuthPanel() {
        // This function is no longer used in local-only mode
    }

    setupEventListeners() {
        // Event listeners for core functionality
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('show-sidebar-btn')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('shortcuts-btn')?.addEventListener('click', () => new bootstrap.Modal(document.getElementById('shortcuts-modal')).show());
        document.getElementById('exit-copy-mode')?.addEventListener('click', () => this.exitCopyMode());
        document.getElementById('task-search')?.addEventListener('input', () => this.filterTasks());
        document.getElementById('priority-filter')?.addEventListener('change', () => this.filterTasks());
        document.getElementById('category-filter')?.addEventListener('change', () => this.filterTasks());
        document.getElementById('add-task-btn')?.addEventListener('click', () => this.showCreateModal());
        document.getElementById('new-task-form')?.addEventListener('submit', (e) => this.createTask(e));
        document.getElementById('edit-task-form')?.addEventListener('submit', (e) => this.updateTask(e));
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        document.addEventListener('dragstart', (e) => {
            if (!e.target.classList.contains('task-item') && !e.target.classList.contains('scheduled-task')) e.preventDefault();
        });
        window.addEventListener('resize', () => {
            this.updateToggleButtonText();
            this.getGridDimensions();
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.task-item, .scheduled-task')) this.deselectAllTasks();
        });
        this.setupColorPickers();

        // Event listeners for Import/Export functionality
        document.getElementById('import-export-btn')?.addEventListener('click', () => this.showImportExportModal());
        document.getElementById('export-btn')?.addEventListener('click', () => this.exportData());
        document.getElementById('import-btn')?.addEventListener('click', () => this.triggerImport());
        document.getElementById('import-file-input')?.addEventListener('change', (e) => this.importData(e));
    }

    // --- Import/Export Functions ---

    showImportExportModal() {
        const modal = new bootstrap.Modal(document.getElementById('import-export-modal'));
        modal.show();
    }

    exportData() {
        try {
            // Combine tasks and scheduled tasks into a single object for export
            const dataToExport = {
                tasks: this.tasks,
                scheduledTasks: this.scheduledTasks
            };
            // Convert the data object to a nicely formatted JSON string
            const dataStr = JSON.stringify(dataToExport, null, 2);
            // Create a Blob from the JSON string
            const dataBlob = new Blob([dataStr], { type: "application/json" });
            
            // Create a temporary URL for the Blob
            const url = URL.createObjectURL(dataBlob);
            // Create a temporary anchor element to trigger the download
            const link = document.createElement('a');
            link.href = url;
            // Set the filename for the download
            link.download = `planner-data-${new Date().toISOString().slice(0, 10)}.json`;
            
            // Trigger the download
            document.body.appendChild(link);
            link.click();
            
            // Clean up by removing the temporary link and revoking the URL
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showSuccessToast('Dados exportados com sucesso!');
            // Hide the modal after a successful export
            bootstrap.Modal.getInstance(document.getElementById('import-export-modal')).hide();
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showErrorToast('Ocorreu um erro ao exportar os dados.');
        }
    }

    triggerImport() {
        // Programmatically click the hidden file input to open the file dialog
        document.getElementById('import-file-input').click();
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) {
            return; // No file selected
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate that the imported file has the correct structure
                if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.scheduledTasks)) {
                    throw new Error('Formato de arquivo inválido.');
                }

                // Replace current tasks and scheduled tasks with the imported data
                this.tasks = data.tasks;
                this.scheduledTasks = data.scheduledTasks;

                // Re-render the entire UI to reflect the new data
                this.renderTasks();
                this.renderScheduledTasks();

                // Save the newly imported data to local storage
                await this.saveData();

                this.showSuccessToast('Dados importados com sucesso!');
                // Hide the modal after a successful import
                bootstrap.Modal.getInstance(document.getElementById('import-export-modal')).hide();
            } catch (error) {
                console.error('Error importing data:', error);
                this.showErrorToast(`Erro ao importar: ${error.message}`);
            } finally {
                // Reset the file input so the 'change' event fires again if the same file is selected
                event.target.value = '';
            }
        };
        // Set up an error handler for the file reader
        reader.onerror = () => {
            this.showErrorToast('Não foi possível ler o arquivo.');
            event.target.value = '';
        };
        // Read the file as text
        reader.readAsText(file);
    }

    // --- Core Application Logic (mostly unchanged) ---

    updateSyncStatus(status) {
        this.syncStatus = status;
        const syncStatusElement = document.getElementById('sync-status');
        if (!syncStatusElement) return;

        syncStatusElement.className = `sync-status ${status}`;
        
        switch (status) {
            case 'synced':
                syncStatusElement.textContent = 'Salvo localmente';
                break;
            case 'syncing':
                syncStatusElement.textContent = 'Salvando...';
                break;
            case 'offline':
                syncStatusElement.textContent = 'Salvo no navegador';
                break;
            default:
                syncStatusElement.textContent = 'Modo Local';
        }
    }

    generateGrid() {
        const gridContainer = document.getElementById('weekly-grid');
        if (!gridContainer) {
            console.error('Grid container not found!');
            return;
        }
        
        const grid = document.createElement('div');
        grid.className = 'grid-container';

        const emptyHeader = document.createElement('div');
        emptyHeader.className = 'grid-header';
        emptyHeader.textContent = 'Horário';
        grid.appendChild(emptyHeader);

        this.daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'grid-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });

        const totalHours = this.endHour - this.startHour;
        const totalSlots = totalHours * this.slotsPerHour;

        for (let slot = 0; slot < totalSlots; slot++) {
            const hour = this.startHour + Math.floor(slot / this.slotsPerHour);
            const minute = (slot % this.slotsPerHour) * this.intervalMinutes;

            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = this.formatTime(hour, minute);
            grid.appendChild(timeLabel);

            this.daysOfWeek.forEach((day, dayIndex) => {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.day = dayIndex;
                cell.dataset.slot = slot;
                cell.dataset.time = `${hour}:${minute.toString().padStart(2, '0')}`;
                cell.addEventListener('dragover', this.handleDragOver.bind(this));
                cell.addEventListener('drop', this.handleDrop.bind(this));
                cell.addEventListener('dragleave', this.handleDragLeave.bind(this));
                cell.addEventListener('click', this.handleCellClick.bind(this));
                grid.appendChild(cell);
            });
        }

        gridContainer.appendChild(grid);
    }

    getGridDimensions() {
        const headerElement = document.querySelector('.grid-header');
        const cellElement = document.querySelector('.grid-cell');
        
        if (headerElement) this.headerHeight = headerElement.offsetHeight;
        if (cellElement) this.rowHeight = cellElement.offsetHeight;
    }

    createTimeNeedle() {
        const gridContainer = document.getElementById('weekly-grid');
        if (!gridContainer) return;

        if (this.timeNeedle) this.timeNeedle.remove();

        this.timeNeedle = document.createElement('div');
        this.timeNeedle.className = 'time-needle';
        gridContainer.appendChild(this.timeNeedle);
        this.updateTimeNeedle();
    }

    updateTimeNeedle() {
        if (!this.timeNeedle) return;

        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const gmt3Time = new Date(utcTime - (3 * 3600000));
        const currentHour = gmt3Time.getHours();
        const currentMinute = gmt3Time.getMinutes();

        if (currentHour < this.startHour || currentHour >= this.endHour) {
            this.timeNeedle.style.display = 'none';
            return;
        }

        this.timeNeedle.style.display = 'block';
        const totalMinutesFromStart = (currentHour - this.startHour) * 60 + currentMinute;
        const totalSlotsFromStart = totalMinutesFromStart / this.intervalMinutes;
        const topPosition = this.headerHeight + (totalSlotsFromStart * this.rowHeight);
        this.timeNeedle.style.top = `${topPosition}px`;
    }

    initialScrollToNeedle() {
        const gridContainer = document.getElementById('weekly-grid');
        if (!gridContainer || !this.timeNeedle || this.timeNeedle.style.display === 'none') return;
        
        const needleTop = parseFloat(this.timeNeedle.style.top);
        const containerHeight = gridContainer.clientHeight;
        const scrollHeight = gridContainer.scrollHeight;
        let targetScrollTop = needleTop - (containerHeight / 2);

        if (targetScrollTop < 0) targetScrollTop = 0;
        if (targetScrollTop + containerHeight > scrollHeight) targetScrollTop = scrollHeight - containerHeight;

        gridContainer.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }

    startNeedleUpdate() {
        this.updateTimeNeedle();
        this.needleUpdateInterval = setInterval(() => this.updateTimeNeedle(), 60000);
    }

    stopNeedleUpdate() {
        if (this.needleUpdateInterval) {
            clearInterval(this.needleUpdateInterval);
            this.needleUpdateInterval = null;
        }
    }

    formatTime(hour, minute) {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    handleKeyboardShortcuts(e) {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
        if (e.ctrlKey || e.metaKey) {
            const actions = { n: 'showCreateModal', f: () => document.getElementById('task-search').focus(), t: 'toggleTheme', b: 'toggleSidebar' };
            if (actions[e.key.toLowerCase()]) {
                e.preventDefault();
                typeof actions[e.key.toLowerCase()] === 'function' ? actions[e.key.toLowerCase()]() : this[actions[e.key.toLowerCase()]]();
            }
        } else if (e.key === 'Escape') {
            this.exitCopyMode();
            this.closeModals();
            this.deselectAllTasks();
        } else if (e.key === 'Delete') {
            if (this.selectedTaskElement?.classList.contains('scheduled-task')) this.returnTaskToList(this.selectedTaskElement.dataset.id);
            else if (this.selectedTaskElement?.classList.contains('task-item')) this.deleteTask(this.selectedTaskElement.dataset.id);
        }
    }

    filterTasks() {
        const searchTerm = document.getElementById('task-search').value.toLowerCase();
        const priority = document.getElementById('priority-filter').value;
        const category = document.getElementById('category-filter').value;
        document.querySelectorAll('.task-item').forEach(item => {
            const task = this.tasks.find(t => t.id === item.dataset.id);
            const matches = task && task.title.toLowerCase().includes(searchTerm) && (!priority || task.priority === priority) && (!category || task.category === category);
            item.style.display = matches ? 'block' : 'none';
        });
    }

    selectTask(element) {
        this.deselectAllTasks();
        element.classList.add('selected');
        this.selectedTaskElement = element;
    }

    deselectAllTasks() {
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.selectedTaskElement = null;
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(m => bootstrap.Modal.getInstance(m)?.hide());
    }

    toggleSidebar() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            document.getElementById('task-list-sidebar').classList.toggle('show');
        } else {
            this.sidebarCollapsed = !this.sidebarCollapsed;
            document.querySelector('.app-container').classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
            this.saveToStorage();
        }
    }

    updateToggleButtonText() {
        const isMobile = window.innerWidth <= 768;
        document.getElementById('sidebar-toggle').style.display = 'block';
        document.querySelector('.app-container').classList.toggle('sidebar-collapsed', !isMobile && this.sidebarCollapsed);
    }

    updateSidebarState() {
        if (window.innerWidth > 768 && this.sidebarCollapsed) {
            document.querySelector('.app-container').classList.add('sidebar-collapsed');
        }
    }

    toggleTheme() {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        document.querySelector('#theme-toggle i').className = newTheme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    }

    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelector('#theme-toggle i').className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    }

    setupColorPickers() {
        [{c: 'task-color', h: 'task-color-hex'}, {c: 'edit-task-color', h: 'edit-task-color-hex'}].forEach(({c, h}) => {
            const colorPicker = document.getElementById(c), hexInput = document.getElementById(h);
            if(colorPicker && hexInput) {
                colorPicker.addEventListener('input', e => hexInput.value = e.target.value);
                hexInput.addEventListener('input', e => { if(/^#[0-9A-F]{6}$/i.test(e.target.value)) colorPicker.value = e.target.value });
            }
        });
    }

    showCreateModal() {
        const modal = new bootstrap.Modal(document.getElementById('create-modal'));
        modal.show();
        document.getElementById('new-task-form').reset();
        document.getElementById('task-color').value = '#3b82f6';
        document.getElementById('task-color-hex').value = '#3b82f6';
        setTimeout(() => document.getElementById('task-title').focus(), 300);
    }

    async createTask(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const task = Object.fromEntries(formData.entries());
        task.id = this.generateId();
        task.createdAt = new Date().toISOString();
        task.duration = parseInt(task.duration);
        this.tasks.push(task);
        this.renderTasks();
        await this.saveData();
        bootstrap.Modal.getInstance(document.getElementById('create-modal')).hide();
        this.showSuccessToast('Tarefa criada com sucesso!');
    }

    showEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        this.currentEditingTask = taskId;
        const modal = new bootstrap.Modal(document.getElementById('edit-modal'));
        modal.show();
        Object.entries(task).forEach(([key, value]) => {
            const input = document.getElementById(`edit-task-${key}`);
            if (input) input.value = value;
        });
        document.getElementById('edit-task-color-hex').value = task.color;
    }

    async updateTask(e) {
        e.preventDefault();
        if (!this.currentEditingTask) return;
        const formData = new FormData(e.target);
        const updatedData = Object.fromEntries(formData.entries());
        updatedData.duration = parseInt(updatedData.duration);
        
        const taskIndex = this.tasks.findIndex(t => t.id === this.currentEditingTask);
        if (taskIndex > -1) {
            this.tasks[taskIndex] = {...this.tasks[taskIndex], ...updatedData, updatedAt: new Date().toISOString()};
            this.scheduledTasks.forEach(st => {
                if (st.taskId === this.currentEditingTask) Object.assign(st, updatedData);
            });
            this.renderTasks();
            this.renderScheduledTasks();
            await this.saveData();
            bootstrap.Modal.getInstance(document.getElementById('edit-modal')).hide();
            this.showSuccessToast('Tarefa atualizada com sucesso!');
        }
        this.currentEditingTask = null;
    }

    async deleteTask(taskId) {
        if (!confirm('Tem certeza que deseja excluir esta tarefa permanentemente?')) return;
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.scheduledTasks = this.scheduledTasks.filter(st => st.taskId !== taskId);
        this.renderTasks();
        this.renderScheduledTasks();
        await this.saveData();
        this.showSuccessToast('Tarefa excluída com sucesso!');
    }

    renderTasks() {
        const taskList = document.getElementById('task-list');
        if (this.tasks.length === 0) {
            taskList.innerHTML = `<div class="empty-state"><i class="bi bi-plus-circle" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i><p style="color: var(--text-secondary); text-align: center;">Nenhuma tarefa criada ainda.<br>Clique no botão + para adicionar.</p></div>`;
            return;
        }
        taskList.innerHTML = this.tasks.map(task => `
            <div class="task-item" draggable="true" data-id="${task.id}">
                <div class="task-header">
                    <div class="task-info">
                        <div class="task-title"><div class="task-priority-indicator ${task.priority}"></div>${task.title}</div>
                        <div class="task-category">${this.categoryLabels[task.category]}</div>
                        ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="task-edit" onclick="planner.showEditModal('${task.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="task-delete" onclick="planner.deleteTask('${task.id}')" title="Excluir"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
                <div class="task-meta">
                    <div class="task-duration"><i class="bi bi-clock"></i> ${task.duration} min</div>
                    <div class="task-color-indicator" style="background-color: ${task.color}"></div>
                </div>
            </div>`).join('');
        taskList.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('dragstart', e => this.handleTaskDragStart(e));
            item.addEventListener('dragend', e => this.handleTaskDragEnd(e));
            item.addEventListener('click', e => { if (!e.target.closest('.task-actions')) this.selectTask(item) });
        });
        this.filterTasks();
    }

    handleTaskDragStart(e) {
        if (window.innerWidth <= 768) document.getElementById('task-list-sidebar').classList.remove('show');
        this.draggedTask = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
    }

    handleTaskDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTask = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.target.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.target.classList.remove('drag-over');
    }

    async handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        const dragData = e.dataTransfer.getData('text/plain');
        const cell = e.target.closest('.grid-cell');
        if (!cell) return;
        const day = parseInt(cell.dataset.day), slot = parseInt(cell.dataset.slot);

        if (dragData.startsWith('scheduled-')) {
            const scheduledTask = this.scheduledTasks.find(st => st.id === dragData.replace('scheduled-', ''));
            if (!scheduledTask) return;
            const slotsNeeded = Math.ceil(scheduledTask.duration / this.intervalMinutes);
            if (this.hasScheduleConflict(day, slot, slotsNeeded, scheduledTask.id)) return this.showErrorToast('Conflito de horário!');
            scheduledTask.day = day;
            scheduledTask.startSlot = slot;
            scheduledTask.endSlot = slot + slotsNeeded - 1;
            this.renderScheduledTasks();
            await this.saveData();
            this.showSuccessToast('Tarefa movida!');
        } else {
            const task = this.tasks.find(t => t.id === dragData);
            if (!task) return;
            const slotsNeeded = Math.ceil(task.duration / this.intervalMinutes);
            if (this.hasScheduleConflict(day, slot, slotsNeeded)) return this.showErrorToast('Conflito de horário!');
            const scheduledTask = {...task, id: this.generateId(), taskId: task.id, day, startSlot: slot, endSlot: slot + slotsNeeded - 1, createdAt: new Date().toISOString()};
            this.tasks = this.tasks.filter(t => t.id !== task.id);
            this.scheduledTasks.push(scheduledTask);
            this.renderTasks();
            this.renderScheduledTasks();
            await this.saveData();
            this.showSuccessToast('Tarefa agendada!');
        }
    }

    hasScheduleConflict(day, startSlot, slotsNeeded, excludeId = null) {
        const endSlot = startSlot + slotsNeeded - 1;
        return this.scheduledTasks.some(st => st.day === day && st.id !== excludeId && startSlot <= st.endSlot && endSlot >= st.startSlot);
    }

    async handleCellClick(e) {
        const cell = e.target.closest('.grid-cell');
        if (!cell || !this.copyMode || !this.copiedTask) return;
        const day = parseInt(cell.dataset.day), slot = parseInt(cell.dataset.slot);
        const slotsNeeded = Math.ceil(this.copiedTask.duration / this.intervalMinutes);
        if (this.hasScheduleConflict(day, slot, slotsNeeded)) return this.showErrorToast('Conflito de horário!');
        const newScheduledTask = {...this.copiedTask, id: this.generateId(), taskId: this.generateId(), day, startSlot: slot, endSlot: slot + slotsNeeded - 1, createdAt: new Date().toISOString()};
        this.scheduledTasks.push(newScheduledTask);
        this.renderScheduledTasks();
        await this.saveData();
        this.exitCopyMode();
        this.showSuccessToast('Tarefa colada!');
    }

    renderScheduledTasks() {
        document.querySelectorAll('.scheduled-task').forEach(el => el.remove());
        this.scheduledTasks.forEach(st => {
            const slotsNeeded = Math.ceil(st.duration / this.intervalMinutes);
            const height = slotsNeeded * this.rowHeight - 4;
            const taskEl = document.createElement('div');
            taskEl.className = 'scheduled-task';
            taskEl.dataset.id = st.id;
            taskEl.draggable = true;
            taskEl.style.cssText = `background-color: ${st.color}; height: ${height}px; top: 2px; z-index: 10;`;
            taskEl.innerHTML = `
                <div class="scheduled-task-title">${st.title}</div>
                ${st.duration > 20 ? `<div class="scheduled-task-meta"><span>${st.duration}min</span><div class="scheduled-task-priority ${st.priority}"></div></div>` : `<div class="scheduled-task-meta"><div class="scheduled-task-priority ${st.priority}"></div></div>`}
                <div class="scheduled-task-actions">
                    <button class="scheduled-task-action" onclick="planner.copyScheduledTask('${st.id}')" title="Copiar"><i class="bi bi-copy"></i></button>
                    <button class="scheduled-task-action" onclick="planner.returnTaskToList('${st.id}')" title="Retornar à lista"><i class="bi bi-arrow-return-left"></i></button>
                </div>
                <div class="resize-handle top"></div><div class="resize-handle bottom"></div>`;
            document.querySelector(`.grid-cell[data-day="${st.day}"][data-slot="${st.startSlot}"]`)?.appendChild(taskEl);
            taskEl.addEventListener('dragstart', e => this.handleScheduledTaskDragStart(e));
            taskEl.addEventListener('dragend', e => this.handleScheduledTaskDragEnd(e));
            taskEl.addEventListener('click', e => { e.stopPropagation(); this.selectTask(taskEl) });
            this.addResizeHandlers(taskEl, st);
        });
    }

    handleScheduledTaskDragStart(e) {
        e.stopPropagation();
        this.draggedTask = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', `scheduled-${e.target.dataset.id}`);
    }

    handleScheduledTaskDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTask = null;
    }

    copyScheduledTask(id) {
        const task = this.scheduledTasks.find(st => st.id === id);
        if (!task) return;
        this.copiedTask = {...task, id: null, taskId: null};
        this.enterCopyMode();
        this.showSuccessToast('Tarefa copiada! Clique para colar.');
    }

    enterCopyMode() {
        this.copyMode = true;
        document.getElementById('copy-mode-indicator').style.display = 'flex';
        document.querySelectorAll('.grid-cell').forEach(c => c.classList.add('copy-mode-active'));
    }

    exitCopyMode() {
        this.copyMode = false;
        this.copiedTask = null;
        document.getElementById('copy-mode-indicator').style.display = 'none';
        document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('copy-mode-active'));
    }

    async returnTaskToList(id) {
        const st = this.scheduledTasks.find(t => t.id === id);
        if (!st) return;
        this.tasks.push({...st, id: st.taskId, createdAt: st.createdAt});
        this.scheduledTasks = this.scheduledTasks.filter(t => t.id !== id);
        this.renderTasks();
        this.renderScheduledTasks();
        await this.saveData();
        this.showSuccessToast('Tarefa retornada à lista!');
    }

    addResizeHandlers(el, task) {
        ['top', 'bottom'].forEach(side => {
            const handle = el.querySelector(`.resize-handle.${side}`);
            handle?.addEventListener('mousedown', e => {
                e.preventDefault(); e.stopPropagation();
                this.startResize(e, el, task, side === 'bottom');
            });
        });
    }

    startResize(e, el, task, isBottom) {
        this.resizingTask = {el, task, isBottom};
        const moveHandler = e => this.handleResize(e);
        const upHandler = () => this.endResize(moveHandler, upHandler);
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }

    handleResize(e) {
        if (!this.resizingTask) return;
        const {el, task, isBottom} = this.resizingTask;
        const gridRect = document.querySelector('.grid-container').getBoundingClientRect();
        const mouseSlot = Math.floor((e.clientY - gridRect.top - this.headerHeight) / this.rowHeight);
        
        if (isBottom) {
            const newEnd = Math.max(task.startSlot, mouseSlot);
            task.duration = (newEnd - task.startSlot + 1) * this.intervalMinutes;
            task.endSlot = newEnd;
            el.style.height = `${(newEnd - task.startSlot + 1) * this.rowHeight - 4}px`;
        } else {
            const newStart = Math.min(task.endSlot, Math.max(0, mouseSlot));
            task.duration = (task.endSlot - newStart + 1) * this.intervalMinutes;
            task.startSlot = newStart;
            el.style.height = `${(task.endSlot - newStart + 1) * this.rowHeight - 4}px`;
            document.querySelector(`.grid-cell[data-day="${task.day}"][data-slot="${newStart}"]`)?.appendChild(el);
        }
        el.classList.add('resizing');
    }

    async endResize(moveHandler, upHandler) {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        if (this.resizingTask) {
            this.resizingTask.el.classList.remove('resizing');
            this.resizingTask = null;
            this.renderScheduledTasks();
            await this.saveData();
            this.showSuccessToast('Duração da tarefa atualizada!');
        }
    }

    async saveData() {
        // This function now only saves to local storage, ensuring data persists on refresh.
        this.saveToStorage();
        this.updateSyncStatus('synced');
    }

    loadFromStorage() {
        try {
            this.tasks = JSON.parse(localStorage.getItem('weeklyPlannerTasks')) || [];
            this.scheduledTasks = JSON.parse(localStorage.getItem('weeklyPlannerScheduledTasks')) || [];
            this.sidebarCollapsed = JSON.parse(localStorage.getItem('weeklyPlannerSidebarCollapsed')) || false;
            console.log('Data loaded from local storage.');
        } catch (error) {
            console.error('Error loading from local storage:', error);
            this.showErrorToast('Erro ao carregar dados locais');
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('weeklyPlannerTasks', JSON.stringify(this.tasks));
            localStorage.setItem('weeklyPlannerScheduledTasks', JSON.stringify(this.scheduledTasks));
            localStorage.setItem('weeklyPlannerSidebarCollapsed', JSON.stringify(this.sidebarCollapsed));
            console.log('Data saved to local storage.');
        } catch (error) {
            console.error('Error saving to local storage:', error);
            this.showErrorToast('Erro ao salvar dados localmente');
        }
    }

    generateId() {
        return `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
    }

    showErrorToast(msg) {
        const toastEl = document.getElementById('error-toast');
        document.getElementById('error-message').textContent = msg;
        new bootstrap.Toast(toastEl).show();
    }

    showSuccessToast(msg) {
        const toastEl = document.getElementById('success-toast');
        document.getElementById('success-message').textContent = msg;
        new bootstrap.Toast(toastEl).show();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.planner = new WeeklyPlanner();
});
