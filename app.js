// Simple Puzzle Baron style cryptogram for OSI Model (7 layers)
(function(){
  // --- Data: unencrypted descriptions for each OSI layer ---
  // Use the exact two-sentence aristocrat plaintexts specified by the user
  const layers = [
    { id:1, name:'Physical', colorClass:'layer-Physical', text: `The Physical layer is responsible for transmitting raw bits across a physical medium such as cables or radio waves. It defines electrical, mechanical, and signaling standards to ensure reliable communication between devices.` },
    { id:2, name:'Data Link', colorClass:'layer-DataLink', text: `The Data Link layer provides node-to-node communication and handles error detection, correction, and flow control. It ensures that data frames are delivered reliably across the physical connection.` },
    { id:3, name:'Network', colorClass:'layer-Network', text: `The Network layer determines the best path for data to travel between devices across multiple networks. It handles logical addressing, routing, and packet forwarding to enable connectivity on a global scale.` },
    { id:4, name:'Transport', colorClass:'layer-Transport', text: `The Transport layer ensures complete end-to-end delivery of data between applications. It provides segmentation, error recovery, and flow control through protocols such as TCP and UDP.` },
    { id:5, name:'Session', colorClass:'layer-Session', text: `The Session layer establishes, manages, and terminates connections between applications. It coordinates communication, maintains dialogs, and supports synchronization during data exchange.` },
    { id:6, name:'Presentation', colorClass:'layer-Presentation', text: `The Presentation layer translates data into a format that applications can interpret and use. It manages encryption, compression, and character encoding to maintain compatibility between systems.` },
    { id:7, name:'Application', colorClass:'layer-Application', text: `The Application layer provides direct interfaces for user interaction with network services. It supports functions such as email, file transfer, and web browsing, enabling meaningful communication.` },
  ];

  // Utility: generate a random substitution cipher mapping A-Z -> A-Z (no letter maps to itself optionally)
  function generateCipher(){
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const shuffled = letters.slice().sort(()=>Math.random()-0.5);
    // Ensure no-letter-map-to-self by reshuffling if any fixed points
    for(let attempt=0; attempt<100; attempt++){
      let ok=true;
      for(let i=0;i<26;i++){ if(shuffled[i]===letters[i]){ ok=false; break } }
      if(ok) break;
      shuffled.sort(()=>Math.random()-0.5);
    }
    const map = {};
    for(let i=0;i<26;i++) map[letters[i]] = shuffled[i];
    return map;
  }

  // Encrypt a text with mapping (preserve case and non-letters)
  function encrypt(text, map){
    return text.split('').map(ch=>{
      const up = ch.toUpperCase();
      if(up>='A'&&up<='Z'){
        const c = map[up];
        // preserve original case
        return (ch === up) ? c : c.toLowerCase();
      }
      return ch;
    }).join('');
  }

  // Frequency map of encrypted letters (A-Z uppercase)
  function freqMap(encrypted){
    const freq = {};
    for(const ch of encrypted.toUpperCase()){
      if(ch>='A'&&ch<='Z') freq[ch] = (freq[ch]||0)+1;
    }
    return freq;
  }

  // Also compute per-puzzle cipher frequency map for rendering under boxes

  // Build puzzle objects with ciphered text and frequency
  const puzzles = layers.map(layer=>{
    const cipher = generateCipher();
    const encrypted = encrypt(layer.text, cipher);
    const freq = freqMap(encrypted);
    return {
      layer: layer.name,
      id: layer.id,
      colorClass: layer.colorClass,
      solutionText: layer.text,
      encryptedText: encrypted,
      cipherMap: cipher,
      frequencyMap: freq,
    };
  });

  // State
  let current = 0; // index in puzzles
  // Use cipher->plain mapping for guesses to make conflict detection straightforward
  const guesses = {}; // { CIPHER_LETTER: PLAINTEXT_LETTER }
  const solvedLetters = new Set();
  // Allow switching between all seven puzzles — unlock all levels so user can visit any puzzle
  const unlocked = new Set([1,2,3,4,5,6,7]);
  // Track hints used per puzzle (limit to maxHints)
  const maxHints = 3;
  const hintsUsed = {};
  // Persistence key
  const STORAGE_KEY = 'osi_cryptogram_v1';

  // DOM refs
  const levelsEl = document.getElementById('levels');
  const gridEl = document.getElementById('grid');
  const freqListEl = document.getElementById('freq-list');
  const layerTitle = document.getElementById('layer-title');
  const hintCountEl = document.createElement('span');
  hintCountEl.id = 'hint-count';
  // We'll insert this near the hint button later
  const resetBtn = document.getElementById('reset-btn');
  const hintBtn = document.getElementById('hint-btn');
  const checkBtn = document.getElementById('check-btn');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');
  let lastFocusedElement = null;
  const feedback = document.getElementById('feedback');
  const congratsModal = document.getElementById('congrats-modal');
  const modalPuzzleList = document.getElementById('modal-puzzle-list');
  const restartAllBtn = document.getElementById('restart-all');
  const congratsClose = document.getElementById('congrats-close');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // Initialize level buttons
  function renderLevelButtons(){
    levelsEl.innerHTML = '';
    for(const p of puzzles){
      const btn = document.createElement('button');
      btn.textContent = `${p.id}. ${p.layer}`;
      btn.className = p.colorClass;
      btn.disabled = !unlocked.has(p.id);
      btn.title = unlocked.has(p.id) ? 'Click to play' : 'Locked';
      if(p.id===current+1) btn.style.outline = '2px solid rgba(255,255,255,0.06)';
      btn.addEventListener('click', ()=>{
        if(unlocked.has(p.id)) loadPuzzle(p.id-1);
      });
      levelsEl.appendChild(btn);
    }
  }

  // Render puzzle grid in Puzzle Baron style
  function renderGrid(){
    const p = puzzles[current];
    layerTitle.textContent = `${p.id}. ${p.layer}`;
    gridEl.innerHTML = '';
    // container to apply color class
    gridEl.className = p.colorClass;
    // compute cipher frequency map for this puzzle (A-Z uppercase)
    const cipherFreq = {};
    for(const ch of p.encryptedText.toUpperCase()) if(ch>='A'&&ch<='Z') cipherFreq[ch] = (cipherFreq[ch]||0)+1;

    // Build representation grouped by words so words are not split across lines
    const words = p.encryptedText.split(/(\s+)/); // keep spaces
    for(const token of words){
      if(token.trim()===''){
        // it's whitespace — render as a wide gap
        const gap = document.createElement('span');
        gap.className = 'non-letter';
        gap.textContent = ' '; // visual spacer; CSS .word handles spacing
        gridEl.appendChild(gap);
        continue;
      }
      // token contains a word (letters and punctuation)
      const wordEl = document.createElement('div');
      wordEl.className = 'word';
      for(let i=0;i<token.length;i++){
        const ch = token[i];
        if(/[A-Za-z]/.test(ch)){
          const box = document.createElement('div');
          box.className = 'letter-box';
          const cipherSpan = document.createElement('div');
          cipherSpan.className = 'cipher-letter';
          cipherSpan.textContent = ch.toUpperCase();
          const inputSpan = document.createElement('input');
          inputSpan.className = 'input-letter';
          inputSpan.maxLength = 1;
          inputSpan.value = guesses[ch.toUpperCase()] || '';
          inputSpan.dataset.cipher = ch.toUpperCase();
          inputSpan.addEventListener('input', onInputLetter);
          inputSpan.addEventListener('keydown', onKeyDown);
          box.appendChild(cipherSpan);
          box.appendChild(inputSpan);
          // add small frequency count under each box
          const fsmall = document.createElement('div');
          fsmall.className = 'freq-small';
          fsmall.textContent = cipherFreq[ch.toUpperCase()]||0;
          box.appendChild(fsmall);
          wordEl.appendChild(box);
        } else {
          // punctuation inside a word
          const span = document.createElement('span');
          span.className = 'non-letter';
          span.textContent = ch;
          wordEl.appendChild(span);
        }
      }
      gridEl.appendChild(wordEl);
    }
    renderFrequency();
    renderConflicts();
    updateHintCount();
    saveState();
  }

  // Return plaintext guess for an encrypted letter (cipher) or empty string
  function getGuessForCipher(cipher){
    return guesses[cipher] || '';
  }

  // Return the cipher letters that currently map to the given plaintext (for conflict detection)
  function ciphersForPlain(plain){
    const list = [];
    for(const [c,p] of Object.entries(guesses)) if(p===plain) list.push(c);
    return list;
  }

  // Handle input in a letter box
  function onInputLetter(e){
    const el = e.target;
    const cipher = el.dataset.cipher;
    const val = (el.value||'').toUpperCase();
    // Set guess for this cipher letter: record in guesses (cipher->plain)
    if(!val.match(/^[A-Z]$/) && val!==''){
      el.value = '';
      return;
    }
    if(val===''){
      delete guesses[cipher];
    } else {
      guesses[cipher] = val;
    }
    // update all inputs for this cipher across grid
    updateAllForCipher(cipher);
    // persist state after each change
    saveState();
    // auto-advance cursor when a valid letter was entered: find next empty input in the same word, else next word
    if(val.match(/^[A-Z]$/)) focusNextEmpty(el);
    // update conflicts visuals
    renderConflicts();
    updateProgress();
    checkSolved();
  }

  function onKeyDown(e){
    // Allow backspace to clear
    if(e.key==='Backspace'){ return; }
    // If Enter pressed in any input, trigger check
    if(e.key==='Enter'){
      e.preventDefault();
      checkAnswer();
    }
  }

  function updateAllForCipher(cipher){
    const inputs = gridEl.querySelectorAll('input[data-cipher]');
    inputs.forEach(inp=>{
      if(inp.dataset.cipher===cipher){
        inp.value = getGuessForCipher(cipher) || '';
      }
    });
  }

  // Move focus to next input box after successful input
  function focusNextInput(currentInput){
    const inputs = Array.from(gridEl.querySelectorAll('input[data-cipher]'));
    const idx = inputs.indexOf(currentInput);
    if(idx>=0 && idx < inputs.length-1){
      inputs[idx+1].focus();
    }
  }

  // Focus the next empty input in the current word; if none, move to first empty in next word
  function focusNextEmpty(currentInput){
    // find the parent .word of currentInput
    const word = currentInput.closest('.word');
    if(word){
      const inputs = Array.from(word.querySelectorAll('input[data-cipher]'));
      const idx = inputs.indexOf(currentInput);
      // check remaining inputs in same word
      for(let i=idx+1;i<inputs.length;i++) if(!inputs[i].value) { inputs[i].focus(); return; }
      // otherwise find first empty in next words
      const words = Array.from(gridEl.querySelectorAll('.word'));
      const widx = words.indexOf(word);
      for(let wi=widx+1; wi<words.length; wi++){
        const inps = Array.from(words[wi].querySelectorAll('input[data-cipher]'));
        for(const inp of inps) if(!inp.value){ inp.focus(); return; }
      }
    }
    // fallback: focus next empty input anywhere
    const allInputs = Array.from(gridEl.querySelectorAll('input[data-cipher]'));
    for(const inp of allInputs) if(!inp.value){ inp.focus(); return; }
  }

  function renderFrequency(){
    const p = puzzles[current];
    freqListEl.innerHTML='';
    // create items for letters A-Z that appear sorted by freq desc
    const entries = Object.entries(p.frequencyMap).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    for(const [ch,count] of entries){
      const item = document.createElement('div');
      item.className = 'freq-item';
      const top = document.createElement('div'); top.textContent = ch; top.style.fontWeight='700';
      const bottom = document.createElement('div'); bottom.textContent = count; bottom.style.fontSize='12px'; bottom.style.color='var(--muted)';
      item.appendChild(top); item.appendChild(bottom);
      freqListEl.appendChild(item);
    }
  }

  // Add conflict rendering: mark letter-boxes and frequency items when two different cipher letters map to the same plaintext
  function renderConflicts(){
    // Clear all conflict classes
    gridEl.querySelectorAll('.letter-box').forEach(b=>b.classList.remove('conflict'));
    freqListEl.querySelectorAll('.freq-item').forEach(f=>f.classList.remove('conflict'));
    // Build reverse map plain->list(cipher)
    const plainMap = {};
    for(const [c,p] of Object.entries(guesses)){
      if(!p) continue;
      plainMap[p] = plainMap[p] || [];
      plainMap[p].push(c);
    }
    for(const [plain, clist] of Object.entries(plainMap)){
      if(clist.length>1){
        // conflict: highlight all boxes with these cipher letters
        clist.forEach(c=>{
          gridEl.querySelectorAll(`input[data-cipher="${c}"]`).forEach(inp=>{
            const box = inp.closest('.letter-box'); if(box) box.classList.add('conflict');
          });
          // highlight freq item if present
          freqListEl.querySelectorAll('.freq-item').forEach(fi=>{ if(fi.firstChild && fi.firstChild.textContent===c) fi.classList.add('conflict'); });
        });
      }
    }
  }

  // --- Persistence: save and restore state to localStorage ---
  function saveState(){
    try{
      // compute solved status per puzzle from current guesses
      const solved = [];
      for(const p of puzzles){
        let built = '';
        for(let i=0;i<p.encryptedText.length;i++){
          const ch = p.encryptedText[i];
          if(/[A-Za-z]/.test(ch)){
            const c = ch.toUpperCase(); built += (guesses[c]?guesses[c]:'.');
          } else built += ch;
        }
        const normalizedBuilt = built.replace(/[^A-Z]/gi,'').toUpperCase();
        const normalizedSol = p.solutionText.replace(/[^A-Z]/gi,'').toUpperCase();
        if(normalizedBuilt===normalizedSol) solved.push(p.id);
      }
      const puzzlesState = puzzles.map(p=>({ cipherMap: p.cipherMap, encryptedText: p.encryptedText, frequencyMap: p.frequencyMap }));
      const state = {
        current,
        guesses,
        unlocked: Array.from(unlocked),
        hintsUsed,
        solved,
        puzzles: puzzlesState,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){ /* ignore */ }
  }

  function restoreState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return false;
      const state = JSON.parse(raw);
      if(state){
        // restore unlocked
        if(Array.isArray(state.unlocked)){
          unlocked.clear();
          for(const v of state.unlocked) unlocked.add(v);
        }
        // restore current index if present
        if(typeof state.current==='number') current = state.current;
        // restore guesses
        if(state.guesses && typeof state.guesses==='object'){
          for(const k of Object.keys(guesses)) delete guesses[k];
          for(const [k,v] of Object.entries(state.guesses)) guesses[k]=v;
        }
        // restore per-puzzle cipher/encrypted text if present
        if(Array.isArray(state.puzzles)){
          for(let i=0;i<state.puzzles.length && i<puzzles.length;i++){
            const sp = state.puzzles[i];
            if(sp.cipherMap) puzzles[i].cipherMap = sp.cipherMap;
            if(sp.encryptedText) puzzles[i].encryptedText = sp.encryptedText;
            if(sp.frequencyMap) puzzles[i].frequencyMap = sp.frequencyMap;
          }
        }
        // restore hintsUsed
        if(state.hintsUsed && typeof state.hintsUsed==='object'){
          for(const k of Object.keys(hintsUsed)) delete hintsUsed[k];
          for(const [k,v] of Object.entries(state.hintsUsed)) hintsUsed[k]=v;
        }
        // restore solved status (ensure unlocked contains solved items)
        if(Array.isArray(state.solved)){
          for(const id of state.solved) unlocked.add(id);
        }
        return true;
      }
    }catch(e){ /* ignore */ }
    return false;
  }

  // Show feedback message briefly
  function showFeedback(msg, timeout=1500){
    feedback.textContent = msg; feedback.classList.remove('hidden');
    setTimeout(()=> feedback.classList.add('hidden'), timeout);
  }

  function updateHintCount(){
    // compute number of unique vowels in solution and how many remain unrevealed
    const p = puzzles[current];
    const vowels = new Set(['A','E','I','O','U']);
    const uniqueVowels = new Set();
    for(const ch of p.solutionText.toUpperCase()) if(vowels.has(ch)) uniqueVowels.add(ch);
    const totalVowels = uniqueVowels.size;
    // how many vowels currently revealed via guesses
    const revealed = new Set();
    for(const [c,g] of Object.entries(guesses)) if(g && vowels.has(g)) revealed.add(g);
    const remaining = Math.max(0, totalVowels - revealed.size);
    hintCountEl.textContent = `${remaining} vowel hints left`;
    // attach to controls if not present
    const controls = document.getElementById('controls');
    if(controls && !controls.contains(hintCountEl)) controls.appendChild(hintCountEl);
  }

  function getPositionsForCipher(cipher, p){
    const pos = [];
    for(let i=0;i<p.encryptedText.length;i++){
      if(p.encryptedText[i].toUpperCase()===cipher) pos.push(i);
    }
    return pos;
  }

  function checkSolved(){
    const p = puzzles[current];
    // Reconstruct guessed plaintext and compare to solution (letters only)
    let built='';
    for(let i=0;i<p.encryptedText.length;i++){
      const ch = p.encryptedText[i];
      if(/[A-Za-z]/.test(ch)){
        const cipher = ch.toUpperCase();
        const guess = guesses[cipher];
        built += (guess?guess:'.');
      } else built += ch;
    }
    // Compare letters ignoring case and non letters—if equal, mark solved
    const normalizedBuilt = built.replace(/[^A-Z\.]/gi,'').toUpperCase();
    const normalizedSol = p.solutionText.replace(/[^A-Z]/gi,'').toUpperCase();
    if(normalizedBuilt===normalizedSol){
      // unlock next level
      if(p.id<7) unlocked.add(p.id+1);
      renderLevelButtons();
      // Show success modal directly
      showSuccessModal(p.solutionText);
    }
  }

  // Show success modal with green indicator and Next Puzzle button
  function showSuccessModal(plaintext){
    modalBody.textContent = plaintext;
    const successEl = document.getElementById('modal-success');
    if(successEl) successEl.classList.remove('hidden');
    // accessibility: save last focused element and trap focus in modal
    lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    modal.classList.add('showing');
    // focus the modal content for screen readers and keyboard users
    const content = document.getElementById('modal-content');
    if(content){ content.setAttribute('tabindex','-1'); content.focus(); }
    // remove animation class after it finishes
    setTimeout(()=> modal.classList.remove('showing'), 400);
    saveState();
    // populate list of other puzzles for navigation (exclude current)
    if(modalPuzzleList){
      modalPuzzleList.innerHTML = '';
      for(let i=0;i<puzzles.length;i++){
        if(i===current) continue; // don't include just-completed puzzle
        const p = puzzles[i];
        const li = document.createElement('div');
        li.setAttribute('role','listitem');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = p.colorClass;
        btn.textContent = `${p.id}. ${p.layer}`;
        btn.addEventListener('click', ()=>{
          modal.classList.add('hidden');
          unlocked.add(p.id); // ensure selectable
          renderLevelButtons();
          loadPuzzle(i);
          // focus first input after slight delay
          setTimeout(()=>{ const fi = gridEl.querySelector('input[data-cipher]'); if(fi) fi.focus(); }, 50);
        });
        li.appendChild(btn);
        modalPuzzleList.appendChild(li);
      }
    }
  }

  function goToNextUnsolved(){
    // find first puzzle with solved=false
    let nextIdx = -1;
    for(let i=0;i<puzzles.length;i++){
      const p = puzzles[i];
      // is solved: compare known guesses to solution
      let built='';
      for(let j=0;j<p.encryptedText.length;j++){
        const ch = p.encryptedText[j];
        if(/[A-Za-z]/.test(ch)){
          const c = ch.toUpperCase(); built += (guesses[c]?guesses[c]:'.');
        } else built += ch;
      }
      const normalizedBuilt = built.replace(/[^A-Z]/gi,'').toUpperCase();
      const normalizedSol = p.solutionText.replace(/[^A-Z]/gi,'').toUpperCase();
      if(normalizedBuilt!==normalizedSol){ nextIdx = i; break; }
    }
  // hide modal and restore focus
  modal.classList.add('hidden');
  if(lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
    if(nextIdx===-1){
      // all solved
      showCongratulationsModal();
      return;
    }
    // unlock and go to next
    unlocked.add(puzzles[nextIdx].id);
    renderLevelButtons();
    loadPuzzle(nextIdx);
  }

  function showCongratulationsModal(){
    congratsModal.classList.remove('hidden');
    // start confetti animation
    startConfetti();
    // trap focus in congrats modal
    lastFocusedElement = document.activeElement;
    const content = document.getElementById('congrats-content'); if(content){ content.setAttribute('tabindex','-1'); content.focus(); }
    saveState();
  }

  // Controls
  function clearGuesses(){
    for(const k of Object.keys(guesses)) delete guesses[k];
  }

  resetBtn.addEventListener('click', ()=>{
    // Clear guesses for current puzzle
    clearGuesses();
    renderGrid();
    updateHintCount();
  });

  hintBtn.addEventListener('click', ()=>{
    // reveal one unsolved cipher -> plaintext mapping
    const p = puzzles[current];
    // Determine unique vowels in plaintext and reveal one unrevealed vowel globally
    const vowels = new Set(['A','E','I','O','U']);
    // compute unique vowels present
    const present = new Set();
    for(const ch of p.solutionText.toUpperCase()) if(vowels.has(ch)) present.add(ch);
    const totalVowels = present.size;
    // determine which vowels are already revealed via guesses
    const revealed = new Set();
    for(const val of Object.values(guesses)) if(vowels.has(val)) revealed.add(val);
    // remaining vowels are those in present but not in revealed
    const remaining = Array.from([...present].filter(x=>!revealed.has(x)));
    if(remaining.length===0){ showFeedback('No unrevealed vowels remain'); return; }
    // reveal one vowel (first in remaining)
    const vowelToReveal = remaining[0];
    // reveal globally: for each cipher letter whose solution positions include this vowel, map cipher->vowel
    const letters = Object.keys(p.frequencyMap);
    for(const cipher of letters){
      const pos = getPositionsForCipher(cipher,p);
      for(const idx of pos){
        const actual = p.solutionText[idx].toUpperCase();
        if(actual===vowelToReveal){
          guesses[cipher] = actual;
          updateAllForCipher(cipher);
        }
      }
    }
    // consume one vowel-hint (hint counts are effectively remaining vowels)
    hintsUsed[p.id] = hintsUsed[p.id]||0;
    hintsUsed[p.id]++;
    showFeedback(`Vowel revealed: ${vowelToReveal}`);
    renderConflicts();
    updateHintCount();
    checkSolved();
  });

  // Check Answer: verifies current grid mapping against plaintext; shows modal if correct, feedback if wrong
  function checkAnswer(){
    const p = puzzles[current];
    // Reconstruct guessed plaintext
    let built='';
    for(let i=0;i<p.encryptedText.length;i++){
      const ch = p.encryptedText[i];
      if(/[A-Za-z]/.test(ch)){
        const cipher = ch.toUpperCase();
        const guess = guesses[cipher] || '.';
        built += guess;
      } else built += ch;
    }
    const normalizedBuilt = built.replace(/[^A-Z]/gi,'').toUpperCase();
    const normalizedSol = p.solutionText.replace(/[^A-Z]/gi,'').toUpperCase();
    if(normalizedBuilt===normalizedSol){
      // correct — show success modal with strong indicator
      showSuccessModal(p.solutionText);
    } else {
      showFeedback('Wrong answer');
    }
  }

  if(checkBtn) checkBtn.addEventListener('click', checkAnswer);
  if(modalClose) modalClose.addEventListener('click', ()=>{
    modal.classList.add('hidden');
    if(lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
    saveState();
  });
  if(restartAllBtn) restartAllBtn.addEventListener('click', ()=>{
    // reset all puzzles
    for(const p of puzzles){ hintsUsed[p.id]=0; }
    for(const k of Object.keys(guesses)) delete guesses[k];
    // Clear persisted state as well
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    // reload first puzzle
    loadPuzzle(0);
    congratsModal.classList.add('hidden');
    // stop confetti if running
    stopConfetti();
  });
  if(congratsClose) congratsClose.addEventListener('click', ()=>{
    congratsModal.classList.add('hidden');
    stopConfetti();
    if(lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
    saveState();
  });

  // close modals with Escape and trap focus within modals
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){
      if(!modal.classList.contains('hidden')){
        modal.classList.add('hidden');
        if(lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
      }
      if(!congratsModal.classList.contains('hidden')){
        congratsModal.classList.add('hidden');
        stopConfetti();
        if(lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
      }
    }
    // If a modal is open, trap Tab within it
    if(!modal.classList.contains('hidden')){
      trapTabKey(e, modal);
    }
    if(!congratsModal.classList.contains('hidden')){
      trapTabKey(e, congratsModal);
    }
  });

  function trapTabKey(e, container){
    if(e.key !== 'Tab') return;
    const focusable = container.querySelectorAll('a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])');
    if(focusable.length===0) return;
    const first = focusable[0];
    const last = focusable[focusable.length-1];
    if(e.shiftKey){ if(document.activeElement===first){ e.preventDefault(); last.focus(); } }
    else { if(document.activeElement===last){ e.preventDefault(); first.focus(); } }
  }

  // --- Confetti (simple) ---
  let confettiCtx = null;
  let confettiAnim = null;
  function startConfetti(){
    if(!confettiCanvas) return;
    confettiCanvas.classList.add('confetti-canvas');
    confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight;
    confettiCtx = confettiCanvas.getContext('2d');
    const pieces = [];
    for(let i=0;i<80;i++){
      pieces.push({ x: Math.random()*confettiCanvas.width, y: Math.random()*-confettiCanvas.height, w: 6+Math.random()*8, h: 8+Math.random()*10, dx: -1+Math.random()*2, dy: 2+Math.random()*4, color: `hsl(${Math.random()*360},70%,60%)` });
    }
    function step(){
      confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
      for(const p of pieces){
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(p.x, p.y, p.w, p.h);
        p.x += p.dx; p.y += p.dy;
        if(p.y>confettiCanvas.height){ p.y = -20; p.x = Math.random()*confettiCanvas.width; }
      }
      confettiAnim = requestAnimationFrame(step);
    }
    step();
  }
  function stopConfetti(){ if(confettiAnim) cancelAnimationFrame(confettiAnim); if(confettiCtx) confettiCtx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height); }

  // Load puzzle by index
  function loadPuzzle(idx){
    // switch in-progress in todo tool (follow plan rules)
    current = idx;
    // clear guesses for new puzzle (preserve persisted restore behavior is handled at startup)
    clearGuesses();
    renderLevelButtons();
    renderGrid();
    updateHintCount();
    saveState();
  }

  // Try to restore state on startup
  (function tryRestore(){
    const ok = restoreState();
    renderLevelButtons();
    if(ok){
      // if we restored state, load puzzle but keep guesses intact
      renderGrid();
      updateHintCount();
    } else {
      loadPuzzle(0);
    }
  })();

  // Start (if restore didn't already load)

})();
