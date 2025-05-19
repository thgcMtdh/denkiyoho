export class Area {
  #id;  // エリアの通し番号. 1～10の範囲の整数値を指定する

  /**
   * 電力エリアを表すクラス
   * @param {Number} id エリアの通し番号. 1～10の範囲の整数値を指定する
   */
  constructor(id) {
    if (!Number.isInteger(id)) {
      throw new Error("Invalid area id. Id should be integer between 1-10.");
    }
    if (id < 1 || id > 10) {
      throw new Error("Invalid area id. Id should be integer between 1-10.");
    }
    this.#id = id;
  }

  /**
   * @returns {Number} エリアの通し番号を、整数型で取得する
   */
  id() {
    return this.#id;
  }

  /**
   * @returns {string} エリアの通し番号を、"01"から"10"までの2桁の文字列で返す
   */
  asCode() {
    return String(this.#id).padStart(2, "0");
  }

  /**
   * @returns {string} エリア名を漢字(北海道,東北,...)で取得する
   */
  name() {
    switch (this.#id) {
      case 1: return "北海道";
      case 2: return "東北";
      case 3: return "東京";
      case 4: return "中部";
      case 5: return "北陸";
      case 6: return "関西";
      case 7: return "中国";
      case 8: return "四国";
      case 9: return "九州";
      case 10: return "沖縄";
    }
  }
}

export const AREA_LIST = [  // 北海道～沖縄までのエリアをリスト化
  new Area(1),
  new Area(2),
  new Area(3),
  new Area(4),
  new Area(5),
  new Area(6),
  new Area(7),
  new Area(8),
  new Area(9),
  new Area(10),
];
