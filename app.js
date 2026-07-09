// JavaScript for GuÃ­asÂ PediÃ¡tricas

// This script handles authentication, form handling, storage and display of
// both parentâ€‘oriented guides and doctorâ€‘oriented guides. Each guide is
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
  // Global variables to track editor state.  "draggedSection" is no longer
  // used because drag-and-drop reordering of sections has been disabled.
  let draggedSection = null;

  // Track which element (question input or answer editor) is currently
  // selected for styling operations.  When the user clicks on a question
  // input or the answer content area, this variable is updated.  All
  // formatting controls (font, size, colour, bold, italic) will apply
  // to the element referenced by activeEditable.
  let activeEditable = null;

  // Saved selection range for rich text editing.  When the user
  // highlights text within the answer editor, we store the range here.
  // When a toolbar control is used (which may steal focus), we
  // restore this range before executing formatting commands so that
  // commands apply to the original selection rather than the entire
  // content.  This is shared across all sections but only used
  // within the currently active editor.
  let savedRange = null;

  /**
   * Restore the previously saved selection range in the currently
   * active editable element.  This function is used before
   * applying formatting commands that rely on a selection.  If
   * savedRange is null or the active element is not the answer
   * editor, nothing happens.
   */
  function restoreSavedSelection() {
    if (savedRange && activeEditable) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } catch (e) {
        // Silently ignore errors when restoring selection
      }
    }
  }

  function selectionBelongsTo(element) {
    if (!element || !savedRange) return false;
    const common = savedRange.commonAncestorContainer;
    const node = common.nodeType === Node.TEXT_NODE ? common.parentNode : common;
    return element.contains(node);
  }

  function saveSelectionIfInside(element) {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const common = range.commonAncestorContainer;
        const node = common.nodeType === Node.TEXT_NODE ? common.parentNode : common;
        if (element.contains(node)) {
          savedRange = range.cloneRange();
          activeEditable = element;
        }
      }
    } catch (e) {
      // ignore selection errors
    }
  }

  function applyStyleToSelection(element, styles, fallbackCommand, fallbackValue) {
    if (!element) return;
    restoreSavedSelection();
    if (selectionBelongsTo(element) && !savedRange.collapsed) {
      const span = document.createElement('span');
      Object.entries(styles).forEach(([key, value]) => {
        span.style[key] = value;
      });
      try {
        const contents = savedRange.extractContents();
        span.appendChild(contents);
        savedRange.insertNode(span);
        const range = document.createRange();
        range.setStartAfter(span);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange = range.cloneRange();
        return;
      } catch (e) {
        // Fall back to execCommand below if wrapping fails
      }
    }
    if (fallbackCommand) {
      element.focus();
      restoreSavedSelection();
      document.execCommand('styleWithCSS', true, null);
      document.execCommand(fallbackCommand, false, fallbackValue || null);
    }
  }

  // When editing an existing guide, store its PDF attachment here so that
  // the file input is not required to retain the PDF.  If a new file is
  // uploaded, this value is replaced.  These variables are reset when
  // resetting the forms.
  let editingParentPdf = null;
  let editingDoctorPdf = null;
  // Updated categories list based on user request. Each category has a friendly emoji
  // that reflects the speciality. When choosing emojis, we tried to pick symbols
  // that evoke the body system or context of each subspecialty.
  const CATEGORIES = [
    { name: 'NeonatologÃ­a', emoji: 'ðŸ‘¶' },
    { name: 'CardiologÃ­a', emoji: 'â¤ï¸' },
    { name: 'NeumologÃ­a', emoji: 'ðŸŒ¬ï¸' },
    { name: 'GastroenterologÃ­a', emoji: 'ðŸ½ï¸' },
    { name: 'NefrologÃ­a', emoji: 'ðŸ’§' },
    { name: 'EndocrinologÃ­a', emoji: 'ðŸ§ª' },
    { name: 'InfectologÃ­a', emoji: 'ðŸ¦ ' },
    { name: 'InmunologÃ­a / ReumatologÃ­a', emoji: 'ðŸ›¡ï¸' },
    { name: 'HemaoncologÃ­a', emoji: 'ðŸ©¸' },
    { name: 'AlergologÃ­a', emoji: 'ðŸ¤§' },
    { name: 'NeurologÃ­a', emoji: 'ðŸ§ ' },
    { name: 'PsiquiatrÃ­a', emoji: 'ðŸ’­' },
    { name: 'Neurodesarrollo', emoji: 'ðŸ§©' },
    { name: 'GinecologÃ­a', emoji: 'ðŸ¤°' },
    { name: 'Emergencias', emoji: 'ðŸš‘' },
    { name: 'Medicina hospitalaria', emoji: 'ðŸ¥' },
    { name: 'UCI', emoji: 'ðŸ›Œ' },
    { name: 'GenÃ©tica', emoji: 'ðŸ§¬' },
    { name: 'DermatologÃ­a pediÃ¡trica', emoji: 'ðŸŒ¸' },
    { name: 'PediatrÃ­a general', emoji: 'ðŸ©º' },
    { name: 'CirugÃ­a pediÃ¡trica', emoji: 'ðŸ©¹' },
    { name: 'Ortopedia', emoji: 'ðŸ¦´' },
    { name: 'Otro', emoji: 'ðŸ“‚' },
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

  // PDF inputs for parent and doctor guides
  const parentPdfInput = document.getElementById('parentPdf');
  const doctorPdfInput = document.getElementById('doctorPdf');

  // Variable to store the last generated summary so it can be downloaded as PDF
  let lastGeneratedSummary = '';

  // The PediBot feature has been removed at the user's request.  These
  // variables and message definitions are retained as comments to
  // illustrate prior functionality but are no longer used.  If you
  // decide to reintroduce a paediatric tip bot, you can reâ€‘enable
  // PEDI_MESSAGES and the associated startPediBot function.
  // const PEDI_MESSAGES = [];
  // let pediBotInterval = null;
  // let pediBotIndex = 0;


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
    'Â¿QuÃ© es?',
    'Â¿Por quÃ© ocurre?',
    'Â¿QuÃ© sÃ­ntomas puedo esperar?',
    'Â¿CÃ³mo se trata?',
    'Â¿CuÃ¡les son los signos de alarma?',
    'Mensajes clave',
    'Fuentes',
    'Material adicional',
  ];
  const DEFAULT_DOCTOR_SECTIONS = [
    'Historia clÃ­nica / machote',
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
      // Determine the PDF attachment.  If a new file is provided, read it
      // into a DataURL.  Otherwise, if editing an existing guide and no
      // new file is selected, reuse the previously stored PDF.
      let pdfObj = null;
      if (parentPdfInput && parentPdfInput.files && parentPdfInput.files.length > 0) {
        const file = parentPdfInput.files[0];
        pdfObj = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({ name: file.name, data: e.target.result });
          };
          reader.readAsDataURL(file);
        });
      } else if (editingParentPdf) {
        pdfObj = editingParentPdf;
      }
      const guide = {
        id: editingParentId || Date.now().toString(),
        type: 'parent',
        title: parentGuideForm.parentTitle.value.trim(),
        category: parentGuideForm.parentCategory.value,
        date: new Date().toLocaleDateString('es-CR'),
        sections,
        pdf: pdfObj,
      };
      if (editingParentId) {
        updateGuide(guide);
        editingParentId = null;
        editingParentPdf = null;
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
      // Handle PDF attachment similarly to parent guides
      let pdfObj = null;
      if (doctorPdfInput && doctorPdfInput.files && doctorPdfInput.files.length > 0) {
        const file = doctorPdfInput.files[0];
        pdfObj = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({ name: file.name, data: e.target.result });
          };
          reader.readAsDataURL(file);
        });
      } else if (editingDoctorPdf) {
        pdfObj = editingDoctorPdf;
      }
      const guide = {
        id: editingDoctorId || Date.now().toString(),
        type: 'doctor',
        title: doctorGuideForm.doctorTitle.value.trim(),
        category: doctorGuideForm.doctorCategory.value,
        date: new Date().toLocaleDateString('es-CR'),
        sections,
        pdf: pdfObj,
      };
      if (editingDoctorId) {
        updateGuide(guide);
        editingDoctorId = null;
        editingDoctorPdf = null;
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
    questionInput.placeholder = 'Pregunta o tÃ­tulo del apartado';
    questionInput.value = question;
    sectionDiv.appendChild(questionInput);

    // When the user clicks or focuses on the question input, mark it
    // as the active editable element so that formatting controls apply
    // to this element.  Note: contenteditable operations such as lists
    // and tables do not apply to inputs and are still applied only
    // within the answer editor below.
    questionInput.addEventListener('click', () => {
      activeEditable = questionInput;
    });
    questionInput.addEventListener('focus', () => {
      activeEditable = questionInput;
    });
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
    // Prevent toolbar controls from stealing focus when clicked so selection
    // inside the answer editor is preserved.  Without this, clicking a
    // button will move focus to the button, clearing the selection and
    // causing formatting commands (e.g. bold) to apply to the entire
    // element rather than the selected text.  mousedown handlers call
    // preventDefault to keep focus within the editor.
    // Font size selector
    const sizeSelect = document.createElement('select');
    sizeSelect.innerHTML = '<option value="">TamaÃ±o</option>' +
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
    boldBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    // Italic button
    const italicBtn = document.createElement('button');
    italicBtn.type = 'button';
    italicBtn.textContent = 'I';
    italicBtn.style.fontStyle = 'italic';
    toolbar.appendChild(italicBtn);
    italicBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    // Underline button
    const underlineBtn = document.createElement('button');
    underlineBtn.type = 'button';
    underlineBtn.textContent = 'U';
    underlineBtn.style.textDecoration = 'underline';
    toolbar.appendChild(underlineBtn);
    underlineBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    // Unordered list button
    const listBtn = document.createElement('button');
    listBtn.type = 'button';
    listBtn.textContent = 'Lista';
    toolbar.appendChild(listBtn);
    listBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    // Table button
    const tableBtn = document.createElement('button');
    tableBtn.type = 'button';
    tableBtn.textContent = 'Tabla';
    toolbar.appendChild(tableBtn);
    tableBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    // Additional controls for table editing
    // Add row button
    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.textContent = 'Fila +';
    toolbar.appendChild(addRowBtn);
    addRowBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    // Remove row button
    const removeRowBtn = document.createElement('button');
    removeRowBtn.type = 'button';
    removeRowBtn.textContent = 'Fila -';
    toolbar.appendChild(removeRowBtn);
    removeRowBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    // Add column button
    const addColBtn = document.createElement('button');
    addColBtn.type = 'button';
    addColBtn.textContent = 'Col +';
    toolbar.appendChild(addColBtn);
    addColBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    // Remove column button
    const removeColBtn = document.createElement('button');
    removeColBtn.type = 'button';
    removeColBtn.textContent = 'Col -';
    toolbar.appendChild(removeColBtn);
    removeColBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    sectionDiv.appendChild(toolbar);
    // Contenteditable div for answer
    const answerDiv = document.createElement('div');
    answerDiv.className = 'answer-editor';
    answerDiv.contentEditable = 'true';
    answerDiv.setAttribute('data-placeholder', 'Contenido o respuesta');
    answerDiv.innerHTML = answer || '';
    sectionDiv.appendChild(answerDiv);

    // When the user clicks or focuses on the answer editor, mark it
    // as the active editable element for formatting controls.
    answerDiv.addEventListener('click', () => {
      activeEditable = answerDiv;
    });
    answerDiv.addEventListener('focus', () => {
      activeEditable = answerDiv;
    });
    // Update savedRange whenever the user releases the mouse inside the answer
    // editor.  This captures the current selection so that formatting
    // commands can later restore and operate on the same text.
    answerDiv.addEventListener('mouseup', () => {
      saveSelectionIfInside(answerDiv);
    });
    let activeTableCell = null;
    answerDiv.addEventListener('keyup', () => {
      saveSelectionIfInside(answerDiv);
    });
    answerDiv.addEventListener('click', (event) => {
      const cell = event.target.closest ? event.target.closest('td, th') : null;
      if (cell && answerDiv.contains(cell)) {
        activeTableCell = cell;
        answerDiv.querySelectorAll('.selected-table-cell').forEach((el) => el.classList.remove('selected-table-cell'));
        cell.classList.add('selected-table-cell');
      }
    });
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

    // Removed per-section move controls (arrows and add-after button).  Sections
    // can now be reordered by drag-and-drop; additional sections can be
    // created via the global "Agregar apartado" button for each form.
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
      const value = fontSelect.value;
      if (!value) return;
      if (activeEditable === answerDiv) {
        applyStyleToSelection(answerDiv, { fontFamily: value }, 'fontName', value);
      } else if (activeEditable) {
        // Apply font to the entire element (e.g. question title)
        activeEditable.style.fontFamily = value;
      }
    });
    sizeSelect.addEventListener('change', () => {
      const value = sizeSelect.value;
      if (!value) return;
      if (activeEditable === answerDiv) {
        // Map pixel values to execCommand size values (1-7)
        const sizeMap = {
          '14px': '2',
          '16px': '3',
          '18px': '4',
          '20px': '5',
          '24px': '6',
        };
        const cmdVal = sizeMap[value] || '3';
        applyStyleToSelection(answerDiv, { fontSize: value }, 'fontSize', cmdVal);
      } else if (activeEditable) {
        activeEditable.style.fontSize = value;
      }
    });
    colorInput.addEventListener('change', () => {
      const color = colorInput.value;
      if (!color) return;
      if (activeEditable === answerDiv) {
        applyStyleToSelection(answerDiv, { color }, 'foreColor', color);
      } else if (activeEditable) {
        activeEditable.style.color = color;
      }
    });
    boldBtn.addEventListener('click', () => {
      if (activeEditable === answerDiv) {
        applyStyleToSelection(answerDiv, { fontWeight: 'bold' }, 'bold');
      } else if (activeEditable) {
        const isBold = activeEditable.style.fontWeight === 'bold';
        activeEditable.style.fontWeight = isBold ? 'normal' : 'bold';
      }
    });
    italicBtn.addEventListener('click', () => {
      if (activeEditable === answerDiv) {
        applyStyleToSelection(answerDiv, { fontStyle: 'italic' }, 'italic');
      } else if (activeEditable) {
        const isItalic = activeEditable.style.fontStyle === 'italic';
        activeEditable.style.fontStyle = isItalic ? 'normal' : 'italic';
      }
    });
    underlineBtn.addEventListener('click', () => {
      if (activeEditable === answerDiv) {
        applyStyleToSelection(answerDiv, { textDecoration: 'underline' }, 'underline');
      } else if (activeEditable) {
        const isUnderline = activeEditable.style.textDecoration === 'underline';
        activeEditable.style.textDecoration = isUnderline ? 'none' : 'underline';
      }
    });
    listBtn.addEventListener('click', () => {
      answerDiv.focus();
      restoreSavedSelection();
      document.execCommand('insertUnorderedList', false, null);
    });
    tableBtn.addEventListener('click', () => {
      answerDiv.focus();
      restoreSavedSelection();
      const htmlTable = '<table style="width: 100%; border-collapse: collapse;" border="1">' +
        '<tr><th>Columna 1</th><th>Columna 2</th></tr>' +
        '<tr><td></td><td></td></tr>' +
        '</table><br />';
      document.execCommand('insertHTML', false, htmlTable);
    });

    // Helpers for friendly table editing.  The user can click a cell and then
    // use the row/column buttons to modify the row or column related to that
    // selected cell.  If no cell is selected, the first table is used.
    function getFirstTable() {
      return answerDiv.querySelector('table');
    }
    function getActiveTable() {
      if (activeTableCell && answerDiv.contains(activeTableCell)) {
        return activeTableCell.closest('table');
      }
      return getFirstTable();
    }
    function ensureTable() {
      const table = getActiveTable();
      if (!table) {
        alert('Debe insertar una tabla primero.');
        return null;
      }
      return table;
    }
    function getCellIndex(cell) {
      if (!cell || !cell.parentElement) return 0;
      return Array.from(cell.parentElement.children).indexOf(cell);
    }
    function selectTableCell(cell) {
      if (!cell) return;
      answerDiv.querySelectorAll('.selected-table-cell').forEach((el) => el.classList.remove('selected-table-cell'));
      cell.classList.add('selected-table-cell');
      activeTableCell = cell;
    }
    // Add a row below the selected cell's row; if no cell is selected, add to the end.
    addRowBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      const referenceRow = activeTableCell && table.contains(activeTableCell) ? activeTableCell.parentElement : table.rows[table.rows.length - 1];
      const insertIndex = referenceRow ? referenceRow.rowIndex + 1 : table.rows.length;
      const numCells = table.rows[0] ? table.rows[0].cells.length : 2;
      const newRow = table.insertRow(insertIndex);
      for (let i = 0; i < numCells; i++) {
        const newCell = newRow.insertCell(-1);
        newCell.innerHTML = '';
      }
      selectTableCell(newRow.cells[0]);
    });
    // Remove the selected row; keep at least one row in the table.
    removeRowBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      if (table.rows.length <= 1) {
        alert('No se puede eliminar la Ãºltima fila.');
        return;
      }
      const row = activeTableCell && table.contains(activeTableCell) ? activeTableCell.parentElement : table.rows[table.rows.length - 1];
      const nextRow = row.nextElementSibling || row.previousElementSibling;
      table.deleteRow(row.rowIndex);
      if (nextRow && nextRow.cells.length > 0) selectTableCell(nextRow.cells[0]);
      else activeTableCell = null;
    });
    // Add a column to the right of the selected cell; if no cell is selected, add at the end.
    addColBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      const selectedIndex = activeTableCell && table.contains(activeTableCell) ? getCellIndex(activeTableCell) : (table.rows[0] ? table.rows[0].cells.length - 1 : 0);
      const insertIndex = selectedIndex + 1;
      Array.from(table.rows).forEach((row, rowIndex) => {
        const cell = row.insertCell(insertIndex);
        cell.innerHTML = rowIndex === 0 ? 'Nueva columna' : '';
      });
      if (table.rows[0] && table.rows[0].cells[insertIndex]) selectTableCell(table.rows[0].cells[insertIndex]);
    });
    // Remove the selected column; keep at least one column.
    removeColBtn.addEventListener('click', () => {
      const table = ensureTable();
      if (!table) return;
      const numCols = table.rows[0] ? table.rows[0].cells.length : 0;
      if (numCols <= 1) {
        alert('No se puede eliminar la Ãºltima columna.');
        return;
      }
      const selectedIndex = activeTableCell && table.contains(activeTableCell) ? getCellIndex(activeTableCell) : numCols - 1;
      Array.from(table.rows).forEach((row) => {
        if (row.cells[selectedIndex]) row.deleteCell(selectedIndex);
      });
      const newIndex = Math.min(selectedIndex, numCols - 2);
      if (table.rows[0] && table.rows[0].cells[newIndex]) selectTableCell(table.rows[0].cells[newIndex]);
      else activeTableCell = null;
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
    // Up and down arrow buttons to change section order.  These controls
    // allow the user to reposition sections without dragâ€‘andâ€‘drop.  When
    // clicking the up arrow, the section is moved before its previous
    // sibling (if any).  Clicking the down arrow moves it after the next
    // sibling.
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = 'â†‘';
    upBtn.className = 'move-section-btn';
    upBtn.addEventListener('click', () => {
      const prev = sectionDiv.previousElementSibling;
      if (prev) {
        container.insertBefore(sectionDiv, prev);
      }
    });
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = 'â†“';
    downBtn.className = 'move-section-btn';
    downBtn.addEventListener('click', () => {
      const next = sectionDiv.nextElementSibling;
      if (next) {
        container.insertBefore(next, sectionDiv);
      }
    });
    sectionDiv.appendChild(upBtn);
    sectionDiv.appendChild(downBtn);
    // Append the completed section to the container
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
     *  - An input for the question/tÃ­tulo
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
    if (!confirm('Â¿Seguro que desea eliminar esta guÃ­a?')) return;
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
      msg.textContent = 'No hay guÃ­as creadas aÃºn.';
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
      const emoji = catObj ? catObj.emoji : 'ðŸ“';
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
        addBtn.textContent = 'Nueva guÃ­a';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Open the appropriate form and preâ€‘select the category
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
            placeholder.textContent = guide.type === 'parent' ? 'ðŸ“„' : 'ðŸ“‹';
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
          viewBtn.textContent = 'Ver guÃ­a';
          viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showGuideDetails(guide);
          });
          card.appendChild(viewBtn);
          // Download menu directly on the category page, inside each guide card.
          // This lets the user download the guide without opening the full modal.
          const downloadWrap = document.createElement('div');
          downloadWrap.className = 'download-menu';
          const downloadBtn = document.createElement('button');
          downloadBtn.className = 'view-guide-btn download-main-btn';
          downloadBtn.style.background = 'linear-gradient(135deg, #7b1fa2, #6a1b9a)';
          downloadBtn.textContent = 'Descargar â–¾';
          const downloadOptions = document.createElement('div');
          downloadOptions.className = 'download-options hidden';
          const pdfBtn = document.createElement('button');
          pdfBtn.type = 'button';
          pdfBtn.className = 'download-option-btn';
          pdfBtn.textContent = 'PDF (A5)';
          pdfBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            printGuide(guide);
            downloadOptions.classList.add('hidden');
          });
          const wordBtn = document.createElement('button');
          wordBtn.type = 'button';
          wordBtn.className = 'download-option-btn';
          wordBtn.textContent = 'Word';
          wordBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadWord(guide);
            downloadOptions.classList.add('hidden');
          });
          downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadOptions.classList.toggle('hidden');
          });
          downloadOptions.appendChild(pdfBtn);
          downloadOptions.appendChild(wordBtn);
          downloadWrap.appendChild(downloadBtn);
          downloadWrap.appendChild(downloadOptions);
          card.appendChild(downloadWrap);
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
    // The article summary section has been removed, so no need to hide it here
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
        // Always show the topâ€‘level "Nueva guÃ­a" button at the start of
        // the parent library for the owner.  Guests cannot see this button.
        if (role === 'owner') {
          parentLibraryCreateBtn.classList.remove('hidden');
        } else {
          parentLibraryCreateBtn.classList.add('hidden');
        }
        break;
      case 'doctorLibrary':
        doctorLibrarySection.classList.remove('hidden');
        loadLibrary('doctor');
        // Always show the topâ€‘level "Nueva guÃ­a" button at the start of
        // the doctor library for the owner.  Guests cannot see this button.
        if (role === 'owner') {
          doctorLibraryCreateBtn.classList.remove('hidden');
        } else {
          doctorLibraryCreateBtn.classList.add('hidden');
        }
        break;
      default:
        break;
    }
  }

  // Open the parent guide form for creating a new guide
  function openParentForm() {
    resetParentForm();
    editingParentId = null;
    parentGuideFormSection.querySelector('h2').textContent = 'Nueva guÃ­a para padres';
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
    doctorGuideFormSection.querySelector('h2').textContent = 'Nueva guÃ­a para mÃ©dicos';
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
    editingParentPdf = null;
  }

  // Reset the doctor form
  function resetDoctorForm() {
    doctorGuideForm.reset();
    while (doctorSectionsContainer.firstChild) {
      doctorSectionsContainer.removeChild(doctorSectionsContainer.firstChild);
    }
    cancelDoctorEditBtn.classList.add('hidden');
    editingDoctorPdf = null;
  }

  // Start editing a parent guide
  function startEditParent(guide) {
    editingParentId = guide.id;
    // Preserve the existing PDF so it can be reused if no new file is uploaded
    editingParentPdf = guide.pdf || null;
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
    parentGuideFormSection.querySelector('h2').textContent = 'Editar guÃ­a para padres';
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
    // Preserve the existing PDF for reuse during editing
    editingDoctorPdf = guide.pdf || null;
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
    doctorGuideFormSection.querySelector('h2').textContent = 'Editar guÃ­a para mÃ©dicos';
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
    html += '<p class="author-detail">Elaborado por Dr.Â Oscar Hidalgo Mora â€“ Pediatra</p>';
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
    html += `<p><strong>CategorÃ­a:</strong> ${guide.category}</p>`;
    html += `<p><strong>Ãšltima actualizaciÃ³n:</strong> ${guide.date}</p>`;
    // If the guide includes a PDF attachment, display a link for users to download it
    if (guide.pdf && guide.pdf.name && guide.pdf.data) {
      html += `<p><strong>Documento PDF:</strong> <a href="${guide.pdf.data}" download="${guide.pdf.name}">${guide.pdf.name}</a></p>`;
    }
    // Download menu placed at the beginning of each guide view.  It opens
    // into the two requested formats: PDF in A5 and Word.
    html += '<div class="download-dropdown" style="margin-top: 10px; text-align:center; position:relative;">' +
      '<button class="view-guide-btn download-main-btn">Descargar â–¾</button>' +
      '<div class="download-menu hidden" style="margin-top:8px;">' +
        '<button class="view-guide-btn download-pdf-btn">Descargar PDF (A5)</button>' +
        '<button class="view-guide-btn download-word-btn" style="margin-left:8px;">Descargar Word</button>' +
      '</div>' +
    '</div>';

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
    // QR code container placeholder.
    html += '<div id="qrContainer" style="margin-top:20px; text-align:center;"></div>';
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
    // Download dropdown behavior plus PDF and Word download actions
    const downloadMainBtn = modal.querySelector('.download-main-btn');
    const downloadMenu = modal.querySelector('.download-menu');
    if (downloadMainBtn && downloadMenu) {
      downloadMainBtn.addEventListener('click', () => {
        downloadMenu.classList.toggle('hidden');
      });
    }
    const pdfBtn = modal.querySelector('.download-pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => printGuide(guide));
    }
    const wordBtn = modal.querySelector('.download-word-btn');
    if (wordBtn) {
      wordBtn.addEventListener('click', () => downloadWord(guide));
    }
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
      img.alt = 'QR para informaciÃ³n de la guÃ­a';
      img.style.marginBottom = '6px';
      container.appendChild(img);
      const caption = document.createElement('div');
      caption.style.fontSize = '0.8rem';
      caption.textContent = 'Escanee para ver informaciÃ³n de la guÃ­a';
      container.appendChild(caption);
    } catch (err) {
      container.textContent = 'ðŸ”³';
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
    // Helper to display summary.  We no longer generate an image; only the
    // summary text is shown to the user.  When a summary is created, the
    // download PDF button will be made visible.
    const displayResults = (summary) => {
      if (articleSummaryResult) {
        articleSummaryResult.textContent = summary;
      }
    };
    // Attempt to extract text based on file type
    try {
      if (ext === 'doc' || ext === 'docx') {
        // Use JSZip to extract text from a .docx file.  We read the file
        // as an ArrayBuffer, unzip it and grab the word/document.xml entry.
        const reader = new FileReader();
        reader.onload = async (e) => {
          const buffer = e.target.result;
          let text = '';
          try {
            const zip = await JSZip.loadAsync(buffer);
            const docXml = await zip.file('word/document.xml').async('string');
            // Extract text from <w:t> elements; fallback by stripping tags
            const matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/gi);
            if (matches) {
              text = matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
            } else {
              text = docXml.replace(/<[^>]+>/g, ' ');
            }
          } catch (err) {
            console.error(err);
            alert('No se pudo extraer texto del documento Word.');
            return;
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
      } else if (ext === 'pdf') {
        // PDF extraction is limited; attempt to decode the file to text using
        // UTFâ€‘8 as a fallback.  Note: proper PDF parsing requires a library
        // like pdf.js; without it, some PDFs may not produce readable output.
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target.result;
          let text = '';
          try {
            const decoder = new TextDecoder('utf-8');
            text = decoder.decode(buffer);
          } catch (err) {
            text = '';
          }
          if (!text.trim()) {
            alert('No se pudo extraer texto legible del archivo PDF. ConviÃ©rtalo a texto e intÃ©ntelo de nuevo.');
            return;
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
      return cleaned.slice(0, 300) + (cleaned.length > 300 ? 'â€¦' : '');
    }
    // Combine up to three sentences
    const selected = sentences.slice(0, 3).join(' ').trim();
    return selected || cleaned.slice(0, 300) + (cleaned.length > 300 ? 'â€¦' : '');
  }

  // Override generateSummary with an improved frequencyâ€‘based summarisation algorithm.
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
      return cleaned.slice(0, 300) + (cleaned.length > 300 ? 'â€¦' : '');
    }
    // Combined Spanish and English stopwords
    const stopwords = new Set([
      'a','al','algo','algunas','algunos','ante','antes','como','con','contra','cual','cuando','de','del','desde','donde','durante','e','el','ella','ellas','ellos','en','entre','era','erais','eran','eras','eres','es','esa','esas','ese','eso','esos','esta','estaba','estabais','estaban','estabas','estad','estada','estadas','estado','estados','estÃ¡is','estamos','estÃ¡n','estÃ¡s','este','esto','estos','estoy','fue','fuera','fuerais','fueran','fueras','fueron','fui','fuimos','ha','habÃ©is','habÃ­a','habÃ­ais','habÃ­amos','habÃ­an','habÃ­as','han','has','hasta','hay','haya','hayamos','hayan','hayas','he','hemos','hola','hube','hubiera','hubierais','hubieran','hubieras','hubieron','hubiese','hubieseis','hubiesen','hubieses','hubimos','hubiste','hubisteis','la','las','le','les','lo','los','mÃ¡s','me','mi','mis','mucho','muy','no','nos','nosotras','nosotros','nuestra','nuestras','nuestro','nuestros','o','os','otra','otros','para','pero','poco','por','porque','que','quedÃ³','quÃ©','sea','sean','ser','serÃ¡n','si','siempre','sin','sobre','son','su','sus','tambiÃ©n','tampoco','te','tendrÃ¡','tenÃ©is','tenemos','tienen','tienes','todo','todos','tu','tus','un','una','unas','uno','unos','vosotras','vosotros','vuestra','vuestras','vuestro','vuestros','ya','yo',
      'the','and','or','but','for','nor','yet','so','a','an','any','are','as','at','be','been','being','by','can','could','did','do','does','doing','from','have','has','had','if','in','into','is','it','its','of','on','our','ours','that','their','them','these','they','this','to','was','were','what','when','where','which','who','will','with','would','you','your','yours','i','we','he','she','my','me','him','her','his','hers'
    ]);
    // Word frequency count
    const allWords = cleaned.toLowerCase().match(/[a-zÃ¡Ã©Ã­Ã³ÃºÃ±Ã¼]+/gi) || [];
    const freq = {};
    allWords.forEach((w) => {
      if (!stopwords.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });
    // Score each sentence
    const scored = sentences.map((sent, idx) => {
      const words = (sent.toLowerCase().match(/[a-zÃ¡Ã©Ã­Ã³ÃºÃ±Ã¼]+/gi) || []);
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
      summary = cleaned.slice(0, 300) + (cleaned.length > 300 ? 'â€¦' : '');
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
        <title>Resumen de artÃ­culo</title>
        ${styles}
      </head>
      <body>
        <h1>Resumen de artÃ­culo</h1>
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
        /* Set A5 page size when printing.  The margin ensures content
           does not touch the edges. */
        @page { size: A5; margin: 15mm; }
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
    content += `<p class="author">Elaborado por Dr.Â Oscar Hidalgo Mora â€“ Pediatra</p>`;
    content += `<p><strong>CategorÃ­a:</strong> ${guide.category}</p>`;
    content += `<p><strong>Ãšltima actualizaciÃ³n:</strong> ${guide.date}</p>`;
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
    content += '<p style="font-size: 0.8rem; margin-top: 30px;">Este documento tiene fines educativos y no sustituye una valoraciÃ³n mÃ©dica individual.</p>';
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${guide.title}</title>${styles}</head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.onload = function () {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  }

  /**
   * Download the guide as a Word document (.doc).  This function
   * constructs a simple HTML document encapsulating the guide
   * content and uses a Blob with a MIME type of
   * application/msword.  Modern versions of Microsoft Word and
   * LibreOffice can open this file.  The content includes the
   * dynamic sections with styled text, images and lists.  The
   * filename is derived from the guide title.
   *
   * @param {Object} guide The guide object to convert into a Word file
   */
  function downloadWord(guide) {
    // Build a standalone HTML document for the Word file
    const styles = `
      <style>
        body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
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
    content += `<p class="author">Elaborado por Dr.Â Oscar Hidalgo Mora â€“ Pediatra</p>`;
    content += `<p><strong>CategorÃ­a:</strong> ${guide.category}</p>`;
    content += `<p><strong>Ãšltima actualizaciÃ³n:</strong> ${guide.date}</p>`;
    // Cover image
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
    // Sections
    if (guide.sections && Array.isArray(guide.sections)) {
      guide.sections.forEach((sec) => {
        content += `<h2>${sec.question}</h2>`;
        content += `<div>${sec.answer || ''}</div>`;
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
    content += '<p style="font-size: 0.8rem; margin-top: 30px;">Este documento tiene fines educativos y no sustituye una valoraciÃ³n mÃ©dica individual.</p>';
    // Compose the full HTML file
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${styles}</head><body>${content}</body></html>`;
    // Create a Blob for Word.  Prepend BOM to preserve UTFâ€‘8 encoding.
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Sanitize the filename by replacing spaces and special characters
    const safeTitle = guide.title.replace(/[^\w\d\- ]/g, '').trim().replace(/\s+/g, '_');
    link.download = `${safeTitle || 'guia'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Initialise the PediBot helper.  This function attaches event listeners
   * to the PediBot toggle button and cycles through the array of
   * paediatric messages every 45 seconds.  Messages only update
   * when the message container is visible.  Called when the user logs in or
   * enters as guest.
   */
  function startPediBot() {
    const pediBot = document.getElementById('pediBot');
    const pediBotToggle = document.getElementById('pediBotToggle');
    const pediBotMessages = document.getElementById('pediBotMessages');
    if (!pediBot || !pediBotToggle || !pediBotMessages) return;
    // Ensure the bot is visible on screen
    pediBot.classList.remove('hidden');
    // Toggle the visibility of the message container when clicking the icon
    pediBotToggle.addEventListener('click', () => {
      pediBotMessages.classList.toggle('hidden');
    });
    // Function to display the next message
    const showMessage = () => {
      if (!pediBotMessages.classList.contains('hidden')) {
        const msg = PEDI_MESSAGES[pediBotIndex];
        pediBotMessages.innerHTML = `<p>${msg}</p>`;
        pediBotIndex = (pediBotIndex + 1) % PEDI_MESSAGES.length;
      }
    };
    // Clear any existing interval to avoid duplicates
    if (pediBotInterval) {
      clearInterval(pediBotInterval);
    }
    // Start interval to update messages every 45 seconds
    pediBotInterval = setInterval(showMessage, 45000);
    // Show the first message after a short delay
    setTimeout(showMessage, 5000);
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
    // The PediBot feature has been removed and is no longer started.
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
