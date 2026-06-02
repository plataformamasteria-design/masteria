const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/login');
  // Login first
  await page.fill('input[name="email"]', 'dev@masteria.com');
  await page.fill('input[name="password"]', 'dev123');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation();
  await page.goto('http://localhost:3000/agenda');
  await page.waitForTimeout(3000); // wait for load
  
  const aside = await page.$('aside');
  if (aside) {
    const box = await aside.boundingBox();
    console.log("ASIDE EXISTS:", box);
  } else {
    console.log("ASIDE DOES NOT EXIST");
  }
  
  // Also check spacer
  const spacer = await page.evaluate(() => {
    const div = document.querySelector('.flex-shrink-0.hidden.md\\:flex');
    if (!div) return null;
    const rect = div.getBoundingClientRect();
    return { width: rect.width, height: rect.height, display: window.getComputedStyle(div).display };
  });
  console.log("SPACER:", spacer);
  
  await browser.close();
})();
