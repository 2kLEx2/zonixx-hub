// Canvas Build System for Schedule Graphics
// Rebuilt based on test-canva.html layout

// Core canvas drawing utilities
class CanvasDrawingUtils {
  static drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  static truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    
    let truncatedText = text;
    const metrics = ctx.measureText(truncatedText);
    
    if (metrics.width <= maxWidth) {
      return truncatedText;
    }
    
    while (ctx.measureText(truncatedText + '...').width > maxWidth && truncatedText.length > 0) {
      truncatedText = truncatedText.slice(0, -1);
    }
    
    return truncatedText + '...';
  }
}

// Image loading and caching system
class ImageLoader {
  // Helper function to convert external URLs to proxy URLs to avoid CORS issues
  static getProxyUrl(url) {
    if (!url || url === '' || url.startsWith('data:')) {
      return url;
    }
    
    // Check if it's an external URL (from pandascore CDN)
    if (url.includes('cdn.pandascore.co')) {
      // Use a CORS proxy service
      return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }
    
    return url;
  }
  
  static async loadImages(urls) {
    if (!urls || urls.length === 0) {
      return {};
    }
    
    const imageCache = {};
    const uniqueUrls = [...new Set(urls.filter(url => url))];
    
    await Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Always set crossOrigin for all images
          
          const loadPromise = new Promise((resolve) => {
            img.onload = () => {
              console.log(`Loaded image: ${url.substring(0, 30)}...`);
              imageCache[url] = img; // Store with original URL as key
              resolve();
            };
            
            img.onerror = () => {
              console.error(`Failed to load image: ${url.substring(0, 30)}...`);
              resolve(); // Continue even if image fails to load
            };
          });
          
          // Use proxy URL for the actual loading
          const proxyUrl = ImageLoader.getProxyUrl(url);
          img.src = proxyUrl;
          console.log(`Loading image via: ${proxyUrl.substring(0, 50)}...`);
          
          await loadPromise;
        } catch (error) {
          console.error(`Error loading image ${url.substring(0, 30)}...`, error);
        }
      })
    );
    
    return imageCache;
  }
  
  static createPlaceholder(text = 'TM') {
    // Create a canvas for the placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 49;
    canvas.height = 49;
    const ctx = canvas.getContext('2d');
    
    // Draw a circular background
    ctx.fillStyle = '#828282';
    ctx.beginPath();
    ctx.arc(24.5, 24.5, 24.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw the text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 24.5, 24.5);
    
    return canvas;
  }
}

// Main Canvas Build System
class CanvasBuildSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.imageCache = {};
    this.placeholderCache = {};
  }
  
  // Helper method to get team initials for placeholders
  getTeamInitials(teamName) {
    if (!teamName) return 'TM';
    
    // Split by spaces and get first letter of each word
    const words = teamName.split(' ');
    
    if (words.length === 1) {
      // If single word, take first two letters
      return teamName.substring(0, 2).toUpperCase();
    } else {
      // Take first letter of first two words
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
  }

  async loadImages(matches) {
    if (!matches || matches.length === 0) return;
    
    // Extract all logo URLs
    const logoUrls = [];
    
    matches.forEach(match => {
      if (match.team1 && match.team1.logo) logoUrls.push(match.team1.logo);
      if (match.team2 && match.team2.logo) logoUrls.push(match.team2.logo);
    });
    
    // Create team-specific placeholders for teams without logos
    matches.forEach(match => {
      if (match.team1 && match.team1.name) {
        const initials = this.getTeamInitials(match.team1.name);
        this.placeholderCache[match.team1.name] = ImageLoader.createPlaceholder(initials);
      }
      
      if (match.team2 && match.team2.name) {
        const initials = this.getTeamInitials(match.team2.name);
        this.placeholderCache[match.team2.name] = ImageLoader.createPlaceholder(initials);
      }
    });
    
    // Load all images
    this.imageCache = await ImageLoader.loadImages(logoUrls);
    
    // Pre-create placeholders for any team that might have failed to load its logo
    matches.forEach(match => {
      if (match.team1 && match.team1.logo && !this.imageCache[match.team1.logo] && match.team1.name) {
        console.log(`Creating placeholder for ${match.team1.name} due to failed image load`);
      }
      
      if (match.team2 && match.team2.logo && !this.imageCache[match.team2.logo] && match.team2.name) {
        console.log(`Creating placeholder for ${match.team2.name} due to failed image load`);
      }
    });
  }

  async loadBackgroundImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.error(`Failed to load background image: ${src}`);
        resolve(null);
      };
      img.src = src;
    });
  }
  
  drawBackgroundGradient(ctx, width, height) {
    // Draw background gradient exactly matching test-canva.html
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  drawBackgroundPattern(ctx, image, canvasWidth, canvasHeight) {
    // First draw a gradient background as a base
    this.drawBackgroundGradient(ctx, canvasWidth, canvasHeight);
    
    // Calculate scaling to fit the full width
    const scale = canvasWidth / image.width;
    const scaledHeight = image.height * scale;
    
    // Offset the image vertically to account for pushed-down match rows
    const verticalOffset = -15; // Negative value to move the image up (showing more of the bottom)
    
    // Draw the image at full width, aligned to the top with offset
    // This ensures the image is not cropped horizontally and shows more of the bottom portion
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, verticalOffset, canvasWidth, scaledHeight);
    
    // Add a very subtle dark overlay to ensure text readability without changing colors
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  async drawGraphic(matches, title = 'Watch Party Schedule', backgroundImagePath = '../assets/back_1.png') {
    if (!matches || !Array.isArray(matches)) {
      console.error('Invalid matches array');
      matches = [];
    }
    
    // Sort matches by start time (chronological order) if they have date information
    const sortedMatches = matches.slice().sort((a, b) => {
      // If matches have date property, sort by it
      if (a.date && b.date) {
        return new Date(a.date) - new Date(b.date);
      }
      // If no date, try to parse time strings (fallback)
      if (a.time && b.time) {
        // Convert time strings like "14:30" to comparable values
        const timeA = a.time.split(':').map(Number);
        const timeB = b.time.split(':').map(Number);
        const minutesA = timeA[0] * 60 + (timeA[1] || 0);
        const minutesB = timeB[0] * 60 + (timeB[1] || 0);
        return minutesA - minutesB;
      }
      // If no sorting criteria, maintain original order
      return 0;
    });
    
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    // Set fixed canvas width to 1200px as in test-canva.html
    const canvasWidth = 1200; // Width from test-canva.html
    
    // Add title height to the canvas height
    const titleHeight = 90; // Height for title section including margin
    const rowHeight = 92; // 72px min-height + 20px gap between rows
    const extraPadding = 30; // Extra padding at the bottom to prevent cutting off
    const matchesHeight = sortedMatches.length * rowHeight || 100; // Minimum 100px height for matches
    const canvasHeight = titleHeight + matchesHeight + extraPadding + 15; // Total canvas height (including the 15px we added to push rows down)
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Draw background image or gradient based on selection
    if (backgroundImagePath && backgroundImagePath !== 'none') {
      const backgroundImage = await this.loadBackgroundImage(backgroundImagePath);
      if (backgroundImage) {
        // Draw the background image without stretching (tiling pattern)
        this.drawBackgroundPattern(ctx, backgroundImage, canvasWidth, canvasHeight);
      } else {
        // Fallback to gradient if image fails to load
        this.drawBackgroundGradient(ctx, canvasWidth, canvasHeight);
      }
    } else {
      // Use gradient if no background image is selected
      this.drawBackgroundGradient(ctx, canvasWidth, canvasHeight);
    }
    
    // Draw title anchored to the right side (smaller font and lower position)
    ctx.font = 'bold 42px Inter, Arial'; // Reduced from 48px to 42px
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvasWidth - 24, (titleHeight / 2) + 15); // Moved 15px lower
    
    // Draw match rows with proper spacing, pushed down by title height + 15px
    sortedMatches.forEach((match, index) => {
      const y = titleHeight + 15 + index * rowHeight + rowHeight / 2;
      this.drawMatchRow(match, y);
    });
  }
  
  drawMatchRow(match, y) {
    if (!match) return;
    
    const ctx = this.ctx;
    const width = this.canvas.width;
    
    // Match row container - exactly matching test-canva.html
    const rowHeight = 72; // Same as min-height in CSS
    const rowWidth = width - 48; // 24px padding on each side
    const rowX = 24;
    const rowY = y - rowHeight / 2;
    
    // Draw row background with rounded corners (16px radius as in CSS)
    ctx.fillStyle = 'rgba(58, 58, 58, 0.5)';
    CanvasDrawingUtils.drawRoundedRect(ctx, rowX, rowY, rowWidth, rowHeight, 16);
    ctx.fill();
    
    // Draw match time - 180px width as in CSS
    const timeX = rowX + 38; // Reduced from 48px to 38px (10px to the left)
    ctx.font = 'bold 36px Inter, Arial';
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(match.time || 'TBD', timeX, y);
    
    // Calculate positions for match content
    const matchContentX = timeX + 180; // After time section (180px width)
    const matchContentWidth = rowWidth - 180 - 200; // Minus time width and tournament width
    const centerX = matchContentX + matchContentWidth / 2;
    
    // Draw VS text in the center
    ctx.font = '20px Inter, Arial';
    ctx.fillStyle = '#6B7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('vs', centerX, y);
    
    // Calculate equal spacing from center for both teams
    const vsGap = 80; // Gap between center and the edge of logos
    const logoSize = 49; // Logo size from CSS
    
    // Draw team 1 (left side) - with equal distance from center
    // Position team1 logo so its center is exactly vsGap+logoSize/2 from center
    const team1X = centerX - vsGap - logoSize/2;
    this.drawTeam(match.team1, team1X, y, true); // true = team1 (right-aligned)
    
    // Draw team 2 (right side) - with equal distance from center
    // Position team2 logo so its center is exactly vsGap+logoSize/2 from center
    const team2X = centerX + vsGap + logoSize/2;
    this.drawTeam(match.team2, team2X, y, false); // false = team2 (left-aligned)
    
    // Draw tournament name
    if (match.tournament) {
      ctx.font = '16px Inter, Arial';
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(match.tournament, width - 48, y);
    }
  }
  
  drawTeam(team, x, y, isTeam1) {
    if (!team) return;
    
    const ctx = this.ctx;
    const logoSize = 49; // Exactly 49px as in test-canva.html CSS
    const gapSize = 16; // 16px gap between logo and text as in CSS
    
    // Team name with smaller font size
    ctx.font = 'bold 24px Inter, Arial'; // Reduced from 32px to 24px
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = isTeam1 ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    
    // Truncate text to max width of 300px as specified in CSS
    const teamName = CanvasDrawingUtils.truncateText(
      ctx, 
      team.name || 'TBD', 
      300
    );
    
    // Create a team container layout exactly matching the HTML version with consistent spacing
    const exactGap = 16; // Exact 16px gap between logo and text as in CSS
    
    if (isTeam1) {
      // Team 1 (left side)
      // Logo positioned exactly at the reference point for consistent spacing from center
      this.drawTeamLogo(team.logo, x - logoSize / 2, y - logoSize / 2, logoSize, team.name);
      // Position text with right alignment to the left of the logo with exact gap
      ctx.fillText(teamName, x - logoSize - exactGap, y);
    } else {
      // Team 2 (right side)
      // Logo positioned exactly at the reference point for consistent spacing from center
      this.drawTeamLogo(team.logo, x - logoSize / 2, y - logoSize / 2, logoSize, team.name);
      // Position text with left alignment to the right of the logo with exact gap
      ctx.fillText(teamName, x + logoSize / 2 + exactGap, y);
    }
  }
  
  drawTeamLogo(logoUrl, x, y, size, teamName) {
    const ctx = this.ctx;
    
    try {
      // Check if we have a valid loaded image in the cache
      if (logoUrl && this.imageCache[logoUrl]) {
        const logo = this.imageCache[logoUrl];
        
        // Preserve aspect ratio
        const origWidth = logo.width;
        const origHeight = logo.height;
        
        if (origWidth > 0 && origHeight > 0) {
          // Calculate dimensions to maintain aspect ratio
          let drawWidth, drawHeight;
          
          if (origWidth > origHeight) {
            drawWidth = size;
            drawHeight = (origHeight / origWidth) * size;
          } else {
            drawHeight = size;
            drawWidth = (origWidth / origHeight) * size;
          }
          
          // Center the image perfectly in the allocated space
          const offsetX = (size - drawWidth) / 2;
          const offsetY = (size - drawHeight) / 2;
          
          ctx.drawImage(logo, Math.round(x + offsetX), Math.round(y + offsetY), Math.round(drawWidth), Math.round(drawHeight));
          return;
        }
      }
      
      // If we get here, we need to use a placeholder
      let placeholder;
      
      // Use team-specific placeholder if available
      if (teamName && this.placeholderCache[teamName]) {
        placeholder = this.placeholderCache[teamName];
      } else if (teamName) {
        // Create a team-specific placeholder on the fly
        const initials = this.getTeamInitials(teamName);
        this.placeholderCache[teamName] = ImageLoader.createPlaceholder(initials);
        placeholder = this.placeholderCache[teamName];
      } else {
        // Use default placeholder as last resort
        if (!this.placeholderCache['default']) {
          this.placeholderCache['default'] = ImageLoader.createPlaceholder('TM');
        }
        placeholder = this.placeholderCache['default'];
      }
      
      ctx.drawImage(placeholder, x, y, size, size);
    } catch (error) {
      console.error('Error drawing team logo:', error);
      
      // Use default placeholder as fallback
      try {
        if (!this.placeholderCache['default']) {
          this.placeholderCache['default'] = ImageLoader.createPlaceholder('TM');
        }
        ctx.drawImage(this.placeholderCache['default'], x, y, size, size);
      } catch (e) {
        console.error('Failed to draw default placeholder:', e);
      }
    }
  }
  
  // Get data URL for the canvas
  toDataURL(type = 'image/png', quality = 1) {
    return this.canvas.toDataURL(type, quality);
  }
}

// Export the classes for use in schedule-graphic.js
window.CanvasDrawingUtils = CanvasDrawingUtils;
window.ImageLoader = ImageLoader;
window.CanvasBuildSystem = CanvasBuildSystem;
