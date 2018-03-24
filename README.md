# hypercore-encrypted
Wrapper around [hypercore](https://github.com/mafintosh/hypercore) that supports encryption
<br>
**Warning: this is experimental, there certainly are bugs and everything is subject to change!**
<br><br>
hypercore-encrypted is derived from hypercore and if a list of keys is provided it encrypts all data appended to the feed and decrypts on read access.
For encryption AES in CTR mode is used. For the IV (counter) the position/offset is used.<br>
It supports multiple keys to enable sharing an feed up to a certain version, while newer entries remain encrypted.
*A version of hyperdb and hyperdrive using hypercore-encrypted is planned*

## What is it for?
I am currently writing a proposal for a bigger project called [DatFS](https://github.com/fsteff/DatFS), 
which would heaviliy depend on the encrpytion.<br>
Also, I believe many p2p apps could use encrypted dats. I would really like to see this or a similar feature being integrated into the official dat codebase.


<br><br>
Any feedback is welcome! I still have much to learn, so don't hesitate to tell me what you think about my work.
