const hypercore = require('../index')
const CryptoBook = require('../libs/CryptoBook')
const fs = require('fs')

const keyfile = 'D:\\tmp\\key.json'

fs.readFile(keyfile, 'utf-8', (err, data) => {
  if (err) data = '[]'
  // TODO: remove hardcoded stuff ;-)
  const book = new CryptoBook(data)

  const core = hypercore('D:\\tmp\\hypercore-test', null, {
    encryptionKeyBook: book,
    valueEncoding: 'utf-8'
  })

  core.newEncryptionKey((err) => {
    if (err) throw err
    core.serializeCryptoKeyBook((err, data) => {
      if (err) throw err

      fs.writeFile(keyfile, JSON.stringify(data), 'utf-8', (err) => {
        if (err) throw err
      })
    })
  })
  core.append('test 4 :)))', () => {
    for (var i = 0; i < core.length; i++) {
      core.get(i, (err, data) => {
        console.log(data)
      })
    }
  })
  // core.createReadStream().pipe(process.stdout).on('close', () => console.log('done'))
})
