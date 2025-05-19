import { Area, AREA_LIST } from "./area.js";

const AREANAME_TO_CODE = {
  '北海道': '01',
  '東北': '02',
  '東京': '03',
  '中部': '04',
  '北陸': '05',
  '関西': '06',
  '中国': '07',
  '四国': '08',
  '九州': '09',
  '沖縄': '10',
}

const USAGE_OBJ_TEMPLATE = {
  'update': '----/--/-- --:-- UPDATE',
  'date': '-/-',
  '01': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '02': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '03': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '04': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '05': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '06': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '07': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '08': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '09': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
  '10': {
    'demandPeakTime': '--:--～--:--',
    'demandPeakPercent': 0.0,
    'usagePeakTime': '--:--～--:--',
    'usagePeakPercent': 0.0,
  },
};

/**
 * 広域予備率CSVデータを取得する
 * @param {string} jhsybt 情報種別. 広域予備率ブロック情報 週間:'01', 翌々日:'05', 翌日・当日:'02'
 * @param {string} tgtYmdFrom ダウンロードする期間(開始)
 * @param {string} tgtYmdTo ダウンロードする期間(終了)
 * @return {string} UTF-8形式CSVで記述された広域予備率データ
 */
async function fetchCSV(jhSybt, tgtYmdFrom, tgtYmdTo) {
  const response = await fetch(
    'https://powerflowmap.shikiblog.link/api/koikiyobiritsu.php?jhSybt=' + jhSybt
    + '&tgtYmdFrom=' + tgtYmdFrom
    + '&tgtYmdTo=' + tgtYmdTo
  );

  if (!response.ok) {  // データ取得できなかったとき
    return null;
  }
  return response.text();
};

/**
 * 00:30 のような文字列を、00:00～00:30 のように、「指定時の30分前～指定時」に書き直す
 * @param {string} timeStr '00:30'などの'時:分'文字列.
 */
function formatTimeRange(timeStr) {
  // 入力を「時」と「分」に分解
  let [hours, minutes] = timeStr.split(':').map(Number);

  // Date オブジェクトを使って時間を操作
  let date = new Date();
  date.setHours(hours, minutes, 0, 0);

  // 30分前の時間を計算
  let earlierDate = new Date(date.getTime() - 30 * 60 * 1000);
  let earlierHours = String(earlierDate.getHours()).padStart(2, '0');
  let earlierMinutes = String(earlierDate.getMinutes()).padStart(2, '0');

  let formattedTime = `${earlierHours}:${earlierMinutes}～${timeStr}`;
  return formattedTime;
}

/**
 * 1日分のデータから、需要ピークとなるコマ(0～47)を取得する
 * @param {string[][]} dayTable 当日・翌日CSVの1日分を二次元配列に変換したもの 
 * @returns Number 全国(沖縄除く)の需要ピークとなるコマ
 */
function searchZenkokuDemandPeakKoma(dayTable) {
  // 全国(沖縄除く)の需要ピーク時を調べる
  let zenkokuPeakDemand = 0;
  let zenkokuPeakKoma = 0;

  for (let i = 0; i < 48; i++) {
    // コマiについて、沖縄以外の需要合計を計算
    let sum = 0;
    for (let j = 0; j < 10; j++) {
      const areaCode = AREANAME_TO_CODE[dayTable[10 * i + j][3]];  // エリア名
      const areaDemand = Number(dayTable[10 * i + j][9]);  // エリア需要
      if (areaCode != '10') {
        sum += areaDemand;
      }
    }

    if (sum > zenkokuPeakDemand) {
      zenkokuPeakDemand = sum
      zenkokuPeakKoma = i;
    }
  }

  return zenkokuPeakKoma;
}

/**
 * 当日・翌日見通し、または翌々日見通しのCSVデータから、各エリアの需要ピーク時・使用率ピーク時・そのときの使用率を抽出する
 * @param {string} csv 当日・翌日見通し、または翌々日見通しのCSVデータ
 * @return {Array} Array<usageObj> 日別使用率オブジェクトを0個以上含む配列. パース失敗時は[]を返す
 */
function parseDailyCSV(csv) {
  let retArray = [];  // 返り値

  // 行ごとに分割し、ダブルクオーテーションと改行を削除
  const lines = csv
    .split('\n')
    .map((line) => line.replaceAll('"', '').replaceAll('\r', '').replaceAll('\n', ''));

  // データがn日分ある場合、csvの行数は(2+480*n)行になる
  let endline = 482;

  // 行数に応じて、データが存在する日数分だけ配列にpush
  while (lines.length >= endline) {
    // 1日分のデータのひな型
    let usageObj = structuredClone(USAGE_OBJ_TEMPLATE);

    // 更新日時を代入
    usageObj['update'] = lines[0];

    // 一日分のデータを抽出し、二次元配列に変換
    const dayTable = lines
      .slice(endline - 480, endline)  // 1日分の480行を切り出し
      .map((row) => row.replaceAll('"', ''))  // ダブルクオーテーションを削除
      .map((row) => row.split(','));  // [行][列]でアクセスできる2次元配列に変換

    // 翌々日見通しの2列目には「区分名」という無駄な列があり、時刻が入っていない
    // この場合は2列目を削除し、当日・翌日見通しと同じ列構造にする
    if (dayTable[0][1] !== '00:30') {
      for (let row of dayTable) {
        row.splice(1, 1);
      }
    }

    // 対象日を代入
    usageObj['date'] = dayTable[0][0];

    // 広域ブロック使用率ピークを代入
    for (let i = 0; i < 480; i++) {
      const time = formatTimeRange(dayTable[i][1]);
      const areaCode = AREANAME_TO_CODE[dayTable[i][3]];  // エリア名
      const blockUsage = Number(dayTable[i][8]);  // 広域使用率(%)

      if (blockUsage > usageObj[areaCode]['usagePeakPercent']) {
        usageObj[areaCode]['usagePeakPercent'] = blockUsage;
        usageObj[areaCode]['usagePeakTime'] = time;
      }
    }

    // 全国の需要ピークとなるコマを取得
    const zenkokuPeakKoma = searchZenkokuDemandPeakKoma(dayTable);

    // 全国需要ピーク時における、各エリアの広域使用率を代入する
    for (let i = (10 * zenkokuPeakKoma); i < (10 * zenkokuPeakKoma + 10); i++) {
      const time = formatTimeRange(dayTable[i][1]);
      const areaCode = AREANAME_TO_CODE[dayTable[i][3]];  // エリア名
      const blockUsage = Number(dayTable[i][8]);  // 広域使用率(%)

      usageObj[areaCode]['demandPeakTime'] = time;
      usageObj[areaCode]['demandPeakPercent'] = blockUsage;
    }

    // 沖縄需要ピーク時における、沖縄の使用率を代入
    let okinawaPeakDemand = 0;
    for (let i = 0; i < 480; i++) {
      const time = formatTimeRange(dayTable[i][1]);
      const areaCode = AREANAME_TO_CODE[dayTable[i][3]];  // エリア名
      const blockUsage = Number(dayTable[i][8]);  // 広域使用率(%)
      const areaDemand = Number(dayTable[i][9]);  // エリア需要

      if (areaCode == '10') {
        if (areaDemand > okinawaPeakDemand) {
          okinawaPeakDemand = areaDemand;
          usageObj['10']['demandPeakTime'] = time;
          usageObj['10']['demandPeakPercent'] = blockUsage;
        }
      }
    }

    retArray.push(usageObj);

    endline += 480;  // 次の日の処理へ
  }

  return retArray;
}

/**
 * 週間見通しのCSVデータから、各エリアの需要ピーク時・使用率ピーク時・そのときの使用率を抽出する
 * @param {string} csv 週間見通しのCSVデータ
 * @return {Array} Array<usageObj> 日別使用率オブジェクトを0個以上含む配列. パース失敗時は[]を返す
 */
function parseWeeklyCSV(csv) {
  let retArray = [];  // 返り値

  // 行ごとに分割し、ダブルクオーテーションと改行を削除
  const lines = csv
    .split('\n')
    .map((line) => line.replaceAll('"', '').replaceAll('\r', '').replaceAll('\n', ''));

  // データがn日分ある場合、csvの行数は(2+20*n)行になる:
  let endline = 22;

  // 行数に応じて、データが存在する日数分だけ配列にpush
  while (lines.length >= endline) {
    // 1日分のデータのひな型
    let usageObj = structuredClone(USAGE_OBJ_TEMPLATE);

    // 更新日時を代入
    usageObj['update'] = lines[0];

    // 一日分のデータを抽出し、二次元配列に変換
    const dayTable = lines
      .slice(endline - 20, endline)  // 1日分の20行を切り出し
      .map((row) => row.replaceAll('"', ''))  // ダブルクオーテーションを削除
      .map((row) => row.split(','));  // [行][列]でアクセスできる2次元配列に変換

    // 対象月日を代入 (2025/5/8 のようになっているので、先頭5文字は含めない)
    usageObj['date'] = dayTable[0][0].slice(5);

    // 最大需要時と広域使用率を代入
    for (let i = 0; i < 10; i++) {
      const time = formatTimeRange(dayTable[i][4]);  // 対象時刻
      const areaCode = AREANAME_TO_CODE[dayTable[i][3]];  // エリア名
      const blockUsage = Number(dayTable[i][9]);  // 広域使用率(%)

      usageObj[areaCode]['demandPeakTime'] = time;
      usageObj[areaCode]['demandPeakPercent'] = blockUsage;
    }

    // 最小予備率時と広域使用率を代入
    for (let i = 10; i < 20; i++) {
      const time = formatTimeRange(dayTable[i][4]);  // 対象時刻
      const areaCode = AREANAME_TO_CODE[dayTable[i][3]];  // エリア名
      const blockUsage = Number(dayTable[i][9]);  // 広域使用率(%)

      usageObj[areaCode]['usagePeakTime'] = time;
      usageObj[areaCode]['usagePeakPercent'] = blockUsage;
    }

    retArray.push(usageObj);

    endline += 20;  // 次の日の処理へ
  }

  return retArray;
}

/**
 * 使用率の数値に応じて文字色を変える
 * @param {HTMLElement} element 色を変えたい要素
 * @param {Number} percent 使用率
 */
function updateDigitColor(element, percent) {
  element.classList.remove('stable', 'severe', 'verysevere');
  if (percent < 93) {  // 92%台まで
    element.classList.add('stable');
  } else if (percent < 98) {  // 97%台まで
    element.classList.add('severe');
  } else {
    element.classList.add('verysevere');
  }
}

/**
 * 当日・翌日・翌々日 の表を更新する
 * @param {object} obj usageObj オブジェクト
 * @param {string} day 'today', 'tomorrow', '2daysafter' から指定
 */
function updateDailyUsageTable(obj, day) {
  for (const area of AREA_LIST) {

    document.getElementById(day + '_demand_peak_time_' + area.asCode()).innerText
      = obj[area.asCode()]['demandPeakTime'];

    document.getElementById(day + '_demand_peak_percent_' + area.asCode()).innerText
      = String(Math.trunc(obj[area.asCode()]['demandPeakPercent']));

    updateDigitColor(
      document.getElementById(day + '_demand_peak_percent_' + area.asCode()),
      obj[area.asCode()]['demandPeakPercent']
    );

    document.getElementById(day + '_usage_peak_time_' + area.asCode()).innerText
      = obj[area.asCode()]['usagePeakTime'];

    document.getElementById(day + '_usage_peak_percent_' + area.asCode()).innerText
      = String(Math.trunc(obj[area.asCode()]['usagePeakPercent']));

    updateDigitColor(
      document.getElementById(day + '_usage_peak_percent_' + area.asCode()),
      obj[area.asCode()]['usagePeakPercent']
    );
  }

  document.getElementById(day + '_caption').innerText
    = '広域ブロック使用率\n(' + obj['update'] + ')';  // 更新日時
}

function updateTHead(usageObjArray) {
  // <tr> を取得
  const trElement = document.querySelector("#weekly_usage_peak_head");

  for (const usageObj of usageObjArray) {
    // 新しい列を作成
    const thElement = document.createElement("th");

    // 日付を記入
    thElement.innerText = usageObj['date'];

    // 列を追加
    trElement.appendChild(thElement);
  }
}

function updateTBody(usageObjArray) {
  for (const area of AREA_LIST) {

      // 各日ごとに代入
    for (const usageObj of usageObjArray) {

      // <tr> を取得
      const trElement = document.getElementById("weekly_usage_peak_row_" + area.asCode());

      // <td>要素を作成
      const tdElement = document.createElement("td");

      // <div>要素を作成しクラスを追加
      const divElement = document.createElement("div");
      divElement.classList.add("table-value");

      // <span>要素を作成しクラスとテキストを追加
      const spanElement = document.createElement("span");
      spanElement.classList.add("table-digits");
      spanElement.textContent = String(Math.trunc(usageObj[area.asCode()]['usagePeakPercent']));

      // "%" のテキストノードを作成
      const percentText = document.createTextNode("%");

      // 構造を組み立て
      divElement.appendChild(spanElement);
      divElement.appendChild(percentText);
      tdElement.appendChild(divElement);
      trElement.appendChild(tdElement);

      // 色を変更
      updateDigitColor(spanElement, usageObj[area.asCode()]['usagePeakPercent']);
    }
  }  
}

/**
 * 週間の表を更新する
 * @param {Array} usageObjArray Array<usageObj>
 */
function updateWeeklyUsageTable(usageObjArray) {
  // 日付見出しをすべて削除
  document.querySelectorAll("#weekly_usage_thead th")
    .forEach(th => {
      if (th.innerText !== 'エリア') {
        th.remove()
      }
    });

  // 日付列をすべて削除
  document.querySelectorAll("#weekly_usage_tbody td")
    .forEach(td => td.remove());
  
  // 表を更新
  updateTHead(usageObjArray);
  updateTBody(usageObjArray);

  // 更新日時を挿入
  document.getElementById('weekly_usage_peak_caption').innerText
    = '使用率ピーク時の広域ブロック使用率\n(' + usageObjArray[0]['update'] + ')';  // 更新日時
}

async function fetchAndUpdateTodayAndTomorrow() {
  // 18時以前の場合は本日分、18時以降の場合は本日+翌日分のデータを取得する
  const now = new Date();
  let beginDate = new Date();
  let endDate = new Date();
  if (now.getHours() < 18) {
    beginDate.setDate(now.getDate());
    endDate.setDate(beginDate.getDate());
  } else {
    beginDate.setDate(now.getDate());
    endDate.setDate(beginDate.getDate() + 1);
  }

  // YYYY/mm/dd文字列にする
  const beginStr = beginDate.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
  const endStr = endDate.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

  // 当日・翌日見通しのCSVを取得(情報種別02)
  const csv = await fetchCSV('02', beginStr, endStr);

  // CSVデータをパース
  const usageObjArray = parseDailyCSV(csv);

  // データなし
  if (usageObjArray.length == 0) {
    return;
  }

  // 当日分
  if (usageObjArray.length >= 1) {
    updateDailyUsageTable(usageObjArray[0], 'today');
  }

  // 当日分＋翌日分
  if (usageObjArray.length >= 2) {
    updateDailyUsageTable(usageObjArray[0], 'today');
    updateDailyUsageTable(usageObjArray[1], 'tomorrow');
  }
}

async function fetchAndUpdate2DaysAfter() {
  // 18時以前の場合は翌日分、18時以降の場合は翌々日分のデータを取得する
  const now = new Date();
  let beginDate = new Date();
  let endDate = new Date();
  if (now.getHours() < 18) {
    beginDate.setDate(now.getDate() + 1);
    endDate.setDate(beginDate.getDate() + 1);
  } else {
    beginDate.setDate(now.getDate() + 2);
    endDate.setDate(beginDate.getDate() + 2);
  }

  // YYYY/mm/dd文字列にする
  const beginStr = beginDate.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
  const endStr = endDate.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

  // 翌々日見通しのCSVを取得(情報種別05)
  const csv = await fetchCSV('05', beginStr, endStr);

  // CSVデータをパース
  const usageObjArray = parseDailyCSV(csv);

  // データなし
  if (usageObjArray.length == 0) {
    return;
  }

  // 時刻に応じて、翌日または翌々日見通しの表を更新
  if (now.getHours() < 18) {
    updateDailyUsageTable(usageObjArray[0], 'tomorrow');
    document.getElementById('2daysafter_not_ready').hidden = false;
  } else {
    updateDailyUsageTable(usageObjArray[0], '2daysafter');
    document.getElementById('2daysafter_not_ready').hidden = true;
  }
}

async function fetchAndUpdateWeekly() {
  // 18時以前の場合は翌々日から7日ぶん、18時以降の場合は3日後から7日ぶんのデータを取得する
  const now = new Date();
  let beginDate = new Date();
  let endDate = new Date();
  if (now.getHours() < 18) {
    beginDate.setDate(now.getDate() + 2);
    endDate.setDate(beginDate.getDate() + 8);
  } else {
    beginDate.setDate(now.getDate() + 3);
    endDate.setDate(beginDate.getDate() + 9);
  }

  // YYYY/mm/dd文字列にする
  const beginStr = beginDate.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
  const endStr = endDate.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

  // 週間見通しのCSVを取得(情報種別01)
  const csv = await fetchCSV('01', beginStr, endStr);

  // CSVデータをパース
  const usageObjArray = parseWeeklyCSV(csv);

  console.log(usageObjArray);

  // データなし
  if (usageObjArray.length == 0) {
    return;
  }

  // 表を更新
  updateWeeklyUsageTable(usageObjArray);
}

async function main() {

  // 本日・翌日の電力使用見通しを更新
  fetchAndUpdateTodayAndTomorrow();

  // 翌々日の電力使用見通しを更新
  fetchAndUpdate2DaysAfter();

  // 週間の電力使用見通しを更新
  fetchAndUpdateWeekly();
}


main();
