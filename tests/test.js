const testNew = require('./testNew')
const testHyperdrive = require('./testHyperdrive')

testNew()
testHyperdrive()

/*
const keyfile = '/tests/keys.json'

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

  core.append('test ' + core.cryptoKeyBook.entries.length, () => {
    for (var i = 0; i < core.length; i++) {
      const n = i
      core.get(n, (err, data) => {
        if(err) throw err
        console.log(n + ': ' + data)
      })
    }
  })
  core.createReadStream().pipe(process.stdout)
})
 */
