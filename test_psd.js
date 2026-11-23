import { createCanvas } from 'canvas';
import fs from 'fs';

// Create a simple test PSD-like structure
const canvas = createCanvas(800, 600);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#f0f0f0';
ctx.fillRect(0, 0, 800, 600);

// Header
ctx.fillStyle = '#2563eb';
ctx.fillRect(0, 0, 800, 100);

// Text
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 48px Arial';
ctx.textAlign = 'center';
ctx.fillText('Welcome to PSD2HTML', 400, 70);

// Subtitle
ctx.fillStyle = '#333333';
ctx.font = '24px Arial';
ctx.fillText('Upload your PSD and get clean HTML/CSS', 400, 300);

// Button
ctx.fillStyle = '#2563eb';
ctx.fillRect(300, 400, 200, 50);
ctx.fillStyle = '#ffffff';
ctx.font = '18px Arial';
ctx.fillText('Download ZIP', 400, 432);

// Save as PNG (simulating PSD)
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('sample_test.png', buffer);
console.log('Test image created as sample_test.png');