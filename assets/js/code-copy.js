// Copy code block functionality
(function() {
  function init() {
    // Find all code blocks (highlight divs contain the code)
    const codeBlocks = document.querySelectorAll('.highlight, pre:not(.highlight pre)');
    
    codeBlocks.forEach((block) => {
      // Skip if already has a copy button
      if (block.querySelector('.copy-button')) return;
      
      // Create wrapper if needed for positioning
      if (!block.classList.contains('code-block-wrapper')) {
        block.style.position = 'relative';
      }
      
      // Create copy button
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.setAttribute('aria-label', 'Copy code to clipboard');
      button.innerHTML = `
        <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
      
      // Add click handler
      button.addEventListener('click', async () => {
        const code = block.querySelector('code') || block.querySelector('pre');
        const text = code ? code.textContent : block.textContent;
        
        try {
          await navigator.clipboard.writeText(text);
          
          // Show success state
          button.classList.add('copied');
          button.querySelector('.copy-icon').style.display = 'none';
          button.querySelector('.check-icon').style.display = 'block';
          
          // Reset after 2 seconds
          setTimeout(() => {
            button.classList.remove('copied');
            button.querySelector('.copy-icon').style.display = 'block';
            button.querySelector('.check-icon').style.display = 'none';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
      
      block.appendChild(button);
    });
  }
  
  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

