document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('level-selector');
  const buttons = document.querySelectorAll('.level-btn');
  const levelDisplay = document.getElementById('current-level');

  // T007: Initial state
  chrome.storage.local.get('selectedLevel', ({ selectedLevel }) => {
    const activeLevel = selectedLevel || 'A1';
    levelDisplay.textContent = activeLevel;
    const activeBtn = Array.from(buttons).find(btn => btn.dataset.level === activeLevel);
    if (activeBtn) activeBtn.classList.add('active');
  });

  // Handle level selection (T004)
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;

    const selectedLevel = btn.dataset.level;
    
    // Save to storage
    chrome.storage.local.set({ selectedLevel }, () => {
      levelDisplay.textContent = selectedLevel;
      
      // Update active state (Visual feedback US2/T007 preview - usually would wait but UI needs it)
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
