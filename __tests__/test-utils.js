/** Minimal mock for Vercel-style res object used in smoke tests. */
export function createMockRes() {
  return {
    statusCode: 200,
    _json: null,
    _ended: false,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this._json = obj;
      return this;
    },
    end() {
      this._ended = true;
      return this;
    },
    send(body) {
      this._sent = body;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
}
