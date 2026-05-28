const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const artifactsDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\a6cab247-aef9-4b47-bb59-eb01265e9a3a\\artifacts';
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  try {
    console.log('Navigating to login...');
    await page.goto('https://masteria.app/login');
    await page.waitForTimeout(2000);
    
    console.log('Clicking "Fazer Login"...');
    const fazerLoginBtn = page.getByRole('button', { name: 'Fazer Login' });
    if (await fazerLoginBtn.count() > 0) {
        await fazerLoginBtn.first().click();
        await page.waitForTimeout(1000);
    }
    
    console.log('Logging in...');
    await page.fill('input[name="email"]', 'isadorahpaulino@masteria.app');
    await page.fill('input[name="password"]', 'SenhaMaster#100');
    await page.click('button[type="submit"]');

    console.log('Waiting for dashboard...');
    await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => console.log('Timeout waiting for /dashboard. URL is ' + page.url()));
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(artifactsDir, 'step1-dashboard.png') });
    console.log('Dashboard screenshot captured.');

    console.log('Navigating to connections...');
    await page.goto('https://masteria.app/connections');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(artifactsDir, 'step2-connections.png') });
    console.log('Connections screenshot captured.');

    const buttonTexts = ['Manual', 'Nova Conexão', 'Adicionar Conexão', 'Adicionar', '+ Nova', 'Nova'];
    let buttonClicked = false;
    for (const text of buttonTexts) {
      const btn = page.getByRole('button', { name: text, exact: false });
      if (await btn.count() > 0) {
        await btn.first().click();
        buttonClicked = true;
        console.log(`Clicked button: ${text}`);
        break;
      }
    }
    
    if (buttonClicked) {
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(artifactsDir, 'step3-modal-selecao.png') });
        console.log('Modal screenshot captured.');
        
        const cardTexts = ['Evolution', 'API Não Oficial', 'Baileys', 'QR Code', 'Whatsapp'];
        for (const text of cardTexts) {
          const card = page.getByText(text, { exact: false });
          if (await card.count() > 0) {
             await card.first().click();
             console.log(`Clicked option: ${text}`);
             break;
          }
        }
        
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(artifactsDir, 'step4-config-conexao.png') });
        console.log('Config screenshot captured.');
    }

  } catch (e) {
    console.error('Error during automation:', e);
  } finally {
    await browser.close();
  }
})();
