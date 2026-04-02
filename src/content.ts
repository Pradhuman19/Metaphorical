/**
 * News Cross-Check Content Script
 * Handles article scraping and messaging to the Side Panel
 */

console.log('[News Cross-Check] Content Script Loaded');

interface ScrapedData {
  title: string;
  body: string;
  author: string;
  date: string;
  url: string;
}

/**
 * Extracts the main headline
 */
function getHeadline(): string {
  const h1 = document.querySelector('h1');
  if (h1) return h1.innerText.trim();
  
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle instanceof HTMLMetaElement) return ogTitle.content.trim();

  return document.title.split('-')[0].trim();
}

/**
 * Extracts the main article body, cleaning out ads/nav
 */
function getBodyText(): string {
  // Try to find the main article container
  const article = document.querySelector('article') || document.querySelector('main');
  if (!article) return '';

  // Get all paragraphs, but filter out those that look like ads/nav
  const paragraphs = Array.from(article.querySelectorAll('p'));
  
  return paragraphs
    .map(p => p.innerText.trim())
    .filter(text => text.length > 50) // Ignore short menu/nav snippets
    .slice(0, 10) // Take the first 10 relevant paragraphs for analysis
    .join('\n\n');
}

/**
 * Extracts author information
 */
function getAuthor(): string {
  const authorMeta = document.querySelector('meta[name="author"]') || 
                    document.querySelector('meta[property="article:author"]');
  if (authorMeta instanceof HTMLMetaElement) return authorMeta.content.trim();

  const byline = document.querySelector('.byline') || 
                 document.querySelector('[class*="author"]') ||
                 document.querySelector('[rel="author"]');
  
  return byline ? (byline as HTMLElement).innerText.trim() : 'Unknown Author';
}

/**
 * Extracts publication date
 */
function getDate(): string {
  const timeTag = document.querySelector('time');
  if (timeTag) return timeTag.getAttribute('datetime') || timeTag.innerText.trim();

  const dateMeta = document.querySelector('meta[property="article:published_time"]');
  if (dateMeta instanceof HTMLMetaElement) return dateMeta.content.trim();

  return new Date().toLocaleDateString();
}

/**
 * Scrapes the entire page
 */
function scrapePage(): ScrapedData {
  return {
    title: getHeadline(),
    body: getBodyText(),
    author: getAuthor(),
    date: getDate(),
    url: window.location.href
  };
}

// Listen for requests from the Side Panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'SCRAPE_ARTICLE') {
    console.log('[News Cross-Check] Scraping current page...');
    const data = scrapePage();
    sendResponse(data);
  }
  return true; // Keep channel open for async response
});

// Proactively send data on load if the side panel might already be open
// (Note: Side panel usually initiates the request)
