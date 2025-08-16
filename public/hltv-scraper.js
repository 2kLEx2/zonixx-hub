// HLTV Scraper using puppeteer-extra with stealth plugin
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Apply stealth plugin
puppeteer.use(StealthPlugin());

async function getMatchLink(page, teamFilter) {
  console.log(`🔄 Going back to: https://www.hltv.org/matches`);
  await page.goto('https://www.hltv.org/matches', { waitUntil: 'domcontentloaded' });

  // Accept cookie if needed
  try {
    await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', {
      timeout: 5000
    });
    await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
    console.log('🍪 Cookie consent accepted');
  } catch {
    console.log('⚠️ No cookie popup found or already accepted');
  }

  await page.waitForSelector('.match', { timeout: 15000 });
  await new Promise(res => setTimeout(res, 3000));

  // Extract matches from the page
  return await page.evaluate((teams) => {
    const allMatches = Array.from(document.querySelectorAll('.match'));
    const results = [];

    for (const match of allMatches) {
      const teamNames = Array.from(match.querySelectorAll('.match-teamname'));
      const anchor = match.querySelector('a.match-top, a.match-info');

      if (teamNames.length < 2 || !anchor) continue;

      const team1 = teamNames[0].textContent.trim();
      const team2 = teamNames[1].textContent.trim();
      const link = anchor.href.startsWith('http') ? anchor.href : `https://www.hltv.org${anchor.getAttribute('href')}`;

      const matched = teams.some((team) =>
        team1.toLowerCase().includes(team.toLowerCase()) ||
        team2.toLowerCase().includes(team.toLowerCase())
      );

      if (matched) {
        results.push({ team1, team2, url: link });
      }
    }

    return results;
  }, teamFilter);
}

/**
 * Scrapes HLTV.org to find match links based on team names
 * @param {Array} matches - Array of match objects with team names
 * @returns {Promise<Array>} - Same array with HLTV links added
 */
async function scrapeHLTVLinks(matches) {
  console.log('Starting HLTV scraper in stealth mode...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const updatedMatches = [];

    for (const match of matches) {
      console.log(`\n🔍 Processing match: ${match.team1.name} vs ${match.team2.name}`);

      if (match.link) {
        console.log(`➡️ Already has link: ${match.link}`);
        updatedMatches.push(match);
        continue;
      }

      const teamFilter = [match.team1.name, match.team2.name];
      const matchLinks = await getMatchLink(page, teamFilter);

      const updatedMatch = { ...match };

      if (matchLinks.length > 0) {
        const matchURL = matchLinks[0].url;
        console.log(`🔗 Found link: ${matchURL}`);
        updatedMatch.link = matchURL;

        try {
          await page.goto(matchURL, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.standard-box.veto-box .preformatted-text', { timeout: 5000 });

          const formatText = await page.$eval('.standard-box.veto-box .preformatted-text', el => el.innerText);
          const formatMatch = formatText.match(/Best of (\d)/i);

          if (formatMatch) {
            updatedMatch.format = `Bo${formatMatch[1]}`;
            console.log(`✅ Format extracted: ${updatedMatch.format}`);
          } else {
            updatedMatch.format = null;
            console.log('⚠️ Format not found');
          }
        } catch (err) {
          console.warn('⚠️ Error extracting format:', err.message);
          updatedMatch.format = null;
        }
      } else {
        console.log('❌ No match link found');
        updatedMatch.link = null;
        updatedMatch.format = null;
      }

      updatedMatches.push(updatedMatch);
    }

    return updatedMatches;
  } catch (error) {
    console.error('❌ Error scraping HLTV:', error);
    return matches;
  } finally {
    await browser.close();
    console.log('\n✅ HLTV scraper finished');
  }
}

/**
 * Updates the selected_matches.json file with HLTV links
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function updateSelectedMatchesWithHLTVLinks() {
  try {
    const selectedMatchesPath = path.join(__dirname, 'selected_matches.json');
    console.log(`📂 Reading from: ${selectedMatchesPath}`);

    if (!fs.existsSync(selectedMatchesPath)) {
      console.error('❌ File not found');
      return false;
    }

    const fileContent = fs.readFileSync(selectedMatchesPath, 'utf-8');
    let data;

    try {
      data = JSON.parse(fileContent);
    } catch (err) {
      console.error('❌ Error parsing JSON:', err);
      return false;
    }

    if (!data.selected_matches || data.selected_matches.length === 0) {
      console.log('ℹ️ No selected matches to process');
      return false;
    }

    console.log(`🧠 Processing ${data.selected_matches.length} selected matches`);
    data.selected_matches = await scrapeHLTVLinks(data.selected_matches);

    if (data.parallel_matches && data.parallel_matches.length > 0) {
      console.log(`🧠 Processing ${data.parallel_matches.length} parallel matches`);
      data.parallel_matches = await scrapeHLTVLinks(data.parallel_matches);
    }

    fs.writeFileSync(selectedMatchesPath, JSON.stringify(data, null, 2));
    console.log('✅ selected_matches.json updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to update matches:', error);
    return false;
  }
}

module.exports = { scrapeHLTVLinks, updateSelectedMatchesWithHLTVLinks };
