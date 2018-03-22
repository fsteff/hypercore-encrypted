const aes = require('aes-js')
const rand = require('randombytes')

module.exports = CryptoKey

function CryptoKey (nonce, iv) {
  if (!(this instanceof CryptoKey)) return new CryptoKey(nonce, iv)

  if (typeof nonce === 'string') nonce = aes.utils.hex.toBytes(nonce)
  this.nonce = (nonce) || rand(16)
  this.iv = (typeof iv === 'number') ? iv : 0
}

/**
 * @stream {Stream}
 */
CryptoKey.prototype.encrypt = function (buffer) {
  var ctr = new aes.ModeOfOperation.ctr(this.nonce, new aes.Counter(this.iv))
  return ctr.encrypt(buffer)
}

CryptoKey.prototype.decrypt = function (data) {
  var ctr = new aes.ModeOfOperation.ctr(this.nonce, new aes.Counter(this.iv))
  return ctr.decrypt(data)
}

CryptoKey.prototype.serialize = function () {
  return {nonce: this.nonce.toString('hex'), iv: this.iv}
}
