/* 与 sklearn TfidfVectorizer(analyzer="char", ngram_range=(1,2)) 默认参数一致的最小实现：
   lowercase=True, smooth_idf=True, sublinear_tf=False, norm="l2"；idf = ln((1+n)/(1+df)) + 1 */
(function (root) {
  function charNgrams(text, minN, maxN) {
    var t = Array.from(text.toLowerCase().replace(/\s\s+/g, " "));
    var out = [];
    for (var n = minN; n <= Math.min(maxN, t.length); n++)
      for (var i = 0; i + n <= t.length; i++) out.push(t.slice(i, i + n).join(""));
    return out;
  }
  function counts(grams) { var m = new Map(); grams.forEach(function (g) { m.set(g, (m.get(g) || 0) + 1); }); return m; }
  function TfidfIndex(docs, minN, maxN) {
    this.minN = minN || 1; this.maxN = maxN || 2; this.docs = docs;
    var df = new Map(), self = this;
    var docCounts = docs.map(function (d) { return counts(charNgrams(d, self.minN, self.maxN)); });
    docCounts.forEach(function (c) { c.forEach(function (_, g) { df.set(g, (df.get(g) || 0) + 1); }); });
    var n = docs.length; this.idf = new Map();
    df.forEach(function (v, g) { self.idf.set(g, Math.log((1 + n) / (1 + v)) + 1); });
    this.vectors = docCounts.map(function (c) { return self._weigh(c); });
  }
  TfidfIndex.prototype._weigh = function (c) {
    var v = new Map(), s = 0, idf = this.idf;
    c.forEach(function (tf, g) { if (idf.has(g)) { var w = tf * idf.get(g); v.set(g, w); s += w * w; } });
    s = Math.sqrt(s); if (s > 0) v.forEach(function (w, g) { v.set(g, w / s); });
    return v;
  };
  TfidfIndex.prototype.transform = function (q) { return this._weigh(counts(charNgrams(q, this.minN, this.maxN))); };
  TfidfIndex.prototype.search = function (q, k) {
    var qv = this.transform(q);
    var scores = this.vectors.map(function (dv) {
      var s = 0; qv.forEach(function (w, g) { var d = dv.get(g); if (d) s += w * d; }); return s;
    });
    var idx = scores.map(function (_, i) { return i; }).sort(function (a, b) { return scores[b] - scores[a] || a - b; });
    return { query: qv, scores: scores, top: idx.slice(0, k).map(function (i) { return { i: i, score: scores[i], text: this.docs[i] }; }, this) };
  };
  TfidfIndex.prototype.vocabSize = function () { return this.idf.size; };
  root.TfidfIndex = TfidfIndex; root.charNgrams = charNgrams;
  if (typeof module !== "undefined") module.exports = { TfidfIndex: TfidfIndex, charNgrams: charNgrams };
})(typeof window !== "undefined" ? window : globalThis);
