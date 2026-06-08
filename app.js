// JavaScript for Guías Pediátricas

// This script handles authentication, form handling, storage and display of
// both parent‑oriented guides and doctor‑oriented guides. Each guide is
// persisted in localStorage under the key `guides` and carries a `type`
// property (either 'parent' or 'doctor'). The owner (authenticated user)
// can create, edit and delete guides while guests can only view and
// download them.

document.addEventListener('DOMContentLoaded', () => {
  // Optional reset of localStorage: if the URL contains '?reset', clear stored data.
  try {
    if (window.location && window.location.search && window.location.search.includes('reset')) {
      localStorage.removeItem('ownerUsername');
      localStorage.removeItem('ownerPassword');
      localStorage.removeItem('guides');
      localStorage.removeItem('doctorCategoryMaterials');
    }
  } catch (e) {
    // ignore errors if window.location is undefined (e.g., during testing)
  }
  /* ---------------------------------------------------------------------
   * Configuration and category definitions
   * Each category includes an emoji used in the UI to make the app feel
   * friendly and paediatric. Feel free to adjust or extend this list.
   */
  // Global variable to track which dynamic section is currently being
  // dragged.  Used by the drag-and-drop handlers to reorder sections.
  let draggedSection = null;
  // Updated categories list based on user request. Each category has a friendly emoji
  // that reflects the speciality. When choosing emojis, we tried to pick symbols
  // that evoke the body system or context of each subspecialty.
  const CATEGORIES = [
    { name: 'Neonatología', emoji: '👶' },
    { name: 'Cardiología', emoji: '❤️' },
    { name: 'Neumología', emoji: '🌬️' },
    { name: 'Gastroenterología', emoji: '🍽️' },
    { name: 'Nefrología', emoji: '💧' },
    { name: 'Endocrinología', emoji: '🧪' },
    { name: 'Infectología', emoji: '🦠' },
    { name: 'Inmunología / Reumatología', emoji: '🛡️' },
    { name: 'Hemaoncología', emoji: '🩸' },
    { name: 'Alergología', emoji: '🤧' },
    { name: 'Neurología', emoji: '🧠' },
    { name: 'Psiquiatría', emoji: '💭' },
    { name: 'Neurodesarrollo', emoji: '🧩' },
    { name: 'Ginecología', emoji: '🤰' },
    { name: 'Emergencias', emoji: '🚑' },
    { name: 'Medicina hospitalaria', emoji: '🏥' },
    { name: 'UCI', emoji: '🛌' },
    { name: 'Genética', emoji: '🧬' },
    { name: 'Dermatología pediátrica', emoji: '🌸' },
    { name: 'Pediatría general', emoji: '🩺' },
    { name: 'Cirugía pediátrica', emoji: '🩹' },
    { name: 'Ortopedia', emoji: '🦴' },
    { name: 'Otro', emoji: '📂' },
  ];

  /* ---------------------------------------------------------------------
   * Element references
   */
  // Navigation elements
  const navButtons = document.getElementById('navButtons');
  const objectiveBtn = document.getElementById('objectiveBtn');
  const parentLibraryNavBtn = document.getElementById('parentLibraryNavBtn');
  const doctorLibraryNavBtn = document.getElementById('doctorLibraryNavBtn');
  // Navigation for the article summary section
  const articleSummaryNavBtn = document.getElementById('articleSummaryNavBtn');
  // Buttons for creating new guides are now placed inside the library sections
  const parentLibraryCreateBtn = document.getElementById('parentLibraryCreateBtn');
  const doctorLibraryCreateBtn = document.getElementById('doctorLibraryCreateBtn');
  // Buttons to add dynamic sections to forms
  const addParentSectionBtn = document.getElementById('addParentSectionBtn');
  const addDoctorSectionBtn = document.getElementById('addDoctorSectionBtn');
  // Containers for dynamic sections
  const parentSectionsContainer = document.getElementById('parentSectionsContainer');
  const doctorSectionsContainer = document.getElementById('doctorSectionsContainer');
  const logoutBtn = document.getElementById('logoutBtn');

  // Sections
  const objectiveSection = document.getElementById('objectiveSection');
  const parentGuideFormSection = document.getElementById('parentGuideFormSection');
  const doctorGuideFormSection = document.getElementById('doctorGuideFormSection');
  const parentLibrarySection = document.getElementById('parentLibrarySection');
  const doctorLibrarySection = document.getElementById('doctorLibrarySection');

  // Article summary section elements
  const articleSummarySection = document.getElementById('articleSummarySection');
  const articleFileInput = document.getElementById('articleFileInput');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');
  const downloadSummaryBtn = document.getElementById('downloadSummaryBtn');
  const articleSummaryResult = document.getElementById('articleSummaryResult');
  const articleImageResult = document.getElementById('articleImageResult');

  // Variable to store the last generated summary so it can be downloaded as PDF
  let lastGeneratedSummary = '';

  // Forms and libraries
  const parentGuideForm = document.getElementById('parentGuideForm');
  const doctorGuideForm = document.getElementById('doctorGuideForm');
  const parentLibraryFolders = document.getElementById('parentLibraryFolders');
  const doctorLibraryFolders = document.getElementById('doctorLibraryFolders');
  const cancelParentEditBtn = document.getElementById('cancelParentEditBtn');
  const cancelDoctorEditBtn = document.getElementById('cancelDoctorEditBtn');

  // Login elements
  const loginSection = document.getElementById('loginSection');
  const passwordSetup = document.getElementById('passwordSetup');
  const loginFormDiv = document.getElementById('loginForm');
  const setupUsernameInput = document.getElementById('setupUsername');
  const setupPasswordInput = document.getElementById('setupPassword');
  const setPasswordBtn = document.getElementById('setPasswordBtn');
  const loginUsernameInput = document.getElementById('loginUsername');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const guestBtn = document.getElementById('guestBtn');
  const loginError = document.getElementById('loginError');

  /* ---------------------------------------------------------------------
   * State variables
   */
  // Role of the current session: 'owner' or 'guest'
  let role = null;
  // Track ids when editing guides
  let editingParentId = null;
  let editingDoctorId = null;
  // Note: attachments are preserved at the section level via existingAttachments.

  // Default section labels for new guides. These can be edited or removed by the user.
  const DEFAULT_PARENT_SECTIONS = [
    '¿Qué es?',
    '¿Por qué ocurre?',
    '¿Qué síntomas puedo esperar?',
    '¿Cómo se trata?',
    '¿Cuáles son los signos de alarma?',
    'Mensajes clave',
    'Fuentes',
    'Material adicional',
  ];
  const DEFAULT_DOCTOR_SECTIONS = [
    'Historia clínica / machote',
    'Consejos de abordaje',
    'Fuentes',
    'Material adicional',
  ];

  /* ---------------------------------------------------------------------
   * Doctor category materials management
   *
   * The doctor library includes a "Material complementario" section per
   * category. These materials are stored separately from guides as an
   * object in localStorage under the key `doctorCategoryMaterials`. The
   * structure is { [categoryName]: [ { name, data } ] }.
   */

  function loadDoctorMaterials() {
    return JSON.parse(localStorage.getItem('doctorCategoryMaterials') || '{}');
  }

  function saveDoctorMaterials(materials) {
    localStorage.setItem('doctorCategoryMaterials', JSON.stringify(materials));
  }

  /* ---------------------------------------------------------------------
   * Initialise application
   */
  populateCategorySelects();
  initializeAuth();
  setupEventListeners();

  /* ---------------------------------------------------------------------
   * Function Definitions
   */

  // Populate category options in both forms
  function populateCategorySelects() {
    const parentSelect = document.getElementById('parentCategory');
    const doctorSelect = document.getElementById('doctorCategory');
    // Clear any existing options except placeholder
    [parentSelect, doctorSelect].forEach((sel) => {
      // Remove all child nodes except first (placeholder)
      while (sel.options.length > 1) {
        sel.remove(1);
      }
    });
    // Append new options
    CATEGORIES.forEach(({ name }) => {
      const opt1 = document.createElement('option');
      opt1.value = name;
      opt1.textContent = name;
      const opt2 = opt1.cloneNode(true);
      parentSelect.appendChild(opt1);
      doctorSelect.appendChild(opt2);
    });
  }

  // Set up global event listeners
  function setupEventListeners() {
    // Navigation buttons
    objectiveBtn.addEventListener('click', () => {
      showSection('objective');
    });
    parentLibraryNavBtn.addEventListener('click', () => {
      showSection('parentLibrary');
    });
    doctorLibraryNavBtn.addEventListener('click', () => {
      showSection('doctorLibrary');
    });

    // Navigation for the article summary section
    articleSummaryNavBtn.addEventListener('click', () => {
      showSection('articleSummary');
    });
    // Attach create listeners to the library create buttons (inside library sections)
    parentLibraryCreateBtn.addEventListener('click', () => {
      if (role !== 'owner') return;
      openParentForm();
    });
    doctorLibraryCreateBtn.addEventListener('click', () => {
      if (role !== 'owner') return;
      openDoctorForm();
    });
    logoutBtn.addEventListener('click', handleLogout);

    // Cancel edit buttons
    cancelParentEditBtn.addEventListener('click', () => {
      resetParentForm();
      editingParentId = null;
      // Return to library
      showSection('parentLibrary');
    });
    cancelDoctorEditBtn.addEventListener('click', () => {
      resetDoctorForm();
      editingDoctorId = null;
      showSection('doctorLibrary');
    });

    // Parent form submission
    parentGuideForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      // Gather dynamic sections including attachments
      const sections = await collectSections(parentSectionsContainer);
      const guide = {
        id: editingParentId || Date.now().toString(),
        type: 'parent',
        title: parentGuideForm.parentTitle.value.trim(),
        category: parentGuideForm.parentCategory.value,
        date: new Date().toLocaleDateString('es-CR'),
        sections,
      };
      if (editingParentId) {
        updateGuide(guide);
        editingParentId = null;
      } else {
        saveGuide(guide);
      }
      resetParentForm();
      showSection('parentLibrary');
    });

    // Doctor form submission
    doctorGuideForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const sections = await collectSections(doctorSectionsContainer);
      const guide = {
        id: editingDoctorId || Date.now().toString(),
        type: 'doctor',
        title: doctorGuideForm.doctorTitle.value.trim(),
        category: doctorGuideForm.doctorCategory.value,
        date: new Date().toLocaleDateString('es-CR'),
        sections,
      };
      if (editingDoctorId) {
        updateGuide(guide);
        editingDoctorId = null;
      } else {
        saveGuide(guide);
      }
      resetDoctorForm();
      showSection('doctorLibrary');
    });

    // Dynamic section add buttons
    addParentSectionBtn.addEventListener('click', () => {
      addParentSection();
    });
    addDoctorSectionBtn.addEventListener('click', () => {
      addDoctorSection();
    });

    // Generate summary from uploaded article
    if (generateSummaryBtn) {
      generateSummaryBtn.addEventListener('click', handleGenerateSummary);
    }

  // Add listener for downloading the summary as a PDF if the button exists
  if (downloadSummaryBtn) {
    downloadSummaryBtn.addEventListener('click', () => {
      downloadArticleSummary();
    });
  }
  }

  // Collect data from the parent guide form
  function collectParentFormData() {
    // Deprecated: dynamic sections are collected asynchronously during form submission.
    // This stub remains to prevent errors if called elsewhere.
    return {
      id: editingParentId || Date.now().toString(),
      type: 'parent',
      title: parentGuideForm.parentTitle.value.trim(),
      category: parentGuideForm.parentCategory.value,
      date: new Date().toLocaleDateString('es-CR'),
      sections: [],
    };
  }

  // Collect data from the doctor guide form
  function collectDoctorFormData() {
    // Deprecated: dynamic sections are collected asynchronously during form submission.
    return {
      id: editingDoctorId || Date.now().toString(),
      type: 'doctor',
      title: doctorGuideForm.doctorTitle.value.trim(),
      category: doctorGuideForm.doctorCategory.value,
      date: new Date().toLocaleDateString('es-CR'),
      sections: [],
    };
  }

  /* ---------------------------------------------------------------------
   * Dynamic section management
   *
   * The following helper functions handle creation, removal and collection
   * of dynamic sections used in both parent and doctor guide forms. A
   * section includes a question, answer, optional video link and
   * attachments. Attachments are stored as objects with a type ('file'
   * or 'video'), and relevant properties (name, data for files; link
   * for videos). Existing attachments from previously saved guides are
   * preserved in sectionDiv.existingAttachments and rendered in a list.
   */

  /**
   * Render the list of existing attachments for a section. Each list item
   * includes a remove button that removes the attachment from the
   * underlying array and refreshes the list.
   *
   * @param {HTMLElement} sectionDiv The section element
   * @param {HTMLElement} attachList The UL element where attachments appear
   */
  function renderAttachmentList(sectionDiv, attachList) {
    while (attachList.firstChild) {
      attachList.removeChild(attachList.firstChild);
    }
    if (sectionDiv.existingAttachments && Array.isArray(sectionDiv.existingAttachments)) {
      sectionDiv.existingAttachments.forEach((att, index) => {
        const li = document.createElement('li');
        if (att.type === 'file') {
          li.textContent = att.name;
        } else if (att.type === 'video') {
          li.textContent = `Video: ${att.link}`;
        }
        const removeAttBtn = document.createElement('button');
        removeAttBtn.type = 'button';
        removeAttBtn.className = 'remove-attachment-btn';
        removeAttBtn.textContent = 'X';
        removeAttBtn.addEventListener('click', () => {
          sectionDiv.existingAttachments.splice(index, 1);
          renderAttachmentList(sectionDiv, attachList);
        });
        li.appendChild(removeAttBtn);
        attachList.appendChild(li);
      });
    }
  }

  /**
   * Create and append a dynamic section to a given container. Accepts
   * default values for question, answer and attachments from an existing
   * guide. Video attachments are represented by setting the value of
   * the video input; file attachments are stored in existingAttachments
   * and displayed via renderAttachmentList().
   *
   * @param {HTMLElement} container The parent container
   * @param {string} question The default question text
   * @param {string} answer The default answer text
   * @param {Array} attachments Array of attachment objects
   */
  function createDynamicSection(container, question = '', answer = '', attachments = []) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'dynamic-section';
    // Question input
    const questionInput = document.createElement('input');
    questionInput.type = 'text';
    questionInput.placeholder = 'Pregunta o título del apartado';
    questionInput.value = question;
    sectionDiv.appendChild(questionInput);
    // Toolbar for styling and inserting lists/tables
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    // Font family selector
    const fontSelect = document.createElement('select');
    fontSelect.innerHTML = '<option value="">Fuente</option>' +
      '<option value="Arial">Arial</option>' +
      '<option value="Times New Roman">Times New Roman</option>' +
      '<option value="Verdana">Verdana</option>' +
      '<option value="Comic Sans MS">Comic Sans MS</option>';
    toolbar.appendChild(fontSelect);
    // Font size selector
    const sizeSelect = document.createElement('select');
    sizeSelect.innerHTML = '<option value="">Tamaño</option>' +
      '<option value="14px">14 px</option>' +
      '<option value="16px">16 px</option>' +
      '<option value="18px">18 px</option>' +
      '<option value="20px">20 px</option>' +
      '<option value="24px">24 px</option>';
    toolbar.appendChild(sizeSelect);
    // Color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#333333';
    toolbar.appendChild(colorInput);
    // Bold button
    const boldBtn = document.createElement('button');
    boldBtn.type = 'button';
    boldBtn.textContent = 'B';
    boldBtn.style.fontWeight = 'bold';
    toolbar.appendChild(boldBtn);
    // Italic button
    const italicBtn = document.createElement('button');
    italicBtn.type = 'button';
    italicBtn.textContent = 'I';
    italicBtn.style.fontStyle = 'italic';
    toolbar.appendChild(italicBtn);
    // Unordered list button
    const listBtn = document.createElement('button');
    listBtn.type = 'button';
    listBtn.textContent = 'Lista';
    toolbar.appendChild(listBtn);
    // Table button
    const tableBtn = document.createElement('button');
    tableBtn.type = 'button';
    tableBtn.textContent = 'Tabla';
    toolbar.appendChild(tableBtn);

    // Additional controls for table editing
    // Add row button
    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.textContent = 'Fila +';
    toolbar.appendChild(addRowBtn);
    // Remove row button
    const removeRowBtn = document.createElement('button');
    removeRowBtn.type = 'button';
    removeRowBtn.textContent = 'Fila -';
    toolbar.appendChild(removeRowBtn);
    // Add column button
    const addColBtn = document.createElement('button');
    addColBtn.type = 'button';
    addColBtn.textContent = 'Col +';
    toolbar.appendChild(addColBtn);
    // Remove column button
    const removeColBtn = document.createElement('button');
    removeColBtn.type = 'button';
    removeColBtn.textContent = 'Col -';
    toolbar.appendChild(removeColBtn);
    sectionDiv.appendChild(toolbar);
    // Contenteditable div for answer
    const answerDiv = document.createElement('div');
    answerDiv.className = 'answer-editor';
    answerDiv.contentEditable = 'true';
    answerDiv.setAttribute('data-placeholder', 'Contenido o respuesta');
    answerDiv.innerHTML = answer || '';
    sectionDiv.appendChild(answerDiv);
    // Video input
    const videoInput = document.createElement('input');
    videoInput.type = 'text';
    videoInput.placeholder = 'Enlace de video (opcional)';
    videoInput.value = '';
    videoInput.className = 'video-input';
    sectionDiv.appendChild(videoInput);
    // File input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.className = 'file-input';
    sectionDiv.appendChild(fileInput);
    // Attachment list
    const attachList = document.createElement('ul');
    attachList.className = 'attachment-list';
    sectionDiv.appendChild(attachList);

    // Controls to move this section up or down
    const moveControls = document.createElement('div');
    moveControls.style.display = 'flex';
    moveControls.style.gap = '8px';
    moveControls.style.marginTop = '4px';
    // Move up button
    const moveUpBtn = document.createElement('button');
    moveUpBtn.type = 'button';
    moveUpBtn.textContent = '↑';
    moveUpBtn.className = 'move-section-up-btn';
    moveUpBtn.addEventListener('click', () => {
      const parent = sectionDiv.parentNode;
      const prev = sectionDiv.previousElementSibling;
      if (prev) {
        parent.insertBefore(sectionDiv, prev);
      }
    });
    // Move down button
    const moveDownBtn = document.createElement('button');
    moveDownBtn.type = 'button';
    moveDownBtn.textContent = '↓';
    moveDownBtn.className = 'move-section-down-btn';
    moveDownBtn.addEventListener('click', () => {
      const parent = sectionDiv.parentNode;
      const next = sectionDiv.nextElementSibling;
      if (next) {
        parent.insertBefore(next, sectionDiv);
      }
    });
    moveControls.appendChild(moveUpBtn);
    moveControls.appendChild(moveDownBtn);
    // Button to add a new blank section at the end of this form
    const addAfterBtn = document.createElement('button');
    addAfterBtn.type = 'button';
    addAfterBtn.textContent = '+';
    addAfterBtn.className = 'add-next-section-btn';
    addAfterBtn.addEventListener('click', () => {
      // Create a new blank section at the end of the same container
      createDynamicSection(container);
    });
    moveControls.appendChild(addAfterBtn);
    sectionDiv.appendChild(moveControls);
    // Preserve existing attachments
    sectionDiv.existingAttachments = [];
    if (attachments && attachments.length > 0) {
      attachments.forEach((att) => {
        if (att.type === 'video') {
          videoInput.value = att.link;
        } else {
          sectionDiv.existingAttachments.push(att);
        }
      });
    }
    // Render attachments
    renderAttachmentList(sectionDiv, attachList);
    // Event listeners for toolbar controls
    fontSelect.addEventListener('change', () => {
      answerDiv.style.fontFamily = fontSelect.value || '';
    });
    sizeSelect.addEventListener('change', () => {
      answerDiv.style.fontSize = sizeSelect.value || '';
    });
    colorInput.addEventListener('change', () => {
      answerDiv.style.color = colorInput.value || '';
    });
    boldBtn.addEventListener('click', () => {
      const isBold = answerDiv.style.fontWeight === 'bold';
      answerDiv.style.fontWeight = isBold ? 'normal' : 'bold';
    });
    italicBtn.addEventListener('click', () => {
      const isItalic = answerDiv.style.fontStyle === 'italic';
      answerDiv.style.fontStyle = isItalic ? 'normal' : 'italic';
    });
    listBtn.addEventListener('click', () => {
      answerDiv.focus();
      document.execCommand('insertUnorderedList', false, null);
    });
    tableBtn.addEventListener('click', () => {
      answerDiv.focus();
      const htmlTable = '<table style="width: 100%; border-collapse: collapse;" border="1">' +
        '<tr><th>Columna 1</th><th>Columna 2</th></tr>' +
        '<tr><td></td><td></td></tr>' +
        '</table><br />';
      document.execCommand('insertHTML', false, htmlTable);
    });

    // Function to get the first table inside the answerDiv
    function getFirstTable() {
      return answerDiv.querySelector('table');
    }
    // Helper to alert if no table exists
    function ensureTable() {
      const table = getFirstTable();
      if (!table) {
        alert('Debe insertar una tabla primero.');
        return null;
      }
      return table;
    }
    // Add row to existing table
    addRowBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      const numCells = table.rows[0].cells.length;
      const newRow = table.insertRow(-1);
      for (let i = 0; i < numCells; i++) {
        const newCell = newRow.insertCell(-1);
        newCell.innerHTML = '';
      }
    });
    // Remove last row from existing table (keep at least header and one row)
    removeRowBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      if (table.rows.length > 2) {
        table.deleteRow(-1);
      } else {
        alert('No se puede eliminar todas las filas.');
      }
    });
    // Add column to existing table
    addColBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      Array.from(table.rows).forEach((row, index) => {
        const cell = row.insertCell(-1);
        cell.innerHTML = index === 0 ? 'Nueva columna' : '';
      });
    });
    // Remove last column from existing table
    removeColBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      const numCols = table.rows[0].cells.length;
      if (numCols > 1) {
        Array.from(table.rows).forEach((row) => {
          row.deleteCell(-1);
        });
      } else {
        alert('No se puede eliminar todas las columnas.');
      }
    });
    // Remove section button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Eliminar apartado';
    removeBtn.className = 'remove-section-btn';
    removeBtn.addEventListener('click', () => {
      container.removeChild(sectionDiv);
    });
    sectionDiv.appendChild(removeBtn);
    // Drag-and-drop reordering: make the section draggable and handle drag events
    sectionDiv.draggable = true;
    sectionDiv.addEventListener('dragstart', (ev) => {
      draggedSection = sectionDiv;
      try {
        ev.dataTransfer.setData('text/plain', 'dragging');
      } catch (e) {
        // Some browsers throw if dataTransfer is not available
      }
    });
    sectionDiv.addEventListener('dragover', (ev) => {
      ev.preventDefault();
    });
    sectionDiv.addEventListener('drop', (ev) => {
      ev.preventDefault();
      if (draggedSection && draggedSection !== sectionDiv) {
        container.insertBefore(draggedSection, sectionDiv);
      }
    });
    container.appendChild(sectionDiv);
  }

  // Helper wrappers for parent and doctor sections
  function addParentSection(question = '', answer = '', attachments = []) {
    createDynamicSection(parentSectionsContainer, question, answer, attachments);
  }
  function addDoctorSection(question = '', answer = '', attachments = []) {
    createDynamicSection(doctorSectionsContainer, question, answer, attachments);
  }

  /**
   * Collect all sections from a container, reading any new file attachments
   * asynchronously. Returns a promise that resolves to an array of
   * section objects containing question, answer and attachments.
   *
   * @param {HTMLElement} container The container of sections
   */
  async function collectSections(container) {
    /**
     * Gather all dynamic sections within a form container.  Each section consists of:
     *  - An input for the question/título
     *  - A contenteditable div for the answer (rich text)
     *  - A text input with class .video-input for video links
     *  - A file input with class .file-input for attachments
     * The function also preserves existing attachments stored on sectionDiv.existingAttachments and reads new files into DataURLs.
     */
    const sections = [];
    const sectionDivs = container.querySelectorAll('.dynamic-section');
    for (const sectionDiv of sectionDivs) {
      // Identify the question input: we take the first input[type=text] that is not the video input (which has class 'video-input').
      let question = '';
      const allInputs = sectionDiv.querySelectorAll('input[type="text"]');
      if (allInputs && allInputs.length > 0) {
        // The question input is the one without the video-input class
        const qInput = Array.from(allInputs).find((inp) => !inp.classList.contains('video-input'));
        if (qInput) question = qInput.value.trim();
      }
      // Get the answer HTML from the contenteditable div
      const answerDiv = sectionDiv.querySelector('.answer-editor');
      const answer = answerDiv ? answerDiv.innerHTML.trim() : '';
      // Video link input
      const videoInput = sectionDiv.querySelector('.video-input');
      const videoLink = videoInput && videoInput.value.trim() ? videoInput.value.trim() : '';
      // File input for new attachments
      const fileInput = sectionDiv.querySelector('.file-input');
      let attachments = [];
      // Clone existing attachments
      if (sectionDiv.existingAttachments && Array.isArray(sectionDiv.existingAttachments)) {
        attachments = attachments.concat(sectionDiv.existingAttachments.map((att) => ({ ...att })));
      }
      // Read new file attachments
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const filePromises = Array.from(fileInput.files).map(
          (file) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                resolve({ type: 'file', name: file.name, data: e.target.result });
              };
              reader.readAsDataURL(file);
            }),
        );
        const newFiles = await Promise.all(filePromises);
        attachments = attachments.concat(newFiles);
      }
      // Add video link as attachment if not already present
      if (videoLink) {
        const exists = attachments.some((att) => att.type === 'video' && att.link === videoLink);
        if (!exists) attachments.push({ type: 'video', link: videoLink });
      }
      sections.push({ question, answer, attachments });
    }
    return sections;
  }

  // Save a new guide into localStorage
  function saveGuide(guide) {
    const existing = JSON.parse(localStorage.getItem('guides') || '[]');
    existing.push(guide);
    localStorage.setItem('guides', JSON.stringify(existing));
  }

  // Update an existing guide in localStorage
  function updateGuide(updatedGuide) {
    const existing = JSON.parse(localStorage.getItem('guides') || '[]');
    const idx = existing.findIndex((g) => g.id === updatedGuide.id);
    if (idx !== -1) {
      existing[idx] = updatedGuide;
      localStorage.setItem('guides', JSON.stringify(existing));
    }
  }

  // Delete a guide by id
  function deleteGuide(id) {
    if (!confirm('¿Seguro que desea eliminar esta guía?')) return;
    const existing = JSON.parse(localStorage.getItem('guides') || '[]');
    const updated = existing.filter((g) => g.id !== id);
    localStorage.setItem('guides', JSON.stringify(updated));
    // Reload whichever library is currently active
    if (!parentLibrarySection.classList.contains('hidden')) {
      loadLibrary('parent');
    } else if (!doctorLibrarySection.classList.contains('hidden')) {
      loadLibrary('doctor');
    }
  }

  // Load guides from storage into the UI
  function loadLibrary(type) {
    const guides = JSON.parse(localStorage.getItem('guides') || '[]');
    const list = guides.filter((g) => g.type === type);
    const targetFolders = type === 'parent' ? parentLibraryFolders : doctorLibraryFolders;
    // Clear existing
    targetFolders.innerHTML = '';
    if (list.length === 0) {
      const msg = document.createElement('p');
      msg.textContent = 'No hay guías creadas aún.';
      targetFolders.appendChild(msg);
      return;
    }
    // Group by category
    const groups = {};
    list.forEach((g) => {
      if (!groups[g.category]) groups[g.category] = [];
      groups[g.category].push(g);
    });
    // Sort categories according to our order defined in CATEGORIES; fallback alphabetical
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      const idxA = CATEGORIES.findIndex((c) => c.name === a);
      const idxB = CATEGORIES.findIndex((c) => c.name === b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.localeCompare(b);
    });
    sortedCategories.forEach((categoryName) => {
      const folder = document.createElement('details');
      folder.className = 'category-folder';
      const summary = document.createElement('summary');
      // Find emoji for this category
      const catObj = CATEGORIES.find((c) => c.name === categoryName);
      const emoji = catObj ? catObj.emoji : '📁';
      summary.textContent = `${emoji} ${categoryName} (${groups[categoryName].length})`;
      folder.appendChild(summary);
      const container = document.createElement('div');
      container.className = 'category-container';
      // If the current user is the owner, provide a button to add a new guide directly within this category
      if (role === 'owner') {
        const addBtn = document.createElement('button');
        addBtn.className = 'view-guide-btn';
        // Use the same gradient as other primary buttons for consistency
        addBtn.style.background = 'linear-gradient(135deg, #4caf50, #009688, #03a9f4)';
        addBtn.textContent = 'Nueva guía';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Open the appropriate form and pre‑select the category
          if (type === 'parent') {
            openParentForm();
            // Set selected category after the form loads
            const parentSelect = document.getElementById('parentCategory');
            parentSelect.value = categoryName;
          } else {
            openDoctorForm();
            const doctorSelect = document.getElementById('doctorCategory');
            doctorSelect.value = categoryName;
          }
        });
        container.appendChild(addBtn);
      }
      // Sort guides by date descending (id is timestamp)
      groups[categoryName]
        .sort((a, b) => b.id.localeCompare(a.id))
        .forEach((guide) => {
          const card = document.createElement('div');
          card.className = 'guide-card';
          // Determine a thumbnail for the card. For parent guides, use the first
          // image found across all sections. For doctor guides, use a generic icon.
          let thumbnailData = null;
          if (guide.sections && Array.isArray(guide.sections)) {
            outer: for (const sec of guide.sections) {
              if (sec.attachments && Array.isArray(sec.attachments)) {
                for (const att of sec.attachments) {
                  if (att.type === 'file' && att.data && typeof att.data === 'string' && att.data.startsWith('data:image')) {
                    thumbnailData = att.data;
                    break outer;
                  }
                }
              }
            }
          }
          if (thumbnailData) {
            const img = document.createElement('img');
            img.src = thumbnailData;
            img.alt = `Imagen de ${guide.title}`;
            img.classList.add('thumbnail');
            card.appendChild(img);
          } else {
            const placeholder = document.createElement('div');
            placeholder.style.fontSize = '3rem';
            placeholder.style.marginBottom = '10px';
            placeholder.textContent = guide.type === 'parent' ? '📄' : '📋';
            card.appendChild(placeholder);
          }
          const titleElem = document.createElement('h3');
          titleElem.textContent = guide.title;
          card.appendChild(titleElem);
          const dateElem = document.createElement('p');
          dateElem.textContent = `Fecha: ${guide.date}`;
          card.appendChild(dateElem);
          const viewBtn = document.createElement('button');
          viewBtn.className = 'view-guide-btn';
          viewBtn.textContent = 'Ver guía';
          viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showGuideDetails(guide);
          });
          card.appendChild(viewBtn);
          // Add download PDF button for all users
          const pdfBtn = document.createElement('button');
          pdfBtn.className = 'view-guide-btn';
          // Use a different colour gradient for PDF button
          pdfBtn.style.background = 'linear-gradient(135deg, #7b1fa2, #6a1b9a)';
          pdfBtn.textContent = 'Descargar PDF';
          pdfBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            printGuide(guide);
          });
          card.appendChild(pdfBtn);
          if (role === 'owner') {
            const editBtn = document.createElement('button');
            editBtn.className = 'view-guide-btn';
            // Colour for edit button: orange gradient
            editBtn.style.background = 'linear-gradient(135deg, #ffa726, #fb8c00)';
            editBtn.textContent = 'Editar';
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (guide.type === 'parent') {
                startEditParent(guide);
              } else {
                startEditDoctor(guide);
              }
            });
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'view-guide-btn';
            // Colour for delete: red gradient
            deleteBtn.style.background = 'linear-gradient(135deg, #e53935, #d32f2f)';
            deleteBtn.textContent = 'Eliminar';
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              deleteGuide(guide.id);
            });
            card.appendChild(editBtn);
            card.appendChild(deleteBtn);
          }
          container.appendChild(card);
        });
      folder.appendChild(container);

      // If doctor type, add materials section
      if (type === 'doctor') {
        const materials = loadDoctorMaterials();
        const categoryMaterials = materials[categoryName] || [];
        const materialsDiv = document.createElement('div');
        materialsDiv.className = 'materials-container';
        // Header
        const header = document.createElement('h4');
        header.textContent = 'Material complementario';
        materialsDiv.appendChild(header);
        // List of materials
        const ul = document.createElement('ul');
        ul.style.listStyleType = 'disc';
        ul.style.marginLeft = '20px';
        ul.style.fontSize = '0.9rem';
        categoryMaterials.forEach((mat, index) => {
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.href = mat.data;
          link.download = mat.name;
          link.textContent = mat.name;
          li.appendChild(link);
          // Remove button for owner
          if (role === 'owner') {
            const remBtn = document.createElement('button');
            remBtn.textContent = 'X';
            remBtn.style.marginLeft = '8px';
            remBtn.style.background = 'linear-gradient(135deg, #e53935, #d32f2f)';
            remBtn.style.border = 'none';
            remBtn.style.borderRadius = '12px';
            remBtn.style.color = '#fff';
            remBtn.style.fontSize = '0.7rem';
            remBtn.style.padding = '2px 6px';
            remBtn.style.cursor = 'pointer';
            remBtn.addEventListener('click', () => {
              categoryMaterials.splice(index, 1);
              materials[categoryName] = categoryMaterials;
              saveDoctorMaterials(materials);
              loadLibrary('doctor');
            });
            li.appendChild(remBtn);
          }
          ul.appendChild(li);
        });
        materialsDiv.appendChild(ul);
        // Upload area for owner
        if (role === 'owner') {
          const uploadLabel = document.createElement('label');
          uploadLabel.style.display = 'block';
          uploadLabel.style.marginTop = '8px';
          uploadLabel.textContent = 'Agregar archivos:';
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.multiple = true;
          fileInput.style.display = 'block';
          fileInput.addEventListener('change', async () => {
            const files = Array.from(fileInput.files);
            if (files.length === 0) return;
            const materialsToAdd = await Promise.all(
              files.map(
                (file) =>
                  new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      resolve({ name: file.name, data: e.target.result });
                    };
                    reader.readAsDataURL(file);
                  }),
              ),
            );
            const updated = loadDoctorMaterials();
            const existing = updated[categoryName] || [];
            updated[categoryName] = existing.concat(materialsToAdd);
            saveDoctorMaterials(updated);
            loadLibrary('doctor');
          });
          materialsDiv.appendChild(uploadLabel);
          materialsDiv.appendChild(fileInput);
        }
        folder.appendChild(materialsDiv);
      }
      targetFolders.appendChild(folder);
    });
  }

  // Show the appropriate section and hide the others
  function showSection(section) {
    // Hide all sections
    objectiveSection.classList.add('hidden');
    parentGuideFormSection.classList.add('hidden');
    doctorGuideFormSection.classList.add('hidden');
    parentLibrarySection.classList.add('hidden');
    doctorLibrarySection.classList.add('hidden');
    articleSummarySection.classList.add('hidden');
    // Hide creation buttons by default
    parentLibraryCreateBtn.classList.add('hidden');
    doctorLibraryCreateBtn.classList.add('hidden');
    // Determine which section to show
    switch (section) {
      case 'objective':
        objectiveSection.classList.remove('hidden');
        break;
      case 'parentLibrary':
        parentLibrarySection.classList.remove('hidden');
        loadLibrary('parent');
        // If there are no guides in this library yet, show a create button so the owner
        // can start a new category. Once at least one guide exists, the create
        // button will be provided inside each category instead.
        {
          const guidesList = JSON.parse(localStorage.getItem('guides') || '[]').filter((g) => g.type === 'parent');
          if (role === 'owner' && guidesList.length === 0) {
            parentLibraryCreateBtn.classList.remove('hidden');
          } else {
            parentLibraryCreateBtn.classList.add('hidden');
          }
        }
        break;
      case 'doctorLibrary':
        doctorLibrarySection.classList.remove('hidden');
        loadLibrary('doctor');
        {
          const guidesList = JSON.parse(localStorage.getItem('guides') || '[]').filter((g) => g.type === 'doctor');
          if (role === 'owner' && guidesList.length === 0) {
            doctorLibraryCreateBtn.classList.remove('hidden');
          } else {
            doctorLibraryCreateBtn.classList.add('hidden');
          }
        }
        break;
      case 'articleSummary':
        // Show the article summary section and clear previous results
        articleSummarySection.classList.remove('hidden');
        if (articleSummaryResult) articleSummaryResult.innerHTML = '';
        if (articleImageResult) articleImageResult.innerHTML = '';
        // Reset last summary and hide download button on new view
        lastGeneratedSummary = '';
        if (downloadSummaryBtn) {
          downloadSummaryBtn.classList.add('hidden');
          downloadSummaryBtn.style.display = 'none';
        }
        // Hide create buttons when in summary section
        parentLibraryCreateBtn.classList.add('hidden');
        doctorLibraryCreateBtn.classList.add('hidden');
        break;
      default:
        break;
    }
  }

  // Open the parent guide form for creating a new guide
  function openParentForm() {
    resetParentForm();
    editingParentId = null;
    parentGuideFormSection.querySelector('h2').textContent = 'Nueva guía para padres';
    // Initialise default sections for a new guide
    DEFAULT_PARENT_SECTIONS.forEach((q) => addParentSection(q));
    parentGuideFormSection.classList.remove('hidden');
    parentLibrarySection.classList.add('hidden');
    doctorLibrarySection.classList.add('hidden');
    objectiveSection.classList.add('hidden');
    // Hide create buttons while editing/creating
    parentLibraryCreateBtn.classList.add('hidden');
    doctorLibraryCreateBtn.classList.add('hidden');
  }

  // Open the doctor guide form for creating a new guide
  function openDoctorForm() {
    resetDoctorForm();
    editingDoctorId = null;
    doctorGuideFormSection.querySelector('h2').textContent = 'Nueva guía para médicos';
    // Initialise default sections for a new doctor guide
    DEFAULT_DOCTOR_SECTIONS.forEach((q) => addDoctorSection(q));
    doctorGuideFormSection.classList.remove('hidden');
    parentLibrarySection.classList.add('hidden');
    doctorLibrarySection.classList.add('hidden');
    objectiveSection.classList.add('hidden');
    parentLibraryCreateBtn.classList.add('hidden');
    doctorLibraryCreateBtn.classList.add('hidden');
  }

  // Reset the parent form fields and attachment state
  function resetParentForm() {
    parentGuideForm.reset();
    // Remove all dynamic sections
    while (parentSectionsContainer.firstChild) {
      parentSectionsContainer.removeChild(parentSectionsContainer.firstChild);
    }
    cancelParentEditBtn.classList.add('hidden');
  }

  // Reset the doctor form
  function resetDoctorForm() {
    doctorGuideForm.reset();
    while (doctorSectionsContainer.firstChild) {
      doctorSectionsContainer.removeChild(doctorSectionsContainer.firstChild);
    }
    cancelDoctorEditBtn.classList.add('hidden');
  }

  // Start editing a parent guide
  function startEditParent(guide) {
    editingParentId = guide.id;
    // Populate basic fields
    parentGuideForm.parentTitle.value = guide.title;
    parentGuideForm.parentCategory.value = guide.category;
    // Clear existing dynamic sections
    while (parentSectionsContainer.firstChild) {
      parentSectionsContainer.removeChild(parentSectionsContainer.firstChild);
    }
    // Create sections from guide data
    if (guide.sections && Array.isArray(guide.sections)) {
      guide.sections.forEach((section) => {
        addParentSection(section.question || '', section.answer || '', section.attachments || []);
      });
    }
    parentGuideFormSection.querySelector('h2').textContent = 'Editar guía para padres';
    cancelParentEditBtn.classList.remove('hidden');
    parentGuideFormSection.classList.remove('hidden');
    parentLibrarySection.classList.add('hidden');
    doctorLibrarySection.classList.add('hidden');
    objectiveSection.classList.add('hidden');
    parentLibraryCreateBtn.classList.add('hidden');
    doctorLibraryCreateBtn.classList.add('hidden');
  }

  // Start editing a doctor guide
  function startEditDoctor(guide) {
    editingDoctorId = guide.id;
    // Populate basic fields
    doctorGuideForm.doctorTitle.value = guide.title;
    doctorGuideForm.doctorCategory.value = guide.category;
    // Clear existing dynamic sections
    while (doctorSectionsContainer.firstChild) {
      doctorSectionsContainer.removeChild(doctorSectionsContainer.firstChild);
    }
    // Create sections from guide data
    if (guide.sections && Array.isArray(guide.sections)) {
      guide.sections.forEach((section) => {
        addDoctorSection(section.question || '', section.answer || '', section.attachments || []);
      });
    }
    doctorGuideFormSection.querySelector('h2').textContent = 'Editar guía para médicos';
    cancelDoctorEditBtn.classList.remove('hidden');
    doctorGuideFormSection.classList.remove('hidden');
    parentLibrarySection.classList.add('hidden');
    doctorLibrarySection.classList.add('hidden');
    objectiveSection.classList.add('hidden');
    parentLibraryCreateBtn.classList.add('hidden');
    doctorLibraryCreateBtn.classList.add('hidden');
  }

  // Display the details of a guide in a modal
  function showGuideDetails(guide) {
    const modal = document.createElement('div');
    modal.classList.add('modal');
    // Build the modal content dynamically
    let html = '';
    html += '<div class="modal-content">';
    html += '<span class="close-btn" id="closeModal">&times;</span>';
    html += '<p class="author-detail">Elaborado por Dr. Oscar Hidalgo Mora – Pediatra</p>';
    // Find a cover image from the first image attachment in sections
    let cover = null;
    if (guide.sections && Array.isArray(guide.sections)) {
      outer: for (const sec of guide.sections) {
        if (sec.attachments && Array.isArray(sec.attachments)) {
          for (const att of sec.attachments) {
            if (att.type === 'file' && att.data && att.data.startsWith('data:image')) {
              cover = att.data;
              break outer;
            }
          }
        }
      }
    }
    if (cover) {
      html += `<img src="${cover}" alt="Imagen de ${guide.title}" class="modal-image" />`;
    }
    html += `<h2>${guide.title}</h2>`;
    html += `<p><strong>Categoría:</strong> ${guide.category}</p>`;
    html += `<p><strong>Última actualización:</strong> ${guide.date}</p>`;
    // Render each section
    if (guide.sections && Array.isArray(guide.sections)) {
      guide.sections.forEach((sec) => {
        html += `<h3>${sec.question}</h3>`;
        // Render answer HTML directly; this allows bold, italics, lists and tables to display properly.
        html += `<div class="section-answer">${sec.answer || ''}</div>`;
        if (sec.attachments && sec.attachments.length > 0) {
          let otherFiles = '';
          sec.attachments.forEach((att) => {
            if (att.type === 'file') {
              if (att.data && att.data.startsWith('data:image')) {
                html += `<img src="${att.data}" alt="Material" class="modal-image" />`;
              } else {
                otherFiles += `<li><a href="${att.data}" download="${att.name}">${att.name}</a></li>`;
              }
            } else if (att.type === 'video') {
              html += `<p><strong>Video:</strong> <a href="${att.link}" target="_blank">${att.link}</a></p>`;
            }
          });
          if (otherFiles) {
            html += '<ul>' + otherFiles + '</ul>';
          }
        }
      });
    }
    // QR code container and download button placeholder
    html += '<div id="qrContainer" style="margin-top:20px; text-align:center;"></div>';
    html += '<button class="view-guide-btn download-pdf-btn">Descargar PDF</button>';
    html += '</div>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    // After inserting, generate QR code using QuickChart API
    const qrContainer = modal.querySelector('#qrContainer');
    if (qrContainer) {
      // Clear any existing content
      qrContainer.innerHTML = '';
      // Only show the QR generation option for guests
      if (role === 'guest') {
        const qrBtn = document.createElement('button');
        qrBtn.className = 'view-guide-btn';
        // Use a green gradient similar to other buttons
        qrBtn.style.background = 'linear-gradient(135deg, #43a047, #2e7d32)';
        qrBtn.textContent = 'Generar QR';
        qrBtn.addEventListener('click', () => {
          generateQRCodeForGuide(guide, qrContainer);
        });
        qrContainer.appendChild(qrBtn);
      }
    }
    // Closing behaviour
    const closeBtn = modal.querySelector('#closeModal');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    // PDF download
    const pdfBtn = modal.querySelector('.download-pdf-btn');
    pdfBtn.addEventListener('click', () => printGuide(guide));
  }

  /**
   * Generate a QR code image for a given guide and insert it into a container.
   * This function uses the qrserver.com API to produce a PNG image. The
   * container will be cleared before inserting the QR and a caption.
   *
   * @param {Object} guide The guide object
   * @param {HTMLElement} container The container where the QR code will be shown
   */
  function generateQRCodeForGuide(guide, container) {
    if (!container) return;
    container.innerHTML = '';
    try {
      const qrText = `${guide.title} | ${guide.category} | ${guide.date}`;
      const encoded = encodeURIComponent(qrText);
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}`;
      img.alt = 'QR para información de la guía';
      img.style.marginBottom = '6px';
      container.appendChild(img);
      const caption = document.createElement('div');
      caption.style.fontSize = '0.8rem';
      caption.textContent = 'Escanee para ver información de la guía';
      container.appendChild(caption);
    } catch (err) {
      container.textContent = '🔳';
    }
  }

  /* ---------------------------------------------------------------------
   * Article summarisation and image generation
   *
   * Users can upload a plain text file (e.g. .txt or .md), generate a brief
   * summary and produce an image containing the key information. The
   * summarisation algorithm is intentionally simple: it takes the first few
   * sentences of the text. The image is generated using an HTML5 canvas with
   * a pastel background matching the app aesthetic.
   */

  // Handle the click on the "Generar resumen" button
  async function handleGenerateSummary() {
    // Generate a summary from an uploaded file.  Supports text, PDF and Word files.
    if (!articleFileInput || articleFileInput.files.length === 0) {
      alert('Seleccione un archivo para resumir.');
      return;
    }
    const file = articleFileInput.files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    // Helper to display summary and image
    const displayResults = (summary) => {
      if (articleSummaryResult) {
        articleSummaryResult.textContent = summary;
      }
      const imgData = createSummaryImage(summary);
      if (articleImageResult) {
        articleImageResult.innerHTML = '';
        const img = document.createElement('img');
        img.src = imgData;
        img.alt = 'Imagen resumen';
        img.style.maxWidth = '100%';
        articleImageResult.appendChild(img);
      }
    };
    // Attempt to extract text based on file type
    try {
      if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
        // Read binary data and attempt a naive UTF‑8 decode.  This does not properly
        // parse PDF or Word files, but provides a fallback when libraries are not
        // available.  A robust solution would use pdf.js or mammoth.js to extract
        // text, which cannot be loaded offline in this environment.
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target.result;
          let text = '';
          try {
            // Decode the ArrayBuffer into a string using UTF‑8.  Some binary
            // documents embed visible text in plain form; others may yield
            // unreadable output.
            const decoder = new TextDecoder('utf-8');
            text = decoder.decode(buffer);
          } catch (err) {
            text = '';
          }
        const summary = generateSummary(text);
          displayResults(summary);
          lastGeneratedSummary = summary;
          if (downloadSummaryBtn) {
            downloadSummaryBtn.classList.remove('hidden');
            downloadSummaryBtn.style.display = 'inline-block';
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Plain text file: read as text
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result || '';
          const summary = generateSummary(text);
          displayResults(summary);
          lastGeneratedSummary = summary;
          if (downloadSummaryBtn) {
            downloadSummaryBtn.classList.remove('hidden');
            downloadSummaryBtn.style.display = 'inline-block';
          }
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error(err);
      alert('No se pudo procesar el archivo para resumen.');
    }
  }

  // Produce a simple summary by selecting the first three sentences of the text.
  function generateSummary(text) {
    if (!text) return '';
    // Replace newlines with spaces
    const cleaned = text.replace(/[\r\n]+/g, ' ').trim();
    // Split into sentences using a simple regex
    const sentences = cleaned.match(/[^.!?]+[.!?]*/g);
    if (!sentences || sentences.length === 0) {
      return cleaned.slice(0, 300) + (cleaned.length > 300 ? '…' : '');
    }
    // Combine up to three sentences
    const selected = sentences.slice(0, 3).join(' ').trim();
    return selected || cleaned.slice(0, 300) + (cleaned.length > 300 ? '…' : '');
  }

  // Override generateSummary with an improved frequency‑based summarisation algorithm.
  // This implementation counts word frequencies (excluding common stopwords in
  // Spanish and English), scores sentences based on these frequencies and
  // selects the top three sentences in their original order.  It replaces
  // the earlier simple implementation automatically, because later
  // assignments to a function name override previous definitions in
  // JavaScript.
  generateSummary = function(text) {
    if (!text) return '';
    // Collapse newlines and normalise whitespace
    const cleaned = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    const sentences = cleaned.match(/[^.!?]+[.!?]*/g);
    if (!sentences || sentences.length === 0) {
      return cleaned.slice(0, 300) + (cleaned.length > 300 ? '…' : '');
    }
    // Combined Spanish and English stopwords
    const stopwords = new Set([
      'a','al','algo','algunas','algunos','ante','antes','como','con','contra','cual','cuando','de','del','desde','donde','durante','e','el','ella','ellas','ellos','en','entre','era','erais','eran','eras','eres','es','esa','esas','ese','eso','esos','esta','estaba','estabais','estaban','estabas','estad','estada','estadas','estado','estados','estáis','estamos','están','estás','este','esto','estos','estoy','fue','fuera','fuerais','fueran','fueras','fueron','fui','fuimos','ha','habéis','había','habíais','habíamos','habían','habías','han','has','hasta','hay','haya','hayamos','hayan','hayas','he','hemos','hola','hube','hubiera','hubierais','hubieran','hubieras','hubieron','hubiese','hubieseis','hubiesen','hubieses','hubimos','hubiste','hubisteis','la','las','le','les','lo','los','más','me','mi','mis','mucho','muy','no','nos','nosotras','nosotros','nuestra','nuestras','nuestro','nuestros','o','os','otra','otros','para','pero','poco','por','porque','que','quedó','qué','sea','sean','ser','serán','si','siempre','sin','sobre','son','su','sus','también','tampoco','te','tendrá','tenéis','tenemos','tienen','tienes','todo','todos','tu','tus','un','una','unas','uno','unos','vosotras','vosotros','vuestra','vuestras','vuestro','vuestros','ya','yo',
      'the','and','or','but','for','nor','yet','so','a','an','any','are','as','at','be','been','being','by','can','could','did','do','does','doing','from','have','has','had','if','in','into','is','it','its','of','on','our','ours','that','their','them','these','they','this','to','was','were','what','when','where','which','who','will','with','would','you','your','yours','i','we','he','she','my','me','him','her','his','hers'
    ]);
    // Word frequency count
    const allWords = cleaned.toLowerCase().match(/[a-záéíóúñü]+/gi) || [];
    const freq = {};
    allWords.forEach((w) => {
      if (!stopwords.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });
    // Score each sentence
    const scored = sentences.map((sent, idx) => {
      const words = (sent.toLowerCase().match(/[a-záéíóúñü]+/gi) || []);
      let score = 0;
      words.forEach((w) => {
        if (!stopwords.has(w) && freq[w]) {
          score += freq[w];
        }
      });
      return { sent: sent.trim(), score, idx };
    });
    // Select top 3 sentences
    const top = scored.sort((a, b) => b.score - a.score).slice(0, 3);
    top.sort((a, b) => a.idx - b.idx);
    let summary = top.map((o) => o.sent).join(' ');
    if (!summary) {
      summary = cleaned.slice(0, 300) + (cleaned.length > 300 ? '…' : '');
    }
    return summary;
  };

  // Draw the summary text onto a canvas and return a data URL for the image
  function createSummaryImage(summary) {
    const width = 600;
    // Estimate height: base height plus 24px per line (approx. 50 characters per line)
    const lines = Math.ceil(summary.length / 60) || 1;
    const height = Math.min(600, 80 + lines * 24);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // Background: pastel gradient with dots similar to the header
    const grd = ctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, '#FFE0B2');
    grd.addColorStop(0.33, '#F8BBD0');
    grd.addColorStop(0.66, '#BBDEFB');
    grd.addColorStop(1, '#B2DFDB');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    // Draw dotted overlay
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let x = 15; x < width; x += 60) {
      for (let y = 15; y < height; y += 60) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    // Text settings
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textBaseline = 'top';
    const lineHeight = 22;
    const words = summary.split(' ');
    let line = '';
    let y = 20;
    const marginX = 20;
    words.forEach((word, idx) => {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > width - marginX * 2 && idx > 0) {
        ctx.fillText(line.trim(), marginX, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line.trim(), marginX, y);
    return canvas.toDataURL('image/png');
  }

  /**
   * Download the last generated article summary as a printable PDF.  This
   * function opens a new window, writes the summary text into it and
   * triggers the print dialog.  It uses a simple style similar to the
   * guide PDF generation.
   */
  function downloadArticleSummary() {
    if (!lastGeneratedSummary) {
      alert('No hay un resumen generado para descargar.');
      return;
    }
    const printWindow = window.open('', '', 'width=800,height=600');
    const styles = `
      <style>
        body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        h1 { margin-top: 0; }
        p { margin: 5px 0 15px 0; line-height: 1.4; }
      </style>
    `;
    const html = `
      <html>
      <head>
        <title>Resumen de artículo</title>
        ${styles}
      </head>
      <body>
        <h1>Resumen de artículo</h1>
        <p>${lastGeneratedSummary.replace(/\n/g, '<br/>')}</p>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  // Generate a printable document for a guide and trigger the print dialogue
  function printGuide(guide) {
    const printWindow = window.open('', '', 'width=800,height=600');
    const styles = `
      <style>
        body { font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        h1 { margin-top: 0; }
        h2 { color: #00695C; margin-bottom: 5px; }
        h3 { color: #00695C; margin-bottom: 3px; }
        p { margin: 5px 0 15px 0; line-height: 1.4; }
        img { max-width: 100%; height: auto; margin-bottom: 15px; border-radius: 8px; }
        .author { font-style: italic; margin-bottom: 10px; }
        ul { margin: 0 0 15px 20px; }
      </style>
    `;
    let content = '';
    content += `<h1>${guide.title}</h1>`;
    content += `<p class="author">Elaborado por Dr. Oscar Hidalgo Mora – Pediatra</p>`;
    content += `<p><strong>Categoría:</strong> ${guide.category}</p>`;
    content += `<p><strong>Última actualización:</strong> ${guide.date}</p>`;
    // Find a cover image
    let cover = null;
    if (guide.sections && Array.isArray(guide.sections)) {
      outerCover: for (const sec of guide.sections) {
        if (sec.attachments && Array.isArray(sec.attachments)) {
          for (const att of sec.attachments) {
            if (att.type === 'file' && att.data && att.data.startsWith('data:image')) {
              cover = att.data;
              break outerCover;
            }
          }
        }
      }
    }
    if (cover) {
      content += `<img src="${cover}" alt="Imagen de ${guide.title}" />`;
    }
    // Render dynamic sections
    if (guide.sections && Array.isArray(guide.sections)) {
      guide.sections.forEach((sec) => {
        content += `<h2>${sec.question}</h2>`;
        // Use answer HTML directly.  The answer may include tables, lists and styled text.
        content += `<div>${sec.answer || ''}</div>`;
        // Prepare lists for non-image files
        let fileList = '';
        if (sec.attachments && sec.attachments.length > 0) {
          sec.attachments.forEach((att) => {
            if (att.type === 'file') {
              if (att.data && att.data.startsWith('data:image')) {
                content += `<img src="${att.data}" alt="Material" />`;
              } else {
                fileList += `<li>${att.name}</li>`;
              }
            } else if (att.type === 'video') {
              content += `<p><strong>Video:</strong> ${att.link}</p>`;
            }
          });
          if (fileList) {
            content += `<ul>${fileList}</ul>`;
          }
        }
      });
    }
    // Disclaimer note
    content += '<p style="font-size: 0.8rem; margin-top: 30px;">Este documento tiene fines educativos y no sustituye una valoración médica individual.</p>';
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${guide.title}</title>${styles}</head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.onload = function () {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  }

  // Authentication: initialise login or show app if already logged in
  function initializeAuth() {
    // Hide everything until login is resolved
    objectiveSection.classList.add('hidden');
    parentGuideFormSection.classList.add('hidden');
    doctorGuideFormSection.classList.add('hidden');
    parentLibrarySection.classList.add('hidden');
    doctorLibrarySection.classList.add('hidden');
    navButtons.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    parentLibraryCreateBtn.classList.add('hidden');
    doctorLibraryCreateBtn.classList.add('hidden');
    // Check if credentials exist
    const storedUsername = localStorage.getItem('ownerUsername');
    const storedPassword = localStorage.getItem('ownerPassword');
    const savedRole = sessionStorage.getItem('role');
    if (!storedUsername || !storedPassword) {
      passwordSetup.classList.remove('hidden');
      loginFormDiv.classList.add('hidden');
    } else {
      passwordSetup.classList.add('hidden');
      loginFormDiv.classList.remove('hidden');
    }
    // Restore role if saved in this session
    if (savedRole) {
      role = savedRole;
      loginSection.classList.add('hidden');
      showApp();
    }
  }

  // Show main application after successful login or guest entry
  function showApp() {
    // Display nav and default section
    navButtons.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loginSection.classList.add('hidden');
    // Show objective section by default
    showSection('objective');
  }

  // Logout: clear session and return to login screen
  function handleLogout() {
    role = null;
    sessionStorage.removeItem('role');
    // Reset forms and hide everything
    resetParentForm();
    resetDoctorForm();
    // Hide sections and nav
    objectiveSection.classList.add('hidden');
    parentGuideFormSection.classList.add('hidden');
    doctorGuideFormSection.classList.add('hidden');
    parentLibrarySection.classList.add('hidden');
    doctorLibrarySection.classList.add('hidden');
    navButtons.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    parentLibraryCreateBtn.classList.add('hidden');
    doctorLibraryCreateBtn.classList.add('hidden');
    loginSection.classList.remove('hidden');
    // Show login form again
    const storedUsername = localStorage.getItem('ownerUsername');
    const storedPassword = localStorage.getItem('ownerPassword');
    if (!storedUsername || !storedPassword) {
      passwordSetup.classList.remove('hidden');
      loginFormDiv.classList.add('hidden');
    } else {
      passwordSetup.classList.add('hidden');
      loginFormDiv.classList.remove('hidden');
    }
  }

  /* ---------------------------------------------------------------------
   * Authentication Event Listeners (set up outside of setupEventListeners)
   */
  setPasswordBtn && setPasswordBtn.addEventListener('click', () => {
    const user = setupUsernameInput ? setupUsernameInput.value.trim() : '';
    const pass = setupPasswordInput.value.trim();
    if (user && pass) {
      localStorage.setItem('ownerUsername', user);
      // Encode password to discourage casual inspection
      localStorage.setItem('ownerPassword', btoa(pass));
      // Show login form
      passwordSetup.classList.add('hidden');
      loginFormDiv.classList.remove('hidden');
      // Clear inputs
      setupUsernameInput && (setupUsernameInput.value = '');
      setupPasswordInput.value = '';
    }
  });

  loginBtn && loginBtn.addEventListener('click', () => {
    const storedUsername = localStorage.getItem('ownerUsername');
    const storedPassword = localStorage.getItem('ownerPassword');
    const inputUser = loginUsernameInput ? loginUsernameInput.value.trim() : '';
    const inputPass = loginPasswordInput.value;
    loginError.classList.add('hidden');
    if (
      storedUsername &&
      storedPassword &&
      inputUser &&
      inputPass &&
      storedUsername === inputUser &&
      atob(storedPassword) === inputPass
    ) {
      role = 'owner';
      sessionStorage.setItem('role', role);
      // Clear inputs
      loginUsernameInput && (loginUsernameInput.value = '');
      loginPasswordInput.value = '';
      showApp();
    } else {
      loginError.classList.remove('hidden');
    }
  });

  guestBtn && guestBtn.addEventListener('click', () => {
    role = 'guest';
    sessionStorage.setItem('role', role);
    showApp();
  });
});