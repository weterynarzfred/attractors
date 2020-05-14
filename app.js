import fs from 'fs';
import pngjs from 'pngjs';

const PNG = pngjs.PNG;

function addPoint(y, x, hue) {
  const _x = Math.floor(x * zoom + width * 0.5);
  const _y = Math.floor(y * zoom + height * 0.5);
  if (_x >= 0 && _x < width && _y >= 0 && _y < height) {
    map[_y][_x] += hue;
  }
}

function sineInterp(x, min, max, spread = 0, offset = Math.PI / 2) {
  const a1 = Math.sin(x * Math.PI - offset);
  return (a1 * (max - min) + max - spread + min) / 2;
}

function drawMap(frameNumber) {
  const streams = [];
  colors.forEach(() => streams.push([]));
  let sum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sum += 1 - Math.exp(-sensitivity * map[y][x]);
    }
  }
  const frameSensitivity = sensitivity / sum * width * height / 10;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = 1 - Math.exp(-frameSensitivity * map[y][x]);
      for (let i = 0; i < streams.length; i++) {
        streams[i].push(
          v * (v * (colors[i][2][0] - colors[i][1][0]) + colors[i][1][0] - colors[i][0][0]) + colors[i][0][0],
          v * (v * (colors[i][2][1] - colors[i][1][1]) + colors[i][1][1] - colors[i][0][1]) + colors[i][0][1],
          v * (v * (colors[i][2][2] - colors[i][1][2]) + colors[i][1][2] - colors[i][0][2]) + colors[i][0][2],
          v * (v * (colors[i][2][3] - colors[i][1][3]) + colors[i][1][3] - colors[i][0][3]) + colors[i][0][3],
        );
      }
    }
  }

  for (let i = 0; i < streams.length; i++) {
    const clampedArray = new Uint8ClampedArray(streams[i]);
    const img_png = new PNG({
      width,
      height,
      inputColorType: 6,
      colorType: 6,
      inputHasAlpha: true,
    });
    img_png.data = Buffer.from(clampedArray);
    var buffer = PNG.sync.write(img_png);
    fs.writeFileSync(`out/${i}-frame-${frameNumber}.png`, buffer);
  }
}

function prepare() {
  map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    map.push(row);
  }
  sensitivity = 100 * zoom * zoom / 16 / spreadResolution / iterations;
  if (framesN === 1) {
    for (let j = 0; j < 4; j++) {
      param[j] = (paramMM[j][0] + paramMM[j][1] - spread) / 2;
    }
  }
}

export default function calculate() {
  prepare();
  let lastPercent = -1;

  for (let i = startFrame; i < framesN; i++) {
    let x = 1;
    if (framesN > 1) {
      x = i / framesN;
      for (let j = 0; j < 4; j++) {
        let x2 = sineInterp(2 * x, 0.5, j / 3);
        x2 = x2 ** 2 + x2 / 2 + 0.5;
        x2 = x2 >= 1 ? (j + 1) * 2 * x ** x2 : -(j + 1) * 2 * (1 - x) ** x2
        param[j] = sineInterp(
          x2,
          paramMM[j][0],
          paramMM[j][1],
          spread,
          j * Math.PI / 2
        );
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x] = 0;
      }
    }

    for (let i = 0; i < spreadResolution; i++) {
      const p = spreadResolution === 1 ? 0.5 : i / (spreadResolution - 1);
      const param_2 = [];
      for (let j = 0; j < 4; j++) {
        param_2[j] = sineInterp(p, param[j], param[j] + spread);
      }

      let x = 0;
      let y = 0;
      for (let j = 0; j < iterations; j++) {
        const temp = Math.sin(param_2[0] * y) + param_2[2] * Math.cos(param_2[0] * x);
        y = Math.sin(param_2[1] * x) + param_2[3] * Math.cos(param_2[1] * y);
        x = temp;
        addPoint(y, x, 1);
      }
    }

    drawMap(i);

    const newPercent = Math.floor((i + 1) / framesN * 100)
    if (newPercent - lastPercent >= 1) {
      console.log(`${newPercent}%`);
      lastPercent = newPercent;
    }
  }
}

const resolutionScale = 8;
let width = 500 * resolutionScale;
let height = 400 * resolutionScale;
let zoom = 90 * resolutionScale;
let spreadResolution = 10;
let iterations = 1e5;
let startFrame = 0;
let framesN = 1;
let spread = 0.0005;
let paramMM = [
  [1.40, 1.51],
  [-1.78, -1.69],
  [1.60, 1.70],
  [0.90, 0.92],
];
const colors = [
  // [
  //   [212, 212, 212, 255],
  //   [0, 0, 0, 255],
  //   [0, 0, 0, 255],
  // ],
  // [
  //   [255, 255, 255, 255],
  //   [0, 0, 0, 255],
  //   [0, 0, 0, 255],
  // ],
  // [
  //   [32, 56, 102, 255],
  //   [255, 255, 255, 255],
  //   [255, 255, 255, 255],
  // ],
  [
    [0, 0, 0, 0],
    [0, 0, 0, 255],
    [0, 0, 0, 255],
  ],
  [
    [255, 255, 255, 0],
    [255, 255, 255, 255],
    [255, 255, 255, 255],
  ],
];

let sensitivity;
let map;
const param = [];

console.time('render');
if (!fs.existsSync('./out')) {
  fs.mkdirSync('./out');
}
calculate();
console.timeEnd('render');