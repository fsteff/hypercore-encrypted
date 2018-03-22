const hypercore = require('../index')
const crypto = require('../libs/crypto')

// TODO: remove hardcoded stuff ;-)
const key = crypto('f001b475d5fd3a300fda25ed0ea23f67', 0)
const core = hypercore('D:\\tmp\\hypercore-test', null, {
  encryptionKey: key,
  valueEncoding: 'utf-8'
})

core.append('test \u20AC', () => {
    /*core.get(0, (err, data) => {
        console.log(data)
    })*/
})
core.createReadStream().pipe(process.stdout).on('close', () => console.log('done'))
