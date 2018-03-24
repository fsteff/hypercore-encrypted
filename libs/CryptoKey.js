const AES = require('aes-js')
const rand = require('randombytes')

module.exports = CryptoKey

/**
 * Stores an AES-128 key
 * Encryption/decryption in CTR mode
 *
 * @param {string | Buffer} nonce (optional, is generated if undefined or null)
 * @param {number} iv (optional) usually 0
 */
function CryptoKey (nonce, iv) {
  if (!(this instanceof CryptoKey)) return new CryptoKey(nonce, iv)

  // deserialisation
  if (typeof nonce === 'object' && typeof nonce.nonce === 'string' && typeof nonce.iv === 'number') {
    iv = nonce.iv
    nonce = nonce.nonce
  }

  if (typeof nonce === 'string') nonce = AES.utils.hex.toBytes(nonce)

  this.nonce = (nonce) || rand(16)
  this.iv = (typeof iv === 'number') ? iv : 0
}

/**
 * @param {Buffer | Array} buffer
 * @param {number} offset
 * @returns {Uint8Array}
 */
CryptoKey.prototype.encrypt = function (buffer, offset) {
  offset = (typeof offset === 'number' && offset >= 0) ? offset : 0
  var ctr = new AES.ModeOfOperation.ctr(this.nonce, new AES.Counter(this.iv + offset)) // eslint-disable-line
  return ctr.encrypt(buffer)
}

/**
 * @param {Buffer | Array} data
 * @param {number} offset
 * @returns {Uint8Array}
 */
CryptoKey.prototype.decrypt = function (data, offset) {
  offset = (typeof offset === 'number' && offset >= 0) ? offset : 0
  var ctr = new AES.ModeOfOperation.ctr(this.nonce, new AES.Counter(this.iv + offset)) // eslint-disable-line
  return ctr.decrypt(data)
}

/**
 * @returns {{nonce, iv}}
 */
CryptoKey.prototype.serialize = function () {
  var nonce = AES.utils.hex.fromBytes(this.nonce)
  return {nonce: nonce, iv: this.iv}
}
