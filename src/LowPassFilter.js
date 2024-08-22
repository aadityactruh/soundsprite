// https://github.com/dli7319/one-euro-filter-js/blob/master/src/OneEuroFilter.js
export default class LowPassFilter {
  setAlpha(alpha) {
    if (alpha <= 0.0 || alpha > 1.0)
      console.log("alpha should be in (0.0., 1.0]");
    this.a = alpha;
  }

  constructor(alpha, initval = 0.0) {
    this.y = this.s = initval;
    this.setAlpha(alpha);
    this.initialized = false;
  }

  filter(value) {
    var result;
    if (this.initialized) result = this.a * value + (1.0 - this.a) * this.s;
    else {
      result = value;
      this.initialized = true;
    }
    this.y = value;
    this.s = result;

    // console.log("LOW PASS", value, this.a)
    return result;
  }

  filterWithAlpha(value, alpha) {
    this.setAlpha(alpha);
    return this.filter(value);
  }

  hasLastRawValue() {
    return this.initialized;
  }

  lastRawValue() {
    return this.y;
  }

  reset() {
    this.initialized = false;
  }
}
