const jpeg = require('jpeg-js');

const MATCH_THRESHOLD = 0.86;

function stripDataUri(photoBase64) {
  const trimmed = String(photoBase64 || '').trim();
  const idx = trimmed.indexOf('base64,');
  if (idx >= 0) return trimmed.slice(idx + 7);
  return trimmed;
}

function normalizeVector(vec) {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i += 1) dot += a[i] * b[i];
  return dot;
}

/** Fallback when JPEG decode fails — stable signature from bytes. */
function bufferSampleEmbedding(buf) {
  const out = new Array(128).fill(0);
  if (!buf?.length) return out;
  const step = Math.max(1, Math.floor(buf.length / 512));
  for (let i = 0, k = 0; i < buf.length && k < 512; i += step, k += 1) {
    out[k % 128] += buf[i] / 255;
  }
  return normalizeVector(out);
}

/**
 * Face descriptor from a photo: grid luminance + color histograms.
 * Works best when registration and clock-in faces fill a similar square frame.
 */
function embeddingFromPhoto(photoBase64) {
  const raw = stripDataUri(photoBase64);
  if (!raw) return [];
  const buf = Buffer.from(raw, 'base64');

  try {
    const { data, width, height } = jpeg.decode(buf, {
      useTArray: true,
      maxMemoryUsageInMB: 64,
    });
    return gridEmbedding(data, width, height);
  } catch {
    return bufferSampleEmbedding(buf);
  }
}

function gridEmbedding(rgba, width, height) {
  const grid = 8;
  const histBins = 16;
  const features = [];

  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      const x0 = Math.floor((gx * width) / grid);
      const x1 = Math.floor(((gx + 1) * width) / grid);
      const y0 = Math.floor((gy * height) / grid);
      const y1 = Math.floor(((gy + 1) * height) / grid);
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * width + x) * 4;
          r += rgba[i];
          g += rgba[i + 1];
          b += rgba[i + 2];
          count += 1;
        }
      }
      const c = count || 1;
      features.push(r / c / 255, g / c / 255, b / c / 255);
    }
  }

  const hist = new Array(histBins).fill(0);
  const step = Math.max(1, Math.floor((width * height) / 2000));
  for (let p = 0; p < width * height; p += step) {
    const i = p * 4;
    const y = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    const bin = Math.min(histBins - 1, Math.floor((y / 255) * histBins));
    hist[bin] += 1;
  }
  const histSum = hist.reduce((a, b) => a + b, 0) || 1;
  for (const h of hist) features.push(h / histSum);

  return normalizeVector(features);
}

/**
 * Find best matching registered member for a live face photo.
 * @returns {{ user, score, confidence } | null}
 */
function findBestFaceMatch(probeEmbedding, candidates) {
  if (!probeEmbedding?.length || !candidates?.length) return null;

  let best = null;
  let bestScore = -1;

  for (const c of candidates) {
    const emb = c.embedding;
    if (!emb?.length) continue;
    const score = cosineSimilarity(probeEmbedding, emb);
    if (score > bestScore) {
      bestScore = score;
      best = c.user;
    }
  }

  if (!best || bestScore < MATCH_THRESHOLD) {
    return null;
  }

  return {
    user: best,
    score: bestScore,
    confidence: Math.round(bestScore * 1000) / 10,
  };
}

module.exports = {
  MATCH_THRESHOLD,
  embeddingFromPhoto,
  cosineSimilarity,
  findBestFaceMatch,
};
