const hypercore = require('../index')
const CryptoBook = require('../libs/CryptoBook')
const ram = require('random-access-memory')

module.exports = function () {
  const core = hypercore(() => { return ram() }, null, {
    encryptionKeyBook: new CryptoBook(),
    valueEncoding: 'utf-8'
  })
  core.newEncryptionKey((err) => {
    if (err) throw err

    core.append('test 1 §$€')
    core.append('test 2 ^°ß')

    core.get(0, (err, data) => {
      if (err) throw err

      if (data !== 'test 1 §$€') throw new Error('wrong data')
      console.log('test 1 ok')
    })

    core.get(1, (err, data) => {
      if (err) throw err

      if (data !== 'test 2 ^°ß') throw new Error('wrong data')
      console.log('test 2 ok')
    })
  })
}
