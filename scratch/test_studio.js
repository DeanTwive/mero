const http = require('http');

async function testStudio() {
  console.log("Testing Studio Dual-Mode on http://localhost:8085/ ...");
  
  const res = await fetch('http://localhost:8085/');
  const html = await res.text();

  const checks = [
    { name: 'Firebase Storage in importmap', ok: html.includes('"firebase/storage"') },
    { name: 'Studio Tab: Upload File', ok: html.includes('id="tabUploadFile"') },
    { name: 'Studio Tab: Embed Link', ok: html.includes('id="tabEmbedLink"') },
    { name: 'Upload Panel container', ok: html.includes('id="studioUploadPanel"') },
    { name: 'Embed Panel container', ok: html.includes('id="studioEmbedPanel"') },
    { name: 'Upload dropzone', ok: html.includes('id="uploadDropzone"') },
    { name: 'Upload video file input', ok: html.includes('id="uploadVideoFile"') },
    { name: 'Upload progress bar container', ok: html.includes('id="uploadProgressContainer"') },
    { name: 'Zero-Host Iframe Protocol notice', ok: html.includes('Zero-Host Iframe Protocol') },
    { name: 'Sidebar Studio button', ok: html.includes('id="sidebarStudioBtn"') },
    { name: 'Top Header Upload button', ok: html.includes('id="topUploadBtn"') },
    { name: 'Mobile Bottom Bar Upload button', ok: html.includes('id="mobileUploadBtn"') },
    { name: 'No Firebase badge in tabs', ok: !html.includes('tab-badge firebase') },
    { name: 'No technical storage banner in modal', ok: !html.includes('storage-protocol-badge') },
    { name: 'Clean submit button text', ok: html.includes('Upload & Publish Video') },
    { name: 'Two-column category/thumbnail grid', ok: html.includes('form-grid-2') }
  ];

  let allPass = true;
  checks.forEach(c => {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.name}`);
    if (!c.ok) allPass = false;
  });

  const cssRes = await fetch('http://localhost:8085/css/components.css');
  const css = await cssRes.text();
  const cssChecks = [
    { name: 'CSS: .studio-tab-selector', ok: css.includes('.studio-tab-selector') },
    { name: 'CSS: .upload-dropzone', ok: css.includes('.upload-dropzone') },
    { name: 'CSS: .dropzone-selected-file', ok: css.includes('.dropzone-selected-file') },
    { name: 'CSS: .upload-progress-container', ok: css.includes('.upload-progress-container') }
  ];

  cssChecks.forEach(c => {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.name}`);
    if (!c.ok) allPass = false;
  });

  if (allPass) {
    console.log("\n✅ ALL STUDIO VALIDATION CHECKS PASSED!");
  } else {
    console.error("\n❌ SOME CHECKS FAILED!");
    process.exit(1);
  }
}

testStudio().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
