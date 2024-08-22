import LowPassFilter from "./LowPassFilter";
export default class OneEuroFilter {
  alpha(cutoff) {
    var te = 1.0 / this.freq;
    var tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  setFrequency(f) {
    if (f <= 0) console.log("freq should be >0");
    this.freq = f;
  }

  setMinCutoff(mc) {
    if (mc <= 0) console.log("mincutoff should be >0");
    this.mincutoff = mc;
  }

  setBeta(b) {
    this.beta_ = b;
  }

  setDerivateCutoff(dc) {
    if (dc <= 0) console.log("dcutoff should be >0");
    this.dcutoff = dc;
  }

  constructor(freq, mincutoff = 1.0, beta_ = 0.0, dcutoff = 1.0) {
    this.setFrequency(freq);
    this.setMinCutoff(mincutoff);
    this.setBeta(beta_);
    this.setDerivateCutoff(dcutoff);
    this.x = new LowPassFilter(this.alpha(mincutoff));
    this.dx = new LowPassFilter(this.alpha(dcutoff));
    this.lasttime = undefined;
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lasttime = undefined;
  }

  filter(value, timestamp = undefined) {
    // update the sampling frequency based on timestamps
    if (this.lasttime != undefined && timestamp != undefined)
      this.freq = 1.0 / (timestamp - this.lasttime);
    this.lasttime = timestamp;
    // estimate the current variation per second
    var dvalue = this.x.hasLastRawValue()
      ? (value - this.x.lastRawValue()) * this.freq
      : 0.0;
    var edvalue = this.dx.filterWithAlpha(dvalue, this.alpha(this.dcutoff));
    // use it to update the cutoff frequency
    var cutoff = this.mincutoff + this.beta_ * Math.abs(edvalue);
    // console.log("cutoff", cutoff)
    // filter the given value
    return this.x.filterWithAlpha(value, this.alpha(cutoff));
  }
}
