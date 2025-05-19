import { Area, AREA_LIST } from "./area.js";

const chartCfgTemplate = {
  type: 'line',
  data: {
    // 5分間隔で計288個の配列を生成し、1時間単位(0:00～0:55は0)で横軸ラベルを作る
    labels: Array.from({ length: 24*60/5 }, (_, i) => parseInt(i/12)),
    datasets: [
      {
        label: '需要実績',
        data: null,
        borderColor: 'rgb(142,54,54)',
        pointRadius: 0,
      },
      {
        label: '太陽光発電実績',
        data: null,
        borderColor: 'rgb(253,103,36)',
        pointRadius: 0,
      },
      {
        label: '需要予測',
        data: null,
        fill: true,
        borderColor: 'rgb(175,194,218)',
        backgroundColor: 'rgba(175,194,218,0.4)',
        pointRadius: 0,
        stepped: true,
      },
    ],
  },
  options: {
    // maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: false,
          text: '(時)',
          // color: 'black',
          // font: {
          //   size: 14,
          // }
        },
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 24,
          maxRotation: 0,
          // color: 'black',
          // font: {
          //   size: 14,
          // }
        }
      },
      y: {
        title: {
          display: false,
          text: '(万kW)',
          // color: 'black',
          // font: {
          //   size: 14,
          // }
        },
        ticks: {
          // color: 'black',
          // font: {
          //   size: 14,
          // }
        },
        beginAtZero: true
      },
    },
    plugins: {
      legend: {
        display: false,
        position: 'bottom',
      }
    }
  }
}

let chartCfgList = [
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),
  structuredClone(chartCfgTemplate),  // 全国
];

let chartCtxList = [
  document.getElementById("chart_01"),
  document.getElementById("chart_02"),
  document.getElementById("chart_03"),
  document.getElementById("chart_04"),
  document.getElementById("chart_05"),
  document.getElementById("chart_06"),
  document.getElementById("chart_07"),
  document.getElementById("chart_08"),
  document.getElementById("chart_09"),
  document.getElementById("chart_10"),
  document.getElementById("chart_11"),  // 全国
];

/**
 * でんき予報CSVデータを取得する
 * @param {Area} area 電力エリア
 */
async function fetchCSV(area) {
  const response = await fetch('https://powerflowmap.shikiblog.link/api/denkiyoho.php?area=' + area.id());

  if (!response.ok) {  // データ取得できなかったとき
    return null;
  }
  return response.text();
};

/**
 * CSVデータから、各種の値を抽出し、オブジェクトとして返す
 * @param {Area} area  電力エリア. エリアによって抽出すべき行番号が異なるので、エリアを渡す必要がある
 * @param {string} csv ダウンロードしたCSVデータ. Example CSV format:
 * ```plain
 * DATE,TIME,当日実績(万kW),予測値(万kW),使用率(%),供給力(万kW)
 * 2025/04/13,00:00,75,71,60,124
 * 2025/04/13,01:00,72,69,58,124
 * ```
 * @returns {Object} 抽出した値を含むオブジェクト
 * - actualDemands:     {number[]} 需要の当日実績(1時間間隔)[万kW]
 * - forecastDemands:   {number[]} 需要の予測値(1時間間隔)[万kW]
 * - usageRates:        {number[]} エリア使用率(1時間間隔)[万kW]
 * - supplyCapacities:  {number[]} 供給力(1時間間隔)[万kW]
 * - actual5minDemands: {number[]} 需要の当日実績(5分間隔値)[万kW]
 * - actual5minSolars:  {number[]} 太陽光発電実績(5分間隔値)[万kW]
 */
function parseCSV(csv, area) {
  const lines = csv.split('\n'); // 行ごとに分割

  let dataRows;
  let data5minRows;
  if (area.name() == "関西") {
    dataRows = lines.slice(17, 41);
    data5minRows = lines.slice(58, 346); // 56行目から343行目を抽出（0-based index, 最後は無視）
  } else {
    dataRows = lines.slice(14, 38); // 15行目から38行目を抽出（0-based index, 最後は無視）
    data5minRows = lines.slice(55, 343); // 56行目から343行目を抽出（0-based index, 最後は無視）
  }

  let actualDemands = [];
  let forecastDemands = [];
  let usageRates = [];
  let supplyCapacities = [];

  for (let row of dataRows) {
    const columns = row.split(','); // カンマで列を分割
    if (columns.length >= 6) { // 必要な列数があることを確認
      actualDemands.push(parseFloat(columns[2])); // 実績値（3番目の列）
      forecastDemands.push(parseFloat(columns[3])); // 予測値（4番目の列）
      usageRates.push(parseFloat(columns[4])); // 使用率（5番目の列）
      supplyCapacities.push(parseFloat(columns[5])); // 供給力（6番目の列）
    }
  }

  let actual5minDemands = [];
  let actual5minSolars = [];

  for (let row of data5minRows) {
    const columns = row.split(','); // カンマで列を分割
    if (columns.length >= 4) { // 必要な列数があることを確認
      actual5minDemands.push(parseFloat(columns[2])); // 当日実績（3番目の列）
      actual5minSolars.push(parseFloat(columns[3])); // 太陽光発電実績（4番目の列）
    }
  }

  return { actualDemands, forecastDemands, usageRates, supplyCapacities, actual5minDemands, actual5minSolars };
};

/**
 * 配列のデータを指定個数ずつ複製した配列を生成する関数
 * @param {*} arr 元の配列 例:[1,2,3]
 * @param {*} repeatCount 何個複製するか 例:2
 * @returns 複製した配列 例:[1,1,2,2,3,3]
 */
function duplicateElements(arr, repeatCount) {
  let result = []; // 結果を格納する配列
  for (const element of arr) {
    for (let i = 0; i < repeatCount; i++) {
      result.push(element); // 要素を繰り返して追加
    }
  }
  return result;
}

/**
 * 指定したエリアのデータセットについて、最新データのインデックスを取得する
 * @param {Area} area 電力エリア
 */
function getLatestIndex(area) {
  // 需要実績値を確認し、最新データすなわちNaNでない最後のインデックスを取得
  let i = 0;
  for (i = 0; i < 24*60/5; i++) {
    if (isNaN(chartCfgList[area.id() - 1].data.datasets[0].data[i])) {
      i = i - 1;  // NaNではない最後のインデックス
      break;
    }
  }

  // 太陽光実績値を確認し、最新データすなわちNaNでない最後のインデックスを取得
  let j = 0;
  for (j = 0; j < 24*60/5; j++) {
    if (isNaN(chartCfgList[area.id() - 1].data.datasets[1].data[j])) {
      j = j - 1;  // NaNではない最後のインデックス
      break;
    }
  }

  return Math.min(i, j);  // より若い方を返す
}

/**
 * インジケータの数値を更新する
 * @param {Area} area 電力エリア
 */
function updateIndicator(area) {
  // 最新データのインデックスを取得
  const latestIdx = getLatestIndex(area);

  // 需要実績、太陽光実績を取得し、太陽光比率を計算
  const latestDemand = chartCfgList[area.id() - 1].data.datasets[0].data[latestIdx];
  const latestSolar = chartCfgList[area.id() - 1].data.datasets[1].data[latestIdx];
  const solarPercentage = Math.round(latestSolar * 100 / latestDemand);

  // DOM更新
  document.getElementById("demand_" + area.asCode()).innerText = String(latestDemand);
  document.getElementById("solar_" + area.asCode()).innerText = String(latestSolar);
  document.getElementById("solar_percentage_" + area.asCode()).innerText = String(solarPercentage);
}

/**
 * 全国の数値を更新する
 */
function updateZenkokuIndicator() {
  // 各エリアの最新データのインデックスを取得
  const latestIdxList = AREA_LIST.map((area) => getLatestIndex(area));

  // 全エリアの中で最も若いインデックスを取得
  const minLatestIdx = latestIdxList.reduce((min, element) => Math.min(min, element), 24*60/5);

  // 当該時刻における各エリアの需要実績と太陽光実績を取得
  const demandList = AREA_LIST.map((area) => chartCfgList[area.id() - 1].data.datasets[0].data[minLatestIdx]);
  const solarList  = AREA_LIST.map((area) => chartCfgList[area.id() - 1].data.datasets[1].data[minLatestIdx]);

  // 需要実績と太陽光実績の全国合計値を計算し、太陽光比率を計算
  const zenkokuDemand = demandList.reduce((sum, element) => sum + element, 0);
  const zenkokuSolar  = solarList.reduce((sum, element) => sum + element, 0)
  const solarPercentage = Math.round(zenkokuSolar * 100 / zenkokuDemand);
  
  // DOM更新
  document.getElementById("demand_11").innerText = String(zenkokuDemand);
  document.getElementById("solar_11").innerText = String(zenkokuSolar);
  document.getElementById("solar_percentage_11").innerText = String(solarPercentage);
}

async function fetchAndDraw(area) {
  // CSVデータを取得
  const csv = await fetchCSV(area);

  // データをパース
  const {
    actualDemands,
    forecastDemands,
    usageRates,
    supplyCapacities,
    actual5minDemands,
    actual5minSolars
  } = parseCSV(csv, area);

  // 1時間値を5分値に補間
  const forecast5minDemands = duplicateElements(forecastDemands, 12);

  // データセットに格納
  chartCfgList[area.id() - 1].data.datasets[0].data = actual5minDemands;
  chartCfgList[area.id() - 1].data.datasets[1].data = actual5minSolars;
  chartCfgList[area.id() - 1].data.datasets[2].data = forecast5minDemands;

  // グラフを描画
  new Chart(chartCtxList[area.id() - 1], chartCfgList[area.id() - 1]);

  // インジケータの値を更新
  updateIndicator(area);
}

function createZenkokuData() {
  // 全国合計データを入れる配列
  let actual5minDemands = Array(24*60/5).fill(0);
  let actual5minSolars = Array(24*60/5).fill(0);
  let forecast5minDemands = Array(24*60/5).fill(0);

  // 全国合計を計算
  for (let areaId = 1; areaId <= 10; areaId++) {
    for (let i = 0; i < 24*60/5; i++) {
      actual5minDemands[i] += chartCfgList[areaId - 1].data.datasets[0].data[i];
      actual5minSolars[i] += chartCfgList[areaId - 1].data.datasets[1].data[i];
      forecast5minDemands[i] += chartCfgList[areaId - 1].data.datasets[2].data[i];
    }
  }

  // 返す
  return { actual5minDemands, actual5minSolars, forecast5minDemands };
}

async function main() {
  // 全エリアのデータ取得と描画を行う. 終わるまで待機
  await Promise.all([
    fetchAndDraw(new Area(1)),
    fetchAndDraw(new Area(2)),
    fetchAndDraw(new Area(3)),
    fetchAndDraw(new Area(4)),
    fetchAndDraw(new Area(5)),
    fetchAndDraw(new Area(6)),
    fetchAndDraw(new Area(7)),
    fetchAndDraw(new Area(8)),
    fetchAndDraw(new Area(9)),
    fetchAndDraw(new Area(10)),
  ]);

  // 全国合計グラフ用のデータを生成
  const {
    actual5minDemands,
    actual5minSolars,
    forecast5minDemands
  } = createZenkokuData();

  // データセットに格納
  chartCfgList[10].data.datasets[0].data = actual5minDemands;
  chartCfgList[10].data.datasets[1].data = actual5minSolars;
  chartCfgList[10].data.datasets[2].data = forecast5minDemands;
  
  // 全国合計グラフを描画
  new Chart(chartCtxList[10], chartCfgList[10]);

  // 全国合計のインジケータ値を更新
  updateZenkokuIndicator();
}


main();
