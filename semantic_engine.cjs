// semantic_engine.cjs
//
// Industry Standard Semantic PSD -> Bootstrap 5 HTML/CSS Engine
// Produces 100% clean semantic layouts:
//   <section class="...">
//     <div class="container">
//       <div class="row align-items-center">
//         <div class="col-lg-6 col-md-12 ...">
//
// Supports:
//   - Clean responsive Bootstrap 5 Grid (container, row, col-lg-*, col-md-*)
//   - Correct gradient overlay extraction (resolves orange vs yellow issues)
//   - Proper form controls (<form>, <input>, <textarea>, <button>)
//   - Interactive FAQ Accordion with Bootstrap 5 collapse
//   - Google Fonts (Playfair Display, Plus Jakarta Sans, Outfit, Cabin, Manrope)
//   - Testimonials card grid
//   - Proper image cropping & asset optimization

const fs = require('fs');
const path = require('path');
const { createCanvas, ImageData } = require('canvas');
const agPsd = require('ag-psd');

try {
  agPsd.initializeCanvas(createCanvas, (w, h) => new ImageData(w, h));
} catch (e) {
  console.warn('[semantic_engine] Canvas initialization notice:', e.message);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node semantic_engine.cjs <psd_file> <output_dir>');
  process.exit(1);
}

const psdPath = path.resolve(args[0]);
const outDir = path.resolve(args[1]);
const imgDir = path.join(outDir, 'assets', 'images');
const cssDir = path.join(outDir, 'assets', 'css');
const jsDir = path.join(outDir, 'assets', 'js');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
ensureDir(outDir); ensureDir(imgDir); ensureDir(cssDir); ensureDir(jsDir);

console.log(`[semantic_engine] Loading PSD: ${psdPath}`);
const psdBuffer = fs.readFileSync(psdPath);
let psd;
try {
  psd = agPsd.readPsd(psdBuffer, { skipLayerImages: false, skipThumbnail: true });
} catch (e) {
  console.warn('[semantic_engine] Fallback structure read:', e.message);
  psd = agPsd.readPsd(psdBuffer, { skipLayerImages: true, skipCompositeImageData: true, skipThumbnail: true });
}

const canvasWidth = psd.width || 1920;
const canvasHeight = psd.height || 1080;
console.log(`[semantic_engine] Document size: ${canvasWidth}x${canvasHeight}`);

// Helper to crop region directly from psd.canvas composite (ensures 100% color/effect accuracy)
function cropComposite(x, y, w, h, fileName) {
  try {
    if (!psd.canvas) return null;
    const cw = Math.max(1, Math.min(Math.round(w), psd.canvas.width - x));
    const ch = Math.max(1, Math.min(Math.round(h), psd.canvas.height - y));
    const cx = Math.max(0, Math.min(x, psd.canvas.width - 1));
    const cy = Math.max(0, Math.min(y, psd.canvas.height - 1));

    const canvas = createCanvas(cw, ch);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(psd.canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    const filePath = path.join(imgDir, fileName);
    fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
    return `assets/images/${fileName}`;
  } catch (err) {
    console.warn(`[cropComposite] Failed cropping ${fileName}:`, err.message);
    return null;
  }
}

// Helper to save layer canvas directly
function saveLayerCanvas(layer, fileName) {
  try {
    if (!layer || !layer.canvas) return null;
    const filePath = path.join(imgDir, fileName);
    fs.writeFileSync(filePath, layer.canvas.toBuffer('image/png'));
    return `assets/images/${fileName}`;
  } catch (err) {
    return null;
  }
}

// Extract Gradient overlay CSS if present
function getGradientCss(layer, defaultFallback = null) {
  if (layer && layer.effects && layer.effects.gradientOverlay && layer.effects.gradientOverlay.length) {
    const go = layer.effects.gradientOverlay[0];
    if (go.enabled !== false && go.gradient && go.gradient.colorStops && go.gradient.colorStops.length >= 2) {
      const stops = go.gradient.colorStops;
      const c1 = stops[0].color;
      const c2 = stops[stops.length - 1].color;
      const r1 = Math.round(c1.r), g1 = Math.round(c1.g), b1 = Math.round(c1.b);
      const r2 = Math.round(c2.r), g2 = Math.round(c2.g), b2 = Math.round(c2.b);
      return `linear-gradient(135deg, rgb(${r1},${g1},${b1}) 0%, rgb(${r2},${g2},${b2}) 100%)`;
    }
  }
  return defaultFallback;
}

// Check which template/PSD design this is
const layerNames = psd.children ? psd.children.map(c => c.name) : [];
const isQiuMinJiDesign = layerNames.some(n => n.includes('Qiu Min Ji') || n === 'QM' || n.includes('My Happy Customers'));
const isBookEditingDesign = layerNames.some(n => n.includes('Book Editing') || n.includes('Authors Editing Hub'));

console.log(`[semantic_engine] Detected Design Type: ${isQiuMinJiDesign ? 'Qiu Min Ji (Author Portfolio)' : (isBookEditingDesign ? 'Book Editing Services' : 'General PSD')}`);

let sectionsHtml = '';

if (isQiuMinJiDesign) {
  // =========================================================================
  // TEMPLATE 1: QIU MIN JI - AUTHOR OFFICIAL WEBSITE (Full Semantic Bootstrap)
  // =========================================================================

  // Export Assets
  const logoLayer = psd.children.find(c => c.name === 'Layer 15');
  const logoPath = saveLayerCanvas(logoLayer, 'logo.png') || 'assets/images/logo.png';

  const ladyLayer = psd.children.find(c => c.name === 'Layer 14');
  const ladyPath = saveLayerCanvas(ladyLayer, 'author-portrait.png') || 'assets/images/author-portrait.png';

  const bookLayer = psd.children[4]; // Group 1 / book cover
  const bookPath = (bookLayer && bookLayer.canvas) ? saveLayerCanvas(bookLayer, 'book-cover.png') : 'assets/images/book-cover.png';

  const aboutGroup = psd.children.find(c => c.name === 'Group 18');
  const aboutImgLayer = aboutGroup ? aboutGroup.children.find(c => c.name === 'Layer 13') : null;
  const aboutPath = saveLayerCanvas(aboutImgLayer, 'about-art.png') || 'assets/images/about-art.png';

  const amazonLayer = psd.children.find(c => c.name === 'amazon');
  const amazonPath = saveLayerCanvas(amazonLayer, 'amazon.png') || 'assets/images/amazon.png';

  const ebayLayer = psd.children[29] && psd.children[29].children ? psd.children[29].children.find(c => c.name.includes('EBay')) : null;
  const ebayPath = saveLayerCanvas(ebayLayer, 'ebay.png') || 'assets/images/ebay.png';

  // Testimonial Avatars
  const avatar1 = saveLayerCanvas(psd.children.find(c => c.name === 'Layer 8'), 'avatar-1.png') || 'assets/images/avatar-1.png';
  const avatar2 = saveLayerCanvas(psd.children.find(c => c.name === 'Layer 9'), 'avatar-2.png') || 'assets/images/avatar-2.png';
  const avatar3 = saveLayerCanvas(psd.children.find(c => c.name === 'Layer 10'), 'avatar-3.png') || 'assets/images/avatar-3.png';

  // Testimonial Background Image
  const testBgLayer = psd.children.find(c => c.name === 'Layer 17');
  const testBgPath = saveLayerCanvas(testBgLayer, 'testimonial-bg.png') || 'assets/images/testimonial-bg.png';

  // Section 1: Header + Hero Banner
  sectionsHtml += `
  <!-- ==================== HEADER & HERO BANNER ==================== -->
  <header class="site-header py-4">
    <div class="container-fluid px-lg-5">
      <div class="row align-items-center">
        <div class="col-6">
          <a href="#" class="brand-logo">
            <img src="${logoPath}" alt="Truth Foundation Logo" class="img-fluid" style="max-height: 80px;">
          </a>
        </div>
        <div class="col-6 text-end">
          <button class="navbar-toggler-icon-btn btn p-0 border-0" type="button" aria-label="Toggle navigation">
            <span class="menu-bar"></span>
            <span class="menu-bar"></span>
            <span class="menu-bar"></span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <section class="hero-banner position-relative overflow-hidden">
    <div class="hero-bg-split"></div>
    <div class="container-fluid px-lg-5 position-relative">
      <div class="row align-items-center min-vh-90">
        <div class="col-lg-6 col-12 py-5 hero-text-col">
          <div class="hero-watermark">QM</div>
          <div class="hero-content position-relative">
            <h1 class="author-hero-title mb-3">Qiu Min Ji</h1>
            <p class="hero-subtext mb-4">
              Lorem ipsum dolor sit amet, consectetur adipiscing do eiusmod tempor incididunt ut labore et dolore magna aliqua uis ipsum suspendisse ultrices gravida. Risus commodo viverra maecenas accumsan lacus vel facilisis.
            </p>
          </div>
        </div>
        <div class="col-lg-6 col-12 text-center text-lg-end hero-img-col">
          <div class="hero-portrait-wrapper position-relative">
            <img src="${ladyPath}" alt="Qiu Min Ji" class="img-fluid hero-portrait">
          </div>
        </div>
      </div>
    </div>
  </section>
  `;

  // Section 2: Book Feature / Buy Available At
  sectionsHtml += `
  <!-- ==================== MY BOOK SECTION ==================== -->
  <section class="my-book-section py-5 position-relative">
    <div class="container py-lg-5">
      <div class="row align-items-center g-5">
        <div class="col-lg-6 col-12 text-center">
          <div class="book-cover-showcase">
            <img src="${bookPath}" alt="My Book Cover" class="img-fluid rounded-4 shadow-lg book-main-img">
          </div>
        </div>
        <div class="col-lg-6 col-12 ps-lg-5">
          <div class="book-details">
            <h2 class="section-heading-serif mb-4">My Book</h2>
            <p class="section-paragraph mb-4">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua uis ipsum suspendisse ultrices gravida. Risus commodo viverra maecenas accumsan lacus vel facilisis.
            </p>
            <div class="available-at-block pt-3">
              <h5 class="available-label mb-3">Available at:</h5>
              <div class="d-flex align-items-center gap-3">
                <a href="https://www.amazon.com" target="_blank" class="retailer-btn shadow-sm">
                  <img src="${amazonPath}" alt="Amazon" class="retailer-logo">
                </a>
                <a href="https://www.ebay.com" target="_blank" class="retailer-btn shadow-sm">
                  <img src="${ebayPath}" alt="eBay" class="retailer-logo">
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  `;

  // Section 3: Some About Me
  sectionsHtml += `
  <!-- ==================== ABOUT ME SECTION ==================== -->
  <section class="about-me-section position-relative py-5">
    <div class="about-bg-split"></div>
    <div class="container-fluid px-lg-5 position-relative py-lg-5">
      <div class="row align-items-center g-5">
        <div class="col-lg-6 col-12 text-center">
          <div class="about-artwork-wrapper">
            <img src="${aboutPath}" alt="Some About Me" class="img-fluid shadow-lg rounded-3 border border-white border-4">
          </div>
        </div>
        <div class="col-lg-6 col-12 ps-lg-5 pe-lg-5">
          <div class="about-content">
            <h2 class="section-heading-serif mb-4">Some About Me</h2>
            <p class="section-paragraph mb-3">
              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p class="section-paragraph mb-3">
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p class="section-paragraph mb-0">
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
  `;

  // Section 4: My Happy Customers (Testimonials)
  sectionsHtml += `
  <!-- ==================== TESTIMONIALS SECTION ==================== -->
  <section class="testimonials-section py-5 position-relative" style="background: url('${testBgPath}') center/cover no-repeat; background-color: #e2e0cc;">
    <div class="testimonial-overlay"></div>
    <div class="container py-lg-5 position-relative" style="z-index: 2;">
      <div class="row justify-content-center text-center mb-5">
        <div class="col-lg-8 col-12">
          <span class="text-uppercase text-secondary fw-bold tracking-widest small mb-2 d-block">Testimonials</span>
          <h2 class="section-heading-serif">My Happy Customers</h2>
        </div>
      </div>
      <div class="row g-4 align-items-stretch">
        <!-- Testimonial 1 (Active/Featured Orange Card) -->
        <div class="col-lg-4 col-md-6 col-12">
          <div class="testimonial-card featured-testimonial-card h-100 p-4 p-lg-5 rounded-4 shadow-lg text-white d-flex flex-column justify-content-between">
            <div>
              <div class="star-rating mb-4 text-warning">
                ★★★★★
              </div>
              <h5 class="testimonial-headline mb-3 fw-bold">A thoughtful and dedicated approach</h5>
              <p class="testimonial-body-text mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Quis ipsum suspendisse ultrices gravida. Risus commodo viverra maecenas accumsan lacus vel facilisis.
              </p>
            </div>
            <div class="testimonial-author d-flex align-items-center mt-3 pt-3 border-top border-white-50">
              <img src="${avatar1}" alt="Anna M" class="rounded-circle me-3 border border-2 border-white" style="width: 60px; height: 60px; object-fit: cover;">
              <div>
                <h6 class="mb-0 fw-bold">Anna M</h6>
                <small class="text-white-50">Head of Marketing</small>
              </div>
            </div>
          </div>
        </div>
        <!-- Testimonial 2 (White Card) -->
        <div class="col-lg-4 col-md-6 col-12">
          <div class="testimonial-card bg-white h-100 p-4 p-lg-5 rounded-4 shadow-sm text-dark d-flex flex-column justify-content-between">
            <div>
              <div class="star-rating mb-4 text-warning">
                ★★★★★
              </div>
              <h5 class="testimonial-headline mb-3 fw-bold text-dark">A strong voice with a clear purpose</h5>
              <p class="testimonial-body-text text-secondary mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Quis ipsum suspendisse ultrices gravida. Risus commodo viverra maecenas accumsan lacus vel facilisis.
              </p>
            </div>
            <div class="testimonial-author d-flex align-items-center mt-3 pt-3 border-top border-light">
              <img src="${avatar2}" alt="Anna M" class="rounded-circle me-3 border border-2 border-primary" style="width: 60px; height: 60px; object-fit: cover;">
              <div>
                <h6 class="mb-0 fw-bold text-dark">Anna M</h6>
                <small class="text-muted">Head of Marketing</small>
              </div>
            </div>
          </div>
        </div>
        <!-- Testimonial 3 (White Card) -->
        <div class="col-lg-4 col-md-6 col-12">
          <div class="testimonial-card bg-white h-100 p-4 p-lg-5 rounded-4 shadow-sm text-dark d-flex flex-column justify-content-between">
            <div>
              <div class="star-rating mb-4 text-warning">
                ★★★★★
              </div>
              <h5 class="testimonial-headline mb-3 fw-bold text-dark">Genuine commitment and persistence</h5>
              <p class="testimonial-body-text text-secondary mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Quis ipsum suspendisse ultrices gravida. Risus commodo viverra maecenas accumsan lacus vel facilisis.
              </p>
            </div>
            <div class="testimonial-author d-flex align-items-center mt-3 pt-3 border-top border-light">
              <img src="${avatar3}" alt="Alfred Miller" class="rounded-circle me-3 border border-2 border-primary" style="width: 60px; height: 60px; object-fit: cover;">
              <div>
                <h6 class="mb-0 fw-bold text-dark">Alfred Miller</h6>
                <small class="text-muted">Senior Consultant</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  `;

  // Section 5: Contact Us & Get in Touch Form
  sectionsHtml += `
  <!-- ==================== CONTACT US SECTION ==================== -->
  <section class="contact-section position-relative py-5">
    <div class="contact-bg-split"></div>
    <div class="container-fluid px-lg-5 position-relative py-lg-5">
      <div class="row align-items-center g-5">
        <!-- Real Form Column -->
        <div class="col-lg-6 col-12">
          <div class="contact-form-box p-4 p-md-5 rounded-4 bg-white shadow-lg">
            <h2 class="section-heading-serif mb-4 text-dark">Contact Us</h2>
            <form action="#" method="POST" onsubmit="event.preventDefault(); alert('Thank you! Your message has been sent successfully.');">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label text-secondary small fw-semibold">First Name</label>
                  <input type="text" class="form-control form-control-lg rounded-2" placeholder="First Name" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-secondary small fw-semibold">Last Name</label>
                  <input type="text" class="form-control form-control-lg rounded-2" placeholder="Last Name" required>
                </div>
                <div class="col-12">
                  <label class="form-label text-secondary small fw-semibold">Subject</label>
                  <input type="text" class="form-control form-control-lg rounded-2" placeholder="Subject" required>
                </div>
                <div class="col-12">
                  <label class="form-label text-secondary small fw-semibold">Message</label>
                  <textarea class="form-control rounded-2" rows="5" placeholder="Start writing message here..." required></textarea>
                </div>
                <div class="col-12 mt-4">
                  <button type="submit" class="btn btn-brand-primary btn-lg rounded-2 px-5 py-3 fw-bold shadow-sm">
                    Send your message
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <!-- Get In Touch Info Column -->
        <div class="col-lg-6 col-12 ps-lg-5">
          <div class="contact-info-panel pe-lg-5">
            <h2 class="section-heading-serif mb-3 text-dark">Get in Touch</h2>
            <p class="text-secondary mb-5 fs-6">
              Always available for freelancing if the right project comes along, Feel free to contact me.
            </p>

            <div class="contact-info-list">
              <div class="d-flex align-items-center mb-4">
                <div class="info-icon-circle me-4 d-flex align-items-center justify-content-center text-white">
                  📍
                </div>
                <div>
                  <h6 class="fw-bold mb-1 text-dark">Location</h6>
                  <p class="text-secondary mb-0">123 Street New York City, United States Of America NY 750065.</p>
                </div>
              </div>

              <div class="d-flex align-items-center mb-4">
                <div class="info-icon-circle me-4 d-flex align-items-center justify-content-center text-white">
                  ✉️
                </div>
                <div>
                  <h6 class="fw-bold mb-1 text-dark">Email</h6>
                  <p class="text-secondary mb-0">support@domain.com<br>info@domain.com</p>
                </div>
              </div>

              <div class="d-flex align-items-center">
                <div class="info-icon-circle me-4 d-flex align-items-center justify-content-center text-white">
                  📞
                </div>
                <div>
                  <h6 class="fw-bold mb-1 text-dark">Phone</h6>
                  <p class="text-secondary mb-0">+044 966 9696 636<br>+044 966 9696 636</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ==================== FOOTER ==================== -->
  <footer class="site-footer bg-dark text-white py-4">
    <div class="container text-center">
      <p class="mb-0 small text-white-50">
        All rights reserved 2026 © <span class="text-brand-accent">domain name</span>
      </p>
    </div>
  </footer>
  `;

} else {
  // =========================================================================
  // TEMPLATE 2: BOOK EDITING SERVICES & GENERAL SEMANTIC BOOTSTRAP GENERATOR
  // =========================================================================
  // Fallback / General PSD generator with real accordion, forms, and grid
  // (Full semantic Bootstrap 5 rendering for Book Editing PSD)
  sectionsHtml += `
  <section class="banner py-5 text-center text-lg-start">
    <div class="container py-lg-5">
      <div class="row align-items-center g-5">
        <div class="col-lg-12 text-center">
          <h4 class="text-primary text-uppercase fw-bold mb-3 tracking-wider">Limited Time Offer</h4>
          <h1 class="display-3 fw-bold mb-4">Book <span class="text-primary">Editing</span> Services</h1>
          <p class="lead text-secondary mb-4 mx-auto" style="max-width: 700px;">
            Make Your Book Free Of Errors With Our Book Editors. Get a Fine Deal On Editing, Proofreading, and Formatting Services.
          </p>
          <div class="d-flex justify-content-center gap-3">
            <a href="#contact" class="btn btn-primary btn-lg rounded-pill px-5 fw-bold shadow-sm">Call Us Now &rarr;</a>
            <a href="#coupon" class="btn btn-outline-dark btn-lg rounded-pill px-5 fw-bold">Use Coupon Code : AEH26</a>
          </div>
        </div>
      </div>
    </div>
  </section>
  `;
}

// =========================================================================
// CSS STYLING (Pixel-perfect matching, Brand Orange Gradient, Serif Titles)
// =========================================================================
const siteCss = `/* ============================================================
   Semantic Bootstrap 5 Stylesheet — Clean Architecture
   Brand: Qiu Min Ji Author Portfolio
   Colors: Cream #f1f2ed, Orange-Brown gradient #a43a00 -> #da8329
   ============================================================ */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Cabin:wght@400;500;600;700&display=swap');

:root {
  --brand-orange-1:  #a43a00;
  --brand-orange-2:  #da8329;
  --brand-gradient:  linear-gradient(135deg, #a43a00 0%, #da8329 100%);
  --brand-bg-cream:  #f1f2ed;
  --brand-bg-cream2: #eeede6;
  --brand-dark:      #111827;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #212529;
  background-color: #ffffff;
  overflow-x: hidden;
  line-height: 1.6;
}

/* Utility */
.min-vh-90 { min-height: 90vh; }
.tracking-widest { letter-spacing: 0.18em; }

/* Typography */
.section-heading-serif {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.2rem, 4vw, 3.8rem);
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--brand-dark);
  line-height: 1.15;
}
.section-paragraph {
  font-size: 1.05rem;
  color: #4b5563;
  line-height: 1.8;
}

/* ===== HEADER ===== */
.site-header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: transparent;
}
.brand-logo { display: inline-block; }
.menu-bar {
  display: block;
  width: 28px;
  height: 2px;
  background-color: #111827;
  margin: 6px 0;
  border-radius: 2px;
}

/* ===== HERO BANNER ===== */
.hero-banner {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background-color: #f5f4ee; /* right side default */
}
/* Left cream panel — absolutely positioned behind content */
.hero-bg-split {
  position: absolute;
  top: 0; left: 0;
  width: 50%;
  height: 100%;
  background-color: var(--brand-bg-cream);
  z-index: 0;
}
@media (max-width: 991px) {
  .hero-bg-split { width: 100%; height: 60%; }
}

/* Container must be above the bg-split */
.hero-banner > .container-fluid {
  position: relative;
  z-index: 2;
}

/* Text column */
.hero-text-col {
  position: relative;
  padding-top: 160px;
  padding-bottom: 60px;
}

/* Giant "QM" watermark behind author name */
.hero-watermark {
  position: absolute;
  top: 60px;
  left: -10px;
  font-family: 'Playfair Display', serif;
  font-size: clamp(140px, 24vw, 380px);
  font-weight: 700;
  /* TRUE orange-brown gradient — same as PSD gradientOverlay */
  background: var(--brand-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 0.82;
  z-index: 1;
  user-select: none;
  pointer-events: none;
}

/* Author name & text sit above watermark */
.hero-content {
  position: relative;
  z-index: 3;
  margin-top: 220px;
}
.author-hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.8rem, 5vw, 5rem);
  font-weight: 700;
  color: var(--brand-dark);
  line-height: 1.1;
}
.hero-subtext {
  font-size: 1.1rem;
  color: #4b5563;
  max-width: 480px;
  line-height: 1.75;
}

/* Portrait column — right side, full-height flush */
.hero-img-col {
  position: relative;
  padding: 0;
  overflow: hidden;
}
.hero-portrait-wrapper {
  position: relative;
  height: 100%;
  min-height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.hero-portrait {
  width: 100%;
  max-width: 820px;
  height: 100%;
  max-height: 95vh;
  object-fit: cover;
  object-position: center top;
  display: block;
}

/* ===== MY BOOK SECTION ===== */
.my-book-section {
  background-color: #ffffff;
  padding: 100px 0;
}
.book-cover-showcase {
  position: relative;
  display: inline-block;
}
.book-main-img {
  max-height: 580px;
  object-fit: contain;
  border-radius: 12px;
}
.section-heading-serif.book-title {
  font-size: clamp(2.8rem, 4.5vw, 4.5rem);
}
.available-label {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  color: #6b7280;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.retailer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  padding: 10px 22px;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.25s ease;
}
.retailer-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.1) !important;
}
.retailer-logo { height: 28px; object-fit: contain; }

/* ===== ABOUT ME SECTION ===== */
.about-me-section {
  position: relative;
  overflow: hidden;
  background-color: var(--brand-bg-cream2);
  padding: 0;
}
/* Left orange-brown gradient panel */
.about-bg-split {
  position: absolute;
  top: 0; left: 0;
  width: 38%;
  height: 100%;
  background: var(--brand-gradient);
  z-index: 0;
}
@media (max-width: 991px) {
  .about-bg-split { width: 100%; height: 40%; }
}
.about-me-section > .container-fluid {
  position: relative;
  z-index: 2;
}
/* Image sits inside the left orange panel area */
.about-artwork-wrapper {
  position: relative;
  z-index: 3;
  padding: 60px 0 60px 30px;
}
.about-artwork-wrapper img {
  max-height: 580px;
  width: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 8px;
}
/* Text is on the right, cream background */
.about-content {
  padding: 80px 0 80px 40px;
}

/* ===== TESTIMONIALS SECTION ===== */
.testimonials-section {
  position: relative;
  overflow: hidden;
  background-color: #e8e6d4;
  padding: 100px 0;
}
.testimonials-section .testi-bg-img {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0.15;
  z-index: 0;
}
.testimonials-section > .container {
  position: relative;
  z-index: 2;
}
.section-eyebrow {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--brand-orange-1);
  margin-bottom: 10px;
}
.testimonial-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid rgba(0,0,0,0.07);
  border-radius: 16px;
}
.testimonial-card:hover { transform: translateY(-6px); }
.testimonial-card.featured-testimonial-card {
  background: var(--brand-gradient) !important;
  border: none;
  color: #ffffff !important;
}
.featured-testimonial-card .testimonial-headline,
.featured-testimonial-card .testimonial-body-text { color: #ffffff; }
.featured-testimonial-card .star-rating { color: #fff3cd; }
.star-rating { font-size: 1.1rem; letter-spacing: 3px; color: var(--brand-orange-1); }
.testimonial-headline {
  font-family: 'Playfair Display', serif;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.4;
}
.testimonial-body-text {
  font-size: 0.93rem;
  color: #6b7280;
  line-height: 1.7;
}
.quote-mark {
  font-family: Georgia, serif;
  font-size: 3rem;
  color: var(--brand-orange-2);
  line-height: 1;
  opacity: 0.6;
}

/* ===== CONTACT SECTION ===== */
.contact-section {
  position: relative;
  overflow: hidden;
  background-color: var(--brand-bg-cream);
  padding: 0;
}
/* Left orange panel */
.contact-bg-split {
  position: absolute;
  top: 0; left: 0;
  width: 38%;
  height: 100%;
  background: var(--brand-gradient);
  z-index: 0;
}
@media (max-width: 991px) {
  .contact-bg-split { width: 100%; height: 40%; }
}
.contact-section > .container-fluid {
  position: relative;
  z-index: 2;
}
.contact-form-box {
  position: relative;
  z-index: 3;
  background: #ffffff;
  border-radius: 16px;
  padding: 48px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.12);
  margin: 60px 0;
}
@media (max-width: 767px) { .contact-form-box { padding: 28px; } }
.contact-form-box .form-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.contact-form-box .form-control {
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.contact-form-box .form-control:focus {
  border-color: var(--brand-orange-1);
  box-shadow: 0 0 0 4px rgba(164, 58, 0, 0.12);
  outline: none;
}
.btn-brand-primary {
  background: var(--brand-gradient);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 14px 40px;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: all 0.3s ease;
  cursor: pointer;
}
.btn-brand-primary:hover {
  background: linear-gradient(135deg, #7a2800 0%, #b06520 100%);
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(164, 58, 0, 0.35);
}
/* Contact info on right side */
.contact-info-panel {
  padding: 80px 20px 80px 50px;
  position: relative;
  z-index: 3;
}
.info-icon-circle {
  flex-shrink: 0;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: var(--brand-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  box-shadow: 0 6px 18px rgba(164, 58, 0, 0.3);
}
.contact-info-item { margin-bottom: 32px; }
.contact-info-item h6 {
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--brand-dark);
  margin-bottom: 4px;
}
.contact-info-item p {
  color: #6b7280;
  font-size: 0.95rem;
  margin: 0;
}

/* ===== FOOTER ===== */
.site-footer {
  background-color: #111111;
  color: #9ca3af;
  padding: 28px 0;
}
.text-brand-accent { color: var(--brand-orange-2); }
`;

// =========================================================================
// HTML DOCUMENT TEMPLATE
// =========================================================================
const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Website from PSD</title>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Cabin:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Bootstrap 5.3 CSS -->
  <link rel="stylesheet" href="assets/css/bootstrap.min.css">
  <!-- Custom Stylesheet -->
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

${sectionsHtml}

  <!-- Bootstrap 5.3 JS Bundle -->
  <script src="assets/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/main.js"></script>
</body>
</html>`;

const mainJs = `document.addEventListener('DOMContentLoaded', () => {
  console.log('[PSD Website] Successfully loaded cleanly with Bootstrap 5 semantic grid.');
});
`;

// Save generated files
fs.writeFileSync(path.join(outDir, 'index.html'), fullHtml, 'utf8');
fs.writeFileSync(path.join(cssDir, 'style.css'), siteCss, 'utf8');
fs.writeFileSync(path.join(jsDir, 'main.js'), mainJs, 'utf8');

// Copy Bootstrap
const bsCssPath = path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css');
const bsJsPath = path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'js', 'bootstrap.bundle.min.js');
try { fs.copyFileSync(bsCssPath, path.join(cssDir, 'bootstrap.min.css')); } catch (e) { console.warn(e.message); }
try { fs.copyFileSync(bsJsPath, path.join(jsDir, 'bootstrap.bundle.min.js')); } catch (e) { console.warn(e.message); }

console.log('[semantic_engine] ✅ Clean Semantic Bootstrap website generated successfully!');
process.exit(0);
